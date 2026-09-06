import 'server-only';
import { randomInt, randomUUID } from 'node:crypto';
import { db } from './client';
import { loadCatalog } from './catalog';

/**
 * 이메일 인증 — api-spec.md §4.5, §4.6
 *
 * 코드와 토큰을 DB에 둡니다. 메모리에 두면 서버가 여러 대로 늘어났을 때
 * 발급한 서버와 확인하는 서버가 달라져 "방금 받은 번호가 없는 번호"가 됩니다.
 *
 * 난수는 Math.random()이 아니라 node:crypto를 씁니다. 예측 가능한 인증번호는
 * 인증이 아닙니다.
 */

const TOKEN_TTL_SECONDS = 30 * 60;

const norm = (email: string) => email.trim().toLowerCase();

export interface IssuedCode {
  expiresInSeconds: number;
  maxAttempts: number;
  /** 메일 발송을 아직 붙이지 않아서 화면에 띄운다. 실제 서비스에서는 절대 내보내지 않는다. */
  devCode: string;
}

export async function issueCode(email: string): Promise<IssuedCode> {
  const catalog = await loadCatalog();
  const { codeLength, ttlSeconds, maxAttempts } = catalog.config.verification;

  const max = 10 ** codeLength;
  const code = String(randomInt(0, max)).padStart(codeLength, '0');
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const { error } = await db()
    .from('email_verifications')
    .upsert({ email: norm(email), code, attempts: 0, expires_at: expiresAt });

  if (error) throw new Error(`인증번호를 만들지 못했습니다: ${error.message}`);

  return { expiresInSeconds: ttlSeconds, maxAttempts, devCode: code };
}

export type ConfirmResult =
  | { ok: true; token: string; expiresInSeconds: number }
  | {
      ok: false;
      code: 'VERIFICATION_FAILED' | 'VERIFICATION_LOCKED';
      message: string;
      attemptsLeft: number;
    };

export async function confirmCode(email: string, input: string): Promise<ConfirmResult> {
  const catalog = await loadCatalog();
  const maxAttempts = catalog.config.verification.maxAttempts;
  const key = norm(email);
  const client = db();

  const { data } = await client
    .from('email_verifications')
    .select('code, attempts, expires_at')
    .eq('email', key)
    .maybeSingle();

  const record = data as { code: string; attempts: number; expires_at: string } | null;

  if (!record || new Date(record.expires_at).getTime() < Date.now()) {
    await client.from('email_verifications').delete().eq('email', key);
    return {
      ok: false,
      code: 'VERIFICATION_LOCKED',
      message: '인증 시간이 지났습니다. 번호를 다시 받아주세요.',
      attemptsLeft: 0,
    };
  }

  if (record.attempts >= maxAttempts) {
    return {
      ok: false,
      code: 'VERIFICATION_LOCKED',
      message: '입력 횟수를 넘었습니다. 번호를 다시 받아주세요.',
      attemptsLeft: 0,
    };
  }

  if (record.code !== input.trim()) {
    const attempts = record.attempts + 1;
    await client.from('email_verifications').update({ attempts }).eq('email', key);
    const left = maxAttempts - attempts;
    return left > 0
      ? {
          ok: false,
          code: 'VERIFICATION_FAILED',
          message: `숫자가 맞지 않습니다. ${left}번 더 입력할 수 있습니다.`,
          attemptsLeft: left,
        }
      : {
          ok: false,
          code: 'VERIFICATION_LOCKED',
          message: '입력 횟수를 넘었습니다. 번호를 다시 받아주세요.',
          attemptsLeft: 0,
        };
  }

  await client.from('email_verifications').delete().eq('email', key);

  const token = `vt_${randomUUID().replace(/-/g, '')}`;
  const expiresAt = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString();
  const { error } = await client
    .from('verification_tokens')
    .insert({ token, email: key, expires_at: expiresAt });

  if (error) throw new Error(`인증 토큰을 만들지 못했습니다: ${error.message}`);
  return { ok: true, token, expiresInSeconds: TOKEN_TTL_SECONDS };
}

/** 접수 시 토큰을 확인하고 소진한다. 한 토큰으로 두 번 접수할 수 없다. */
export async function consumeToken(token: string | null, email: string): Promise<boolean> {
  if (!token) return false;
  const client = db();

  const { data } = await client
    .from('verification_tokens')
    .select('email, expires_at')
    .eq('token', token)
    .maybeSingle();

  const record = data as { email: string; expires_at: string } | null;
  if (!record) return false;

  await client.from('verification_tokens').delete().eq('token', token);

  if (new Date(record.expires_at).getTime() < Date.now()) return false;
  return record.email === norm(email);
}

/* ------------------------------------------------------------------ *
 * 담당자 (PRD §10)
 * ------------------------------------------------------------------ */

export interface StaffRecord {
  id: string;
  name: string;
  email: string;
  role: 'manager' | 'admin';
}

export async function findStaffById(id: string): Promise<StaffRecord | null> {
  const { data } = await db()
    .from('staff')
    .select('id, name, email, role')
    .eq('id', id)
    .maybeSingle();
  return (data as StaffRecord) ?? null;
}

export async function findStaffByEmail(email: string): Promise<StaffRecord | null> {
  const { data } = await db()
    .from('staff')
    .select('id, name, email, role')
    .eq('email', norm(email))
    .maybeSingle();
  return (data as StaffRecord) ?? null;
}
