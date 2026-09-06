'use client';

import type { InquiryStatus, RiskTier, Segment } from '@/lib/api/types';

/** 상태 이름은 서버(config)가 주지만, 목록에서 매번 config를 기다리지 않도록 여기 둔다. */
export const STATUS_LABEL: Record<InquiryStatus, string> = {
  new: '신규',
  reviewing: '검토중',
  reportSent: '결과지 발송',
  consulting: '상담 진행',
  closed: '종료',
};

export const TIER_LABEL: Record<RiskTier, string> = {
  stable: '안정형',
  stableSeeking: '안정추구형',
  neutral: '위험중립형',
  active: '적극투자형',
  aggressive: '공격투자형',
};

export const CLOSE_REASON_LABEL = {
  contracted: '계약',
  belowMinimum: '금액 미달',
  unreachable: '연락 불가',
  customerHold: '고객 보류',
  other: '기타',
} as const;

export function StatusPill({ status }: { status: InquiryStatus }) {
  const tone =
    status === 'new' ? 'pill-brass' : status === 'closed' ? 'pill' : status === 'consulting' ? 'pill-good' : 'pill';
  return <span className={`pill ${tone}`}>{STATUS_LABEL[status]}</span>;
}

export function SegmentPill({ segment }: { segment: Segment }) {
  return <span className="pill">{segment === 'individual' ? '개인' : '법인'}</span>;
}

/** 며칠 전인지. 담당자는 절대 시각보다 경과 시간으로 판단한다. */
export function ago(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR');
}

export function when(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
