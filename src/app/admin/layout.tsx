import Link from 'next/link';

/** 담당자 화면 공통 틀 (PRD §10) */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-hair bg-paper">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-baseline gap-4">
            <Link href="/admin/inquiries" className="font-serif text-base font-semibold">
              ○○투자자문 <span className="text-mute">문의 관리</span>
            </Link>
            <span className="pill">목업</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-mute">
            <Link href="/" className="hover:text-ink">
              고객 화면
            </Link>
            <Link href="/admin/login" className="hover:text-ink">
              로그인
            </Link>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
