'use client';

import Link from 'next/link';
import type { AnswerMap, Question, SubmitResult } from '@/lib/api/types';

/**
 * 화면 07 · 08 — 결과 요약과 접수 완료 (PRD §8)
 *
 * 화면에 들어가는 것: 유형 이름, 답변 되짚기, 전략군 카드, 상담 때 짚을 점.
 * 들어가지 않는 것: 상품명, 예상 수익률, 자산 비중, 최대 낙폭, "추천드립니다".
 */
export function ResultStep({
  result,
  questions,
  answers,
}: {
  result: SubmitResult;
  questions: Question[];
  answers: AnswerMap;
}) {
  const { diagnosis, strategy } = result;
  const recap = buildRecap(questions, answers);

  return (
    <div className="pb-4">
      <div className="pill pill-good">접수 완료 · {result.inquiryId}</div>

      <h1 className="mt-5 text-2xl leading-snug sm:text-[1.9rem]">
        고객님은 <span className="text-brass">{diagnosis.tierLabel}</span>에 가깝습니다.
      </h1>
      <p className="mt-3 text-lg leading-relaxed text-inksoft">{diagnosis.tierSummary}</p>

      {/* 답변 되짚기 — 고객이 자기 상황을 문장으로 확인하는 자리 */}
      {recap.length > 0 && (
        <section className="mt-9">
          <h2 className="eyebrow">답해주신 내용</h2>
          <ul className="mt-3 grid gap-2">
            {recap.map((line) => (
              <li key={line.questionId} className="flex gap-3 text-[0.95rem] leading-relaxed">
                <span className="mt-2.5 size-1 flex-none rounded-full bg-brass" aria-hidden />
                <span>
                  <span className="text-mute">{line.short}</span>{' '}
                  <span className="font-medium">{line.answer}</span>
                  {line.isUnsure && <span className="pill ml-2">모르겠다고 답하심</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {diagnosis.belowMinimum && (
        <div className="note mt-7">
          <p>
            말씀하신 금액대는 일임 계약 기준에는 조금 못 미칩니다. 그래도 어떻게 접근하면 좋을지는
            담당자가 함께 안내드립니다.
          </p>
        </div>
      )}

      {/* 전략군 — 숫자 없음 */}
      <section className="mt-10">
        <h2 className="eyebrow">이런 종류의 투자가 맞습니다</h2>
        <div className="card mt-3 p-6">
          <h3 className="font-serif text-xl font-semibold">{strategy.name}</h3>
          <p className="mt-3 leading-relaxed text-inksoft">{strategy.description}</p>
          <dl className="mt-5 grid gap-4 border-t border-hairsoft pt-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium tracking-wide text-mute">오르내림의 정도</dt>
              <dd className="mt-1 text-sm leading-relaxed">{strategy.volatilityNote}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-mute">어떤 분에게</dt>
              <dd className="mt-1 text-sm leading-relaxed">{strategy.suitableFor}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* 다음 절차 */}
      <section className="mt-10 border-t border-hair pt-8">
        <h2 className="font-serif text-lg font-semibold">다음은 이렇게 진행됩니다</h2>
        <ol className="mt-4 grid gap-3">
          {[
            result.reportNotice,
            '결과지를 보시고 궁금한 점이 생기시면, 담당자가 통화로 함께 짚어드립니다.',
            '더 진행하고 싶으시면 그때 계약 절차를 안내드립니다. 지금 결정하실 필요는 없습니다.',
          ].map((line, index) => (
            <li key={line} className="flex gap-3.5 text-[0.95rem] leading-relaxed">
              <span className="num mt-0.5 flex-none text-xs text-brass">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-9 border-t border-hair pt-6 text-xs leading-relaxed text-mute">
        {result.disclaimer}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-mute">
        <span className="pill pill-flag mr-1.5">확인 필요</span>
        [PLACEHOLDER §15-6] 상호·등록번호와 원금 손실 가능성 경고 문구가 이 자리에 들어갑니다.
      </p>

      <Link href="/" className="btn btn-ghost mt-8">
        처음으로
      </Link>
    </div>
  );
}

/** 문항 문장을 짧은 꼬리표로 바꿔 되짚기 문장을 만든다. */
function buildRecap(questions: Question[], answers: AnswerMap) {
  const SHORT: Record<string, string> = {
    ind_timing: '쓰실 시점은',
    ind_purpose: '용도는',
    ind_amount: '맡기실 금액은',
    ind_loss_reaction: '손실이 났을 때는',
    ind_experience: '투자 경험은',
    ind_dependency: '생활과의 관계는',
    ind_withdrawal: '중도 인출 가능성은',
    corp_fund_type: '자금 성격은',
    corp_horizon: '맡기실 기간은',
    corp_amount: '규모는',
    corp_loss_tolerance: '평가손실은',
    corp_decision: '결정 절차는',
    corp_reporting: '보고 주기는',
  };

  return questions.flatMap((question) => {
    const short = SHORT[question.id];
    const value = answers[question.id];
    if (!short || typeof value !== 'string') return [];
    const choice = question.choices?.find((c) => c.value === value);
    if (!choice) return [];
    return [
      {
        questionId: question.id,
        short,
        answer: choice.label,
        isUnsure: choice.isUnsure === true,
      },
    ];
  });
}
