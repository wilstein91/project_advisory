'use client';

import type { AnswerValue, Choice, Question } from '@/lib/api/types';

/**
 * 화면 03 — 질문 (PRD §4-3)
 *
 * 한 화면에 문항 하나. 모든 문항에 "잘 모르겠습니다"가 있고, 그것도 답으로 센다.
 */

/** "없습니다" / "잘 모르겠습니다"는 다른 항목과 같이 고를 수 없다. */
const EXCLUSIVE = new Set(['none', 'unsure']);

export function QuestionStep({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}) {
  const selectedNotice = noticeFor(question, value);

  return (
    <div>
      <h1 className="text-2xl leading-snug sm:text-[1.75rem]">{question.prompt}</h1>
      {/* 문항이 자체 보조 문구를 갖고 있으면 그것만 쓴다 — 같은 말을 두 번 하지 않는다 */}
      {question.help ? (
        <p className="mt-3 text-[0.95rem] text-mute">{question.help}</p>
      ) : (
        question.optional && (
          <p className="mt-3 text-[0.95rem] text-mute">답하지 않고 넘어가셔도 됩니다.</p>
        )
      )}

      <div className="mt-8">
        {question.kind === 'text' ? (
          <TextInput question={question} value={typeof value === 'string' ? value : ''} onChange={onChange} />
        ) : question.kind === 'multi' ? (
          <MultiSelect question={question} value={Array.isArray(value) ? value : []} onChange={onChange} />
        ) : (
          <SingleSelect question={question} value={typeof value === 'string' ? value : null} onChange={onChange} />
        )}
      </div>

      {selectedNotice && (
        <div className="note mt-5">
          <p>{selectedNotice}</p>
          <p className="mt-2 text-[0.82rem] text-mute">
            안내일 뿐이니 그대로 진행하셔도 됩니다.
          </p>
        </div>
      )}
    </div>
  );
}

function noticeFor(question: Question, value: AnswerValue | undefined): string | null {
  if (typeof value !== 'string') return null;
  return question.choices?.find((c) => c.value === value)?.notice ?? null;
}

function SingleSelect({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string | null;
  onChange: (value: AnswerValue) => void;
}) {
  return (
    <div className="grid gap-2.5">
      {question.choices?.map((choice) => (
        <button
          key={choice.value}
          type="button"
          className="choice"
          data-kind="single"
          data-selected={value === choice.value}
          aria-pressed={value === choice.value}
          onClick={() => onChange(choice.value)}
        >
          <span className="choice-mark" aria-hidden />
          <span>{choice.label}</span>
        </button>
      ))}
    </div>
  );
}

function MultiSelect({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string[];
  onChange: (value: AnswerValue) => void;
}) {
  const toggle = (choice: Choice) => {
    const isOn = value.includes(choice.value);
    if (isOn) {
      onChange(value.filter((v) => v !== choice.value));
      return;
    }
    // 배타 선택지를 고르면 나머지를 지우고, 다른 것을 고르면 배타 선택지를 지운다
    if (EXCLUSIVE.has(choice.value)) {
      onChange([choice.value]);
      return;
    }
    onChange([...value.filter((v) => !EXCLUSIVE.has(v)), choice.value]);
  };

  return (
    <div className="grid gap-2.5">
      <p className="text-sm text-mute">해당되는 것을 모두 골라주세요.</p>
      {question.choices?.map((choice) => (
        <button
          key={choice.value}
          type="button"
          className="choice"
          data-kind="multi"
          data-selected={value.includes(choice.value)}
          aria-pressed={value.includes(choice.value)}
          onClick={() => toggle(choice)}
        >
          <span className="choice-mark" aria-hidden />
          <span>{choice.label}</span>
        </button>
      ))}
    </div>
  );
}

function TextInput({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: string;
  onChange: (value: AnswerValue) => void;
}) {
  const max = question.maxLength ?? 500;
  return (
    <div>
      <textarea
        className="field min-h-40 resize-y leading-relaxed"
        maxLength={max}
        value={value}
        placeholder="예: 퇴직이 7년쯤 남았습니다. 그때까지 크게 흔들리지 않게 굴렸으면 합니다."
        onChange={(event) => onChange(event.target.value)}
      />
      <p className="num mt-2 text-right text-xs text-mute">
        {value.length} / {max}
      </p>
    </div>
  );
}
