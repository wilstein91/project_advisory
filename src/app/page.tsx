import Link from 'next/link';

/** 화면 01 — 문의 시작 (PRD §12) */
export default function Home() {
  return (
    <main className="min-h-dvh">
      <header className="border-b border-hair bg-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <span className="font-serif text-lg font-semibold tracking-tight">○○투자자문</span>
          <Link href="/admin/inquiries" className="text-xs text-mute hover:text-ink">
            담당자 화면
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 pt-20 pb-16">
        <p className="eyebrow">투자 문의</p>
        <h1 className="mt-5 max-w-3xl text-4xl leading-[1.25] sm:text-5xl">
          어떤 투자가 맞는지
          <br />
          아직 모르셔도 괜찮습니다.
        </h1>
        <p className="mt-7 max-w-xl text-lg text-inksoft">
          다섯에서 열 가지 질문에 답하시면, 지금 필요한 것이 무엇인지 저희가 정리해 드립니다.
          투자 용어를 아실 필요는 없습니다.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link href="/inquiry" className="btn btn-primary px-8 py-3.5 text-base">
            문의 시작하기
          </Link>
          <span className="text-sm text-mute">3분이면 끝납니다</span>
        </div>
      </section>

      <section className="border-y border-hair bg-paper">
        <div className="mx-auto grid max-w-5xl gap-px bg-hair sm:grid-cols-3">
          {[
            {
              head: '한 화면에 질문 하나',
              body: '길게 늘어선 양식 대신, 한 번에 하나씩만 여쭤봅니다. 언제든 뒤로 갈 수 있습니다.',
            },
            {
              head: '“잘 모르겠습니다”도 답입니다',
              body: '모든 질문에 모른다고 답할 수 있습니다. 그 답도 상담에 필요한 정보로 씁니다.',
            },
            {
              head: '결과를 정리해 보내드립니다',
              body: '답을 마치면 화면에서 바로 확인하시고, 상세한 결과지는 담당자가 확인 후 메일로 보내드립니다.',
            },
          ].map((item) => (
            <div key={item.head} className="bg-paper px-6 py-8">
              <h2 className="text-base font-semibold">{item.head}</h2>
              <p className="mt-2.5 text-sm leading-relaxed text-mute">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-5xl px-6 py-12 text-xs leading-relaxed text-mute">
        <p>
          <span className="pill pill-flag mr-2">확인 필요</span>
          [PLACEHOLDER §15-6] 상호·등록번호, 원금 손실 가능성 경고 문구가 이 자리에 들어갑니다.
        </p>
        <p className="mt-3">
          이 페이지의 안내는 참고용이며 투자권유가 아닙니다.{' '}
          <Link href="/privacy" className="underline underline-offset-2 hover:text-ink">
            개인정보처리방침
          </Link>
        </p>
      </footer>
    </main>
  );
}
