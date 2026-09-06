'use client';

import type { Segment } from '@/lib/api/types';

/** 화면 02 — 개인 / 법인 구분 (PRD §4-2) */
export function SegmentStep({ onSelect }: { onSelect: (segment: Segment) => void }) {
  const options: { value: Segment; label: string; body: string }[] = [
    {
      value: 'individual',
      label: '개인',
      body: '본인 또는 가족의 돈을 맡기시려는 경우입니다.',
    },
    {
      value: 'corporate',
      label: '법인 · 단체',
      body: '회사 여유자금, 퇴직연금, 재단이나 조합의 자금인 경우입니다.',
    },
  ];

  return (
    <div>
      <h1 className="text-2xl leading-snug sm:text-[1.75rem]">
        먼저, 어느 쪽에 해당하시나요?
      </h1>
      <p className="mt-3 text-[0.95rem] text-mute">
        여쭤볼 내용이 달라서 처음에 한 번만 나눕니다.
      </p>

      <div className="mt-8 grid gap-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className="choice flex-col items-start gap-1.5 py-5"
            onClick={() => onSelect(option.value)}
          >
            <span className="font-serif text-lg font-semibold">{option.label}</span>
            <span className="text-sm leading-relaxed text-mute">{option.body}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
