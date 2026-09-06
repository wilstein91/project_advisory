import Link from 'next/link';

/**
 * 화면 09 — 개인정보처리방침 (PRD §12)
 *
 * 실제 문구는 §15-5 확인 후 채웁니다. 지금은 무엇을 받고 무엇을 받지 않는지만
 * 사실대로 적어둡니다 — 동의 화면에서 이 페이지로 연결되기 때문에 빈 페이지로 둘 수 없습니다.
 */
export default function PrivacyPage() {
  const rows = [
    ['수집 항목 (공통)', '이름, 이메일, 연락처, 문의 문항에 답하신 내용'],
    ['수집 항목 (법인)', '법인·단체명, 담당자 직위'],
    ['받지 않는 항목', '주민등록번호, 계좌번호, 주소, 생년월일'],
    ['이용 목적', '문의 접수, 진단 결과지 발송, 상담 연락'],
    ['보유 기간', '[PLACEHOLDER §15-5] 확정 전'],
    ['처리 위탁', '[PLACEHOLDER §15-5] 이메일 발송 대행사 상호와 위탁 업무'],
    ['선택 동의', '투자 관련 정보 수신. 동의하지 않으셔도 문의는 정상 접수됩니다.'],
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="btn btn-quiet mb-8 text-sm">
        ← 처음으로
      </Link>

      <h1 className="text-3xl">개인정보처리방침</h1>
      <p className="mt-4 text-[0.95rem] leading-relaxed text-inksoft">
        투자 문의 페이지에서 받는 정보와 쓰는 방법입니다.
      </p>

      <div className="note note-flag mt-8">
        <p>
          이 페이지의 문구는 아직 확정되지 않았습니다. PRD §15-5 확인이 끝나면 정식 문안으로
          바꿉니다. 아래 표는 현재 화면이 실제로 받는 항목만 사실대로 적은 것입니다.
        </p>
      </div>

      <dl className="mt-10 divide-y divide-hairsoft border-y border-hair">
        {rows.map(([term, description]) => (
          <div key={term} className="grid gap-1 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
            <dt className="text-sm font-medium text-mute">{term}</dt>
            <dd className="text-[0.95rem] leading-relaxed">{description}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-8 text-sm text-mute">개인정보 관련 문의 — privacy@example.com</p>
    </main>
  );
}
