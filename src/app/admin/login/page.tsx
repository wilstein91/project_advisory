'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api, staffSession } from '@/lib/api/client';

/**
 * 화면 10 — 담당자 로그인 (PRD §10)
 *
 * 계정은 관리자가 직접 만듭니다. 자유 가입 경로는 만들지 않습니다.
 */
export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('kim@example.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await api.staffLogin(email, password);
      staffSession.save(data.token, data.staff);
      router.push('/admin/inquiries');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '로그인하지 못했습니다.');
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-sm px-6 py-20">
      <h1 className="text-2xl">담당자 로그인</h1>
      <p className="mt-2 text-sm text-mute">계정은 관리자에게 요청해 주세요.</p>

      <div className="mt-8 grid gap-4">
        <div>
          <label className="field-label" htmlFor="email">
            이메일
          </label>
          <input
            id="email"
            className="field"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="password">
            비밀번호
          </label>
          <input
            id="password"
            className="field"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && signIn()}
          />
        </div>

        {error && <p className="field-error">{error}</p>}

        <button type="button" className="btn btn-primary" disabled={busy} onClick={signIn}>
          {busy ? '확인 중…' : '로그인'}
        </button>
      </div>

      <div className="note mt-8">
        <p className="eyebrow">목업 안내</p>
        <p className="mt-1.5">
          비밀번호는 <strong className="num text-ink">advisory</strong> 입니다.
          로그인하지 않아도 담당자 화면은 열립니다.
        </p>
        <p className="mt-2 text-xs text-mute">
          계정 — kim@example.com (김선우), lee@example.com (이현주)
        </p>
      </div>
    </main>
  );
}
