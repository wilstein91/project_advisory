'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '@/lib/api/client';
import type { AnswerMap, AnswerValue, Question, Segment, SubmitResult } from '@/lib/api/types';
import { canAdvance, pruneHiddenAnswers, visibleQuestions } from '@/lib/wizard/branching';
import { ContactStep, emptyContact, type ContactForm } from './ContactStep';
import { QuestionStep } from './QuestionStep';
import { ResultStep } from './ResultStep';
import { SegmentStep } from './SegmentStep';
import { VerifyStep } from './VerifyStep';

type Phase = 'segment' | 'questions' | 'contact' | 'verify' | 'result';

/** 진행 중 답변은 브라우저에만 둔다. 접수 시점에 한 번 서버로 간다 (PRD §11) */
const DRAFT_KEY = 'advisory.draft';

interface Draft {
  segment: Segment;
  answers: AnswerMap;
}

function readDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft | null) {
  try {
    if (draft) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* 저장이 막혀도 위저드는 계속 동작해야 한다 */
  }
}

export function InquiryWizard() {
  const [phase, setPhase] = useState<Phase>('segment');
  const [segment, setSegment] = useState<Segment | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [index, setIndex] = useState(0);

  const [contact, setContact] = useState<ContactForm>(emptyContact);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [mockCode, setMockCode] = useState<string | undefined>();
  const [result, setResult] = useState<SubmitResult | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  /* ---------------- 이어서 하기 (§4-3) ---------------- */

  // localStorage는 서버 렌더 때 없으므로 마운트 후에 읽을 수밖에 없다.
  // 초기값으로 읽으면 서버와 클라이언트 렌더가 어긋난다.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const draft = readDraft();
    if (draft?.segment) {
      setSegment(draft.segment);
      setAnswers(draft.answers ?? {});
      setPhase('questions');
      setRestored(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* ---------------- 문항 불러오기 ---------------- */

  // 따로 loading 상태를 두지 않는다. questions가 비어 있는 동안이 곧 불러오는 중이다.
  useEffect(() => {
    if (!segment) return;
    let cancelled = false;
    api
      .getQuestions(segment)
      .then((data) => {
        if (!cancelled) setQuestions(data.questions);
      })
      .catch((cause) => {
        if (!cancelled) setError(messageOf(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [segment]);

  useEffect(() => {
    if (segment) writeDraft({ segment, answers });
  }, [segment, answers]);

  /* ---------------- 지금 보여야 하는 문항 ---------------- */

  const visible = useMemo(() => visibleQuestions(questions, answers), [questions, answers]);
  const current = visible[index];
  const total = visible.length;
  const ratio = total ? index / total : 0;

  const setAnswer = useCallback(
    (questionId: string, value: AnswerValue) => {
      setAnswers((previous) => {
        const next = { ...previous, [questionId]: value };
        // 조건이 바뀌어 숨겨진 문항의 답은 버린다
        return pruneHiddenAnswers(questions, next);
      });
    },
    [questions],
  );

  const goNext = () => {
    if (index + 1 < total) setIndex(index + 1);
    else setPhase('contact');
  };

  const goBack = () => {
    setError(null);
    if (phase === 'contact') {
      setPhase('questions');
      setIndex(Math.max(0, total - 1));
      return;
    }
    if (phase === 'verify') {
      setPhase('contact');
      return;
    }
    if (index > 0) {
      setIndex(index - 1);
      return;
    }
    // 첫 문항에서 뒤로 = 구분 다시 고르기
    setPhase('segment');
    setSegment(null);
    setQuestions([]);
    setAnswers({});
    writeDraft(null);
  };

  /* ---------------- 인증과 접수 ---------------- */

  const requestCode = async () => {
    setBusy(true);
    setVerifyError(null);
    setError(null);
    try {
      const data = await api.requestEmailVerification(contact.email);
      setMockCode(data.mockCode);
      setPhase('verify');
    } catch (cause) {
      if (cause instanceof ApiError && cause.fields) setFieldErrors(cause.fields);
      setError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  const confirmCode = async (code: string) => {
    setBusy(true);
    setVerifyError(null);
    try {
      const data = await api.confirmEmailVerification(contact.email, code);
      await submit(data.verificationToken);
    } catch (cause) {
      setVerifyError(messageOf(cause));
      setBusy(false);
    }
  };

  const submit = async (verificationToken: string) => {
    if (!segment) return;
    try {
      const data = await api.submitInquiry({
        segment,
        contact: {
          name: contact.name.trim(),
          email: contact.email.trim(),
          phone: contact.phone.trim(),
          companyName: segment === 'corporate' ? contact.companyName.trim() : null,
          title: segment === 'corporate' ? contact.title.trim() : null,
        },
        answers,
        consents: { privacy: contact.privacy, marketing: contact.marketing },
        verificationToken,
      });
      setResult(data);
      setPhase('result');
      writeDraft(null); // 접수했으면 임시 저장을 지운다
    } catch (cause) {
      if (cause instanceof ApiError && cause.fields) {
        setFieldErrors(cause.fields);
        setPhase('contact');
      }
      setVerifyError(messageOf(cause));
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- 화면 ---------------- */

  const contactReady =
    contact.name.trim() !== '' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) &&
    contact.phone.replace(/\D/g, '').length >= 9 &&
    contact.privacy &&
    (segment !== 'corporate' || (contact.companyName.trim() !== '' && contact.title.trim() !== ''));

  const showChrome = phase !== 'result';

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-hair bg-paper">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <Link href="/" className="font-serif text-base font-semibold">
            ○○투자자문
          </Link>
          {showChrome && phase === 'questions' && total > 0 && (
            <span className="num text-xs text-mute">
              {Math.min(index + 1, total)} / {total}
            </span>
          )}
        </div>
        {showChrome && (
          <div className="progress-track">
            <div
              className="progress-bar"
              style={{ width: `${Math.round(phaseRatio(phase, ratio) * 100)}%` }}
            />
          </div>
        )}
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
        {restored && phase === 'questions' && (
          <div className="note mb-8 flex flex-wrap items-center justify-between gap-3">
            <span>전에 답하시던 내용을 불러왔습니다.</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                writeDraft(null);
                setRestored(false);
                setSegment(null);
                setAnswers({});
                setQuestions([]);
                setIndex(0);
                setPhase('segment');
              }}
            >
              처음부터 다시
            </button>
          </div>
        )}

        {error && <div className="note note-flag mb-8">{error}</div>}

        {phase === 'segment' && (
          <SegmentStep
            onSelect={(value) => {
              setSegment(value);
              setAnswers({});
              setIndex(0);
              setRestored(false);
              setPhase('questions');
            }}
          />
        )}

        {phase === 'questions' &&
          (!current ? (
            <p className="text-mute">불러오는 중…</p>
          ) : (
            <QuestionStep
              question={current}
              value={answers[current.id]}
              onChange={(value) => setAnswer(current.id, value)}
            />
          ))}

        {phase === 'contact' && segment && (
          <ContactStep
            segment={segment}
            form={contact}
            onChange={(next) => {
              setContact(next);
              setFieldErrors({});
            }}
            serverFields={fieldErrors}
          />
        )}

        {phase === 'verify' && (
          <VerifyStep
            email={contact.email}
            mockCode={mockCode}
            error={verifyError}
            busy={busy}
            onConfirm={confirmCode}
            onResend={requestCode}
          />
        )}

        {phase === 'result' && result && segment && (
          <ResultStep result={result} questions={questions} answers={answers} />
        )}

        {/* 하단 조작 */}
        {phase === 'questions' && current && (
          <Nav
            onBack={goBack}
            primary={{
              label: index + 1 === total ? '거의 다 됐습니다' : '다음',
              disabled: !canAdvance(current, answers),
              onClick: goNext,
            }}
            hint={current.optional ? '건너뛰셔도 됩니다' : undefined}
          />
        )}

        {phase === 'contact' && (
          <Nav
            onBack={goBack}
            primary={{
              label: busy ? '보내는 중…' : '인증번호 받기',
              disabled: !contactReady || busy,
              onClick: requestCode,
            }}
            hint={!contact.privacy ? '필수 동의에 체크해 주세요' : undefined}
          />
        )}

        {phase === 'verify' && (
          <div className="mt-10 border-t border-hair pt-5">
            <button type="button" className="btn btn-quiet text-sm" onClick={goBack}>
              ← 연락처 고치기
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function Nav({
  onBack,
  primary,
  hint,
}: {
  onBack: () => void;
  primary: { label: string; disabled: boolean; onClick: () => void };
  hint?: string;
}) {
  return (
    <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-hair pt-5">
      <button type="button" className="btn btn-quiet text-sm" onClick={onBack}>
        ← 뒤로
      </button>
      <div className="flex items-center gap-4">
        {hint && <span className="text-xs text-mute">{hint}</span>}
        <button
          type="button"
          className="btn btn-primary"
          disabled={primary.disabled}
          onClick={primary.onClick}
        >
          {primary.label}
        </button>
      </div>
    </div>
  );
}

/** 문항 구간이 진행률의 대부분을 차지하도록 배분한다. */
function phaseRatio(phase: Phase, questionRatio: number): number {
  switch (phase) {
    case 'segment':
      return 0.02;
    case 'questions':
      return 0.05 + questionRatio * 0.75;
    case 'contact':
      return 0.85;
    case 'verify':
      return 0.94;
    default:
      return 1;
  }
}

function messageOf(cause: unknown): string {
  if (cause instanceof ApiError) return cause.message;
  return '문제가 생겼습니다. 잠시 후 다시 시도해 주세요.';
}
