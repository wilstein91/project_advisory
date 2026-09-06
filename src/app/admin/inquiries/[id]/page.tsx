'use client';

import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import {
  CLOSE_REASON_LABEL,
  STATUS_LABEL,
  SegmentPill,
  StatusPill,
  TIER_LABEL,
  when,
} from '@/components/admin/ui';
import { ApiError, api } from '@/lib/api/client';
import type {
  AuditEntry,
  CloseReason,
  InquiryDetail,
  InquiryStatus,
  ReportSection,
  Strategy,
} from '@/lib/api/types';

/** 화면 12 — 문의 상세와 결과지 발송 (PRD §10, §9) */
export default function InquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [inquiry, setInquiry] = useState<InquiryDetail | null>(null);
  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [sections, setSections] = useState<ReportSection[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [memo, setMemo] = useState('');
  const [closeReason, setCloseReason] = useState<CloseReason>('contracted');
  const [closeNote, setCloseNote] = useState('');

  const apply = useCallback((data: Awaited<ReturnType<typeof api.getInquiry>>) => {
    setInquiry(data.inquiry);
    setStrategy(data.strategy);
    setAudit(data.audit);
    setError(null);
  }, []);

  // 첫 조회는 loading=true로 시작한다. 이후 갱신은 busy가 알려주므로 다시 켜지 않는다.
  useEffect(() => {
    let cancelled = false;
    api
      .getInquiry(id)
      .then((data) => {
        if (!cancelled) apply(data);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof ApiError ? cause.message : '문의를 불러오지 못했습니다.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, apply]);

  const reload = useCallback(async () => {
    apply(await api.getInquiry(id));
  }, [id, apply]);

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError(null);
    setFlash(null);
    try {
      await fn();
      setFlash(done);
      await reload();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '처리하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const openPreview = async () => {
    setError(null);
    try {
      const data = await api.getReportPreview(id);
      setSections(data.sections);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '미리보기를 불러오지 못했습니다.');
    }
  };

  if (loading && !inquiry) {
    return <main className="mx-auto max-w-6xl px-6 py-16 text-mute">불러오는 중…</main>;
  }
  if (!inquiry) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="note note-flag">{error ?? '문의를 찾을 수 없습니다.'}</div>
        <Link href="/admin/inquiries" className="btn btn-ghost mt-6">
          목록으로
        </Link>
      </main>
    );
  }

  const { diagnosis, contact, consents } = inquiry;

  return (
    <main className="mx-auto max-w-6xl px-6 py-9">
      <Link href="/admin/inquiries" className="btn btn-quiet text-sm">
        ← 목록
      </Link>

      {/* 머리말 */}
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-hair pb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="num text-xs text-mute">{inquiry.id}</span>
            <SegmentPill segment={inquiry.segment} />
            <StatusPill status={inquiry.status} />
            {diagnosis.belowMinimum && <span className="pill pill-flag">금액 미달</span>}
            {diagnosis.unsureCount >= 3 && (
              <span className="pill pill-flag">모름 {diagnosis.unsureCount}건</span>
            )}
          </div>
          <h1 className="mt-3 text-2xl">
            {contact.companyName ? `${contact.companyName} ${contact.name}` : contact.name}
            <span className="ml-3 font-sans text-base font-normal text-mute">
              {TIER_LABEL[diagnosis.tier]}
              {diagnosis.score !== null && <span className="num"> · {diagnosis.score}점</span>}
            </span>
          </h1>
          <p className="mt-1.5 text-sm text-mute">
            {when(inquiry.submittedAt)} 접수 · {inquiry.amountLabel}
            {contact.title && ` · ${contact.title}`}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {inquiry.reportSentAt ? (
            <span className="pill pill-good">결과지 발송 완료 · {when(inquiry.reportSentAt)}</span>
          ) : (
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost btn-sm" onClick={openPreview}>
                결과지 미리보기
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy}
                onClick={() => act(() => api.sendReport(id), '결과지를 보냈습니다.')}
              >
                결과지 발송
              </button>
            </div>
          )}
          <span className="text-xs text-mute">담당자 {inquiry.assignee ?? '미배정'}</span>
        </div>
      </div>

      {flash && <div className="note mt-6">{flash}</div>}
      {error && <div className="note note-flag mt-6">{error}</div>}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_20rem]">
        {/* ---------------- 왼쪽 ---------------- */}
        <div className="grid gap-10">
          <Section title="고객님이 답해주신 내용">
            <dl className="divide-y divide-hairsoft border-y border-hairsoft">
              {inquiry.answersDisplay.map((row) => (
                <div key={row.questionId} className="grid gap-1 py-3 sm:grid-cols-[19rem_1fr] sm:gap-5">
                  <dt className="text-sm leading-relaxed text-mute">{row.prompt}</dt>
                  <dd className="text-[0.95rem] leading-relaxed">
                    {row.answerLabel}
                    {row.isUnsure && <span className="pill ml-2">모름</span>}
                  </dd>
                </div>
              ))}
            </dl>
          </Section>

          {/* 판정 근거 — 담당자가 결과를 신뢰하지 못하면 시스템을 우회한다 (§10) */}
          {diagnosis.breakdown.length > 0 && (
            <Section
              title="판정 근거"
              hint="담당자에게만 보입니다. 고객 화면과 결과지에는 점수가 나가지 않습니다."
            >
              <table className="grid-table">
                <thead>
                  <tr>
                    <th>문항</th>
                    <th className="text-right">점수</th>
                    <th className="text-right">배점</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnosis.breakdown.map((line) => (
                    <tr key={line.questionId}>
                      <td>
                        {line.label}
                        {line.usedDefault && (
                          <span className="pill ml-2">표시 안 됨 · 중립값</span>
                        )}
                      </td>
                      <td className="num text-right">{line.points}</td>
                      <td className="num text-right text-mute">{line.maxScore}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="font-medium">합계</td>
                    <td className="num text-right font-medium">{diagnosis.score}</td>
                    <td className="num text-right text-mute">100</td>
                  </tr>
                </tbody>
              </table>
            </Section>
          )}

          {strategy && (
            <Section title="대응되는 전략군">
              <div className="card p-5">
                <h3 className="font-serif text-lg font-semibold">{strategy.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-inksoft">{strategy.description}</p>
                <p className="mt-3 text-sm text-mute">{strategy.volatilityNote}</p>
              </div>
            </Section>
          )}

          {sections && (
            <Section
              title="결과지 미리보기"
              hint="서식은 고정입니다. 담당자가 문장을 고칠 수 없습니다 (PRD §9)."
            >
              <div className="grid gap-3">
                {sections.map((section) => (
                  <div key={section.page} className="card p-4">
                    <p className="eyebrow">
                      {section.page}쪽 · {section.title}
                    </p>
                    <ul className="mt-2 grid gap-1 text-sm leading-relaxed text-inksoft">
                      {section.lines.map((line, i) => (
                        <li key={`${section.page}-${i}`}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title="메모">
            <div className="grid gap-3">
              {inquiry.memos.length === 0 && <p className="text-sm text-mute">아직 없습니다.</p>}
              {inquiry.memos.map((m) => (
                <div key={m.at} className="border-l-2 border-hair pl-3.5">
                  <p className="text-sm leading-relaxed">{m.body}</p>
                  <p className="mt-1 text-xs text-mute">
                    {m.author} · {when(m.at)}
                  </p>
                </div>
              ))}
              <div className="mt-2 flex gap-2">
                <input
                  className="field"
                  placeholder="통화 내용이나 확인할 점을 남기세요"
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={!memo.trim() || busy}
                  onClick={() =>
                    act(async () => {
                      await api.addMemo(id, memo);
                      setMemo('');
                    }, '메모를 남겼습니다.')
                  }
                >
                  남기기
                </button>
              </div>
            </div>
          </Section>
        </div>

        {/* ---------------- 오른쪽 ---------------- */}
        <aside className="grid content-start gap-8">
          <Panel title="연락처">
            <Row label="이름" value={contact.name} />
            {contact.companyName && <Row label="법인" value={contact.companyName} />}
            {contact.title && <Row label="직위" value={contact.title} />}
            <Row label="이메일" value={contact.email} />
            <Row label="연락처" value={contact.phone} />
            <Row label="인증" value={when(inquiry.emailVerifiedAt)} />
          </Panel>

          <Panel title="동의">
            <Row
              label="필수 · 수집·이용"
              value={consents.privacy ? `동의 · ${when(consents.privacyAt!)}` : '없음'}
            />
            <Row
              label="선택 · 마케팅"
              value={consents.marketing ? `동의 · ${when(consents.marketingAt!)}` : '미동의'}
            />
          </Panel>

          <Panel title="상태">
            <div className="grid gap-2.5">
              <select
                className="field py-1.5 text-sm"
                value={inquiry.status}
                disabled={busy}
                onChange={(event) => {
                  const next = event.target.value as InquiryStatus;
                  if (next === 'closed') return; // 종료는 아래 사유와 함께
                  void act(
                    () => api.patchInquiry(id, { status: next }),
                    `${STATUS_LABEL[next]}(으)로 바꿨습니다.`,
                  );
                }}
              >
                {(Object.keys(STATUS_LABEL) as InquiryStatus[]).map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABEL[value]}
                  </option>
                ))}
              </select>

              <select
                className="field py-1.5 text-sm"
                value={inquiry.assignee ?? ''}
                disabled={busy}
                onChange={(event) =>
                  act(
                    () => api.patchInquiry(id, { assignee: event.target.value || null }),
                    '담당자를 바꿨습니다.',
                  )
                }
              >
                <option value="">담당자 미배정</option>
                <option value="김선우">김선우</option>
                <option value="이현주">이현주</option>
              </select>
            </div>

            {inquiry.status !== 'closed' ? (
              <div className="mt-4 border-t border-hairsoft pt-4">
                <p className="field-label">종료 처리</p>
                <select
                  className="field py-1.5 text-sm"
                  value={closeReason}
                  onChange={(event) => setCloseReason(event.target.value as CloseReason)}
                >
                  {(Object.keys(CLOSE_REASON_LABEL) as CloseReason[]).map((value) => (
                    <option key={value} value={value}>
                      {CLOSE_REASON_LABEL[value]}
                    </option>
                  ))}
                </select>
                <input
                  className="field mt-2 py-1.5 text-sm"
                  placeholder="사유 메모 (선택)"
                  value={closeNote}
                  onChange={(event) => setCloseNote(event.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm mt-2 w-full"
                  disabled={busy}
                  onClick={() =>
                    act(
                      () =>
                        api.patchInquiry(id, {
                          status: 'closed',
                          closeReason,
                          closeNote: closeNote.trim() || null,
                        }),
                      '종료 처리했습니다.',
                    )
                  }
                >
                  종료로 바꾸기
                </button>
                <p className="mt-2 text-xs leading-relaxed text-mute">
                  종료할 때는 사유가 반드시 남습니다.
                </p>
              </div>
            ) : (
              <div className="mt-4 border-t border-hairsoft pt-4 text-sm">
                <p className="font-medium">
                  종료 · {inquiry.closeReason ? CLOSE_REASON_LABEL[inquiry.closeReason] : '사유 없음'}
                </p>
                {inquiry.closeNote && (
                  <p className="mt-1 leading-relaxed text-mute">{inquiry.closeNote}</p>
                )}
              </div>
            )}
          </Panel>

          <Panel title="열람 기록">
            <ul className="grid gap-2.5 text-xs">
              {audit.slice(0, 8).map((entry, i) => (
                <li key={`${entry.at}-${i}`} className="leading-relaxed">
                  <span className="text-inksoft">{entry.actor}</span>{' '}
                  <span className="text-mute">{ACTION_LABEL[entry.action]}</span>
                  {entry.detail && <span className="text-mute"> · {entry.detail}</span>}
                  <br />
                  <span className="num text-mute">{when(entry.at)}</span>
                </li>
              ))}
              {audit.length === 0 && <li className="text-mute">아직 없습니다.</li>}
            </ul>
          </Panel>
        </aside>
      </div>
    </main>
  );
}

const ACTION_LABEL: Record<AuditEntry['action'], string> = {
  login: '로그인',
  viewList: '목록 열람',
  viewDetail: '상세 열람',
  sendReport: '결과지 발송',
  changeStatus: '상태 변경',
};

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-xs text-mute">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="eyebrow">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2 border-b border-hairsoft py-1.5 text-sm last:border-0">
      <span className="text-xs text-mute">{label}</span>
      <span className="break-all">{value}</span>
    </div>
  );
}
