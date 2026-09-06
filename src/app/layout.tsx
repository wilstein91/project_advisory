import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "투자 문의 | ○○투자자문",
  description:
    "어떤 투자가 맞는지 아직 모르셔도 괜찮습니다. 몇 가지 질문에 답하시면 필요한 것이 무엇인지 정리해 드립니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <head>
        {/*
          Noto 한글 웹폰트.
          next/font로 받으면 한글 서브셋 전체(수 MB)를 빌드마다 내려받아야 해서 링크로 받는다.
          아래 규칙은 Pages Router의 _document를 전제로 한 것이라 App Router의
          루트 레이아웃에는 해당하지 않는다 — 여기 둔 링크는 모든 페이지에 적용된다.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@500;600&family=Noto+Sans+KR:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
