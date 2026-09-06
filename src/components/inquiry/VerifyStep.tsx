'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 화면 06 — 이메일 인증 (PRD §4-5)
 *
 * 인증을 결과 바로 앞에 두는 이유: 장벽이 아니라 결과를 여는 열쇠처럼 느끼게 하려는 것.
 */
export function VerifyStep({
  email,
  mockCode,
  error,
  busy,
  onConfirm,
  onResend,
}: {
  email: string;
  /** 목업 서버만 내려주는 값. 실제 백엔드에서는 undefined다. */
  mockCode?: string;
  error: string | null;
  busy: boolean;
  onConfirm: (code: string) => void;
  onResend: () => void;
}) {
  const [code, setCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = () => {
    if (code.length === 6 && !busy) onConfirm(code);
  };

  return (
    <div>
      <h1 className="text-2xl leading-snug sm:text-[1.75rem]">
        메일로 숫자 여섯 자리를 보내드렸습니다.
      </h1>
      <p className="mt-3 text-[0.95rem] text-mute">
        <span className="text-ink">{email}</span> 으로 보냈습니다. 받으신 숫자를 입력해 주세요.
      </p>

      <div className="mt-8 max-w-xs">
        <label className="field-label" htmlFor="verify-code">
          인증번호
        </label>
        <input
          id="verify-code"
          ref={inputRef}
          className="field num text-center text-2xl tracking-[0.5em]"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          aria-invalid={Boolean(error)}
          onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(event) => event.key === 'Enter' && submit()}
        />
        {error && <p className="field-error">{error}</p>}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <button type="button" className="btn btn-primary" disabled={code.length !== 6 || busy} onClick={submit}>
          {busy ? '확인 중…' : '확인하고 결과 보기'}
        </button>
        <button type="button" className="btn btn-quiet text-sm" disabled={busy} onClick={onResend}>
          다시 받기
        </button>
      </div>

      {mockCode && (
        <div className="note mt-8 max-w-lg">
          <p className="eyebrow">목업 안내</p>
          <p className="mt-1.5">
            메일 발송은 아직 붙지 않았습니다. 인증번호는{' '}
            <strong className="num text-ink">{mockCode}</strong> 입니다.
          </p>
          <p className="mt-2 text-[0.82rem] text-mute">
            실제 백엔드는 인증번호를 응답에 넣지 않습니다 (api-spec.md §4.5).
          </p>
        </div>
      )}
    </div>
  );
}
