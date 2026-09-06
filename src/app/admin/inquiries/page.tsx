'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { SegmentPill, StatusPill, TIER_LABEL, ago } from '@/components/admin/ui';
import { ApiError, api } from '@/lib/api/client';
import type { InquiryListResponse, InquiryStatus, Segment } from '@/lib/api/types';

/**
 * 화면 11 — 문의 목록 (PRD §10)
 *
 * 정렬은 서버가 정한다. 발송 기한 초과 건이 맨 위로 오고, 프론트엔드는 다시 정렬하지 않는다.
 */

const TABS: { value: InquiryStatus | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'new', label: '신규' },
  { value: 'reviewing', label: '검토중' },
  { value: 'reportSent', label: '결과지 발송' },
  { value: 'consulting', label: '상담 진행' },
  { value: 'closed', label: '종료' },
];

export default function InquiryListPage() {
  const [status, setStatus] = useState<InquiryStatus | 'all'>('all');
  const [segment, setSegment] = useState<Segment | ''>('');
  const [query, setQuery] = useState('');
  const [onlyUnsure, setOnlyUnsure] = useState(false);
  const [onlyBelow, setOnlyBelow] = useState(false);

  const [data, setData] = useState<InquiryListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // 검색어는 입력이 멈춘 뒤에 보낸다. 그 전까지는 이전 목록을 그대로 둔다.
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      api
        .listInquiries({
          status: status === 'all' ? undefined : status,
          segment: segment || undefined,
          q: query.trim() || undefined,
          minUnsure: onlyUnsure ? 3 : undefined,
          belowMinimum: onlyBelow ? true : undefined,
        })
        .then((response) => {
          if (!cancelled) setData(response);
        })
        .catch((cause) => {
          if (!cancelled) setError(cause instanceof ApiError ? cause.message : '목록을 불러오지 못했습니다.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [status, segment, query, onlyUnsure, onlyBelow]);

  const overdue = data?.items.filter((row) => row.reportOverdue).length ?? 0;

  return (
    <main className="mx-auto max-w-6xl px-6 py-9">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">문의 목록</h1>
          <p className="mt-1.5 text-sm text-mute">
            {data ? `${data.total}건` : '불러오는 중…'}
            {overdue > 0 && (
              <span className="ml-2 text-flag">· 발송 기한을 넘긴 건 {overdue}건이 맨 위에 있습니다</span>
            )}
          </p>
        </div>
        <input
          className="field max-w-64"
          placeholder="이름 · 회사명 · 접수번호"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {/* 상태 탭 */}
      <div className="mt-7 flex flex-wrap gap-1 border-b border-hair">
        {TABS.map((tab) => {
          const count = tab.value === 'all' ? data?.total : data?.counts[tab.value];
          const active = status === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatus(tab.value)}
              className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm transition-colors ${
                active
                  ? 'border-brass font-medium text-ink'
                  : 'border-transparent text-mute hover:text-ink'
              }`}
            >
              {tab.label}
              {count !== undefined && <span className="num ml-1.5 text-xs text-mute">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* 보조 필터 */}
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <select
          className="field w-auto py-1.5 text-sm"
          value={segment}
          onChange={(event) => setSegment(event.target.value as Segment | '')}
        >
          <option value="">개인 · 법인 전체</option>
          <option value="individual">개인만</option>
          <option value="corporate">법인만</option>
        </select>
        <Toggle checked={onlyUnsure} onChange={setOnlyUnsure} label="모름 응답 3건 이상" />
        <Toggle checked={onlyBelow} onChange={setOnlyBelow} label="금액 미달만" />
      </div>

      {error && <div className="note note-flag mt-8">{error}</div>}

      <div className="card mt-6 overflow-x-auto">
        <table className="grid-table min-w-[62rem]">
          <thead>
            <tr>
              <th>접수</th>
              <th>구분</th>
              <th>이름</th>
              <th>유형</th>
              <th>금액</th>
              <th>모름</th>
              <th>상태</th>
              <th>담당자</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-mute">
                  불러오는 중…
                </td>
              </tr>
            )}
            {data?.items.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-mute">
                  조건에 맞는 문의가 없습니다.
                </td>
              </tr>
            )}
            {data?.items.map((row) => (
              <tr key={row.id} className="cursor-pointer">
                <td className="whitespace-nowrap">
                  <Link href={`/admin/inquiries/${row.id}`} className="block">
                    <span className="num block text-xs text-mute">{row.id}</span>
                    <span className="text-xs text-inksoft">{ago(row.submittedAt)}</span>
                    {row.reportOverdue && <span className="pill pill-flag mt-1 block w-fit">기한 초과</span>}
                  </Link>
                </td>
                <td>
                  <Link href={`/admin/inquiries/${row.id}`} className="block">
                    <SegmentPill segment={row.segment} />
                  </Link>
                </td>
                <td>
                  <Link href={`/admin/inquiries/${row.id}`} className="block">
                    <span className="font-medium">{row.companyName ?? row.name}</span>
                    {row.companyName && <span className="ml-1.5 text-xs text-mute">{row.name}</span>}
                    {row.freeTextPreview && (
                      <span className="mt-0.5 block max-w-80 truncate text-xs text-mute">
                        “{row.freeTextPreview}”
                      </span>
                    )}
                  </Link>
                </td>
                <td className="whitespace-nowrap">
                  <Link href={`/admin/inquiries/${row.id}`} className="block">
                    {TIER_LABEL[row.tier]}
                  </Link>
                </td>
                <td className="whitespace-nowrap">
                  <Link href={`/admin/inquiries/${row.id}`} className="block">
                    <span className="text-xs">{row.amountLabel}</span>
                    {row.belowMinimum && <span className="pill pill-flag ml-1.5">미달</span>}
                  </Link>
                </td>
                <td className="num text-center">
                  <Link href={`/admin/inquiries/${row.id}`} className="block">
                    {row.unsureCount > 0 ? (
                      <span className={row.unsureCount >= 3 ? 'text-flag' : 'text-inksoft'}>
                        {row.unsureCount}
                      </span>
                    ) : (
                      <span className="text-mute">–</span>
                    )}
                  </Link>
                </td>
                <td>
                  <Link href={`/admin/inquiries/${row.id}`} className="block">
                    <StatusPill status={row.status} />
                  </Link>
                </td>
                <td className="whitespace-nowrap text-xs">
                  <Link href={`/admin/inquiries/${row.id}`} className="block">
                    {row.assignee ?? <span className="text-flag">미배정</span>}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-5 text-xs leading-relaxed text-mute">
        모름 응답이 많은 건은 설명이 더 필요한 고객입니다. 상담 시간을 넉넉히 잡으세요.
      </p>
    </main>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-inksoft">
      <input
        type="checkbox"
        className="size-3.5 accent-[var(--color-ink)]"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}
