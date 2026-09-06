import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase 연결 — 서버 전용
 *
 * service_role 키를 씁니다. 이 키는 RLS를 통째로 우회하므로 **브라우저에 절대 나가면
 * 안 됩니다.** 그래서 이름에 NEXT_PUBLIC_을 붙이지 않았고, 파일 맨 위에 'server-only'를
 * 넣어 클라이언트 컴포넌트에서 실수로 import하면 빌드가 깨지게 해뒀습니다.
 *
 * 브라우저는 Supabase를 직접 부르지 않습니다. 항상 /api/v1을 거칩니다.
 */

let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase 설정이 없습니다. .env.local에 SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 넣어주세요. (.env.example 참고)',
    );
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'advisory-inquiry' } },
  });
  return cached;
}

/** 설정이 갖춰졌는지. 화면에 안내를 띄울 때 쓴다. */
export function isConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
