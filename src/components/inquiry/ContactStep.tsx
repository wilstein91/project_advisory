'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Segment } from '@/lib/api/types';

/**
 * 화면 05 — 연락처와 동의 (PRD §4-4, §11)
 *
 * 필수 동의와 선택 동의를 한 체크박스로 묶지 않는다. 흔한 실수이자 흔한 지적 사항이다.
 * 주민등록번호·계좌번호·주소·생년월일은 받지 않는다.
 */

export interface ContactForm {
  name: string;
  email: string;
  phone: string;
  companyName: string;
  title: string;
  privacy: boolean;
  marketing: boolean;
}

export const emptyContact: ContactForm = {
  name: '',
  email: '',
  phone: '',
  companyName: '',
  title: '',
  privacy: false,
  marketing: false,
};

export function ContactStep({
  segment,
  form,
  onChange,
  serverFields,
}: {
  segment: Segment;
  form: ContactForm;
  onChange: (form: ContactForm) => void;
  serverFields?: Record<string, string>;
}) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const isCorporate = segment === 'corporate';

  const errors: Record<string, string> = { ...serverFields };
  if (touched.name && !form.name.trim()) errors.name = '이름을 입력해 주세요.';
  if (touched.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errors.email = '이메일 주소를 다시 확인해 주세요.';
  if (touched.phone && form.phone.replace(/\D/g, '').length < 9)
    errors.phone = '연락처를 다시 확인해 주세요.';
  if (isCorporate && touched.companyName && !form.companyName.trim())
    errors.companyName = '법인명을 입력해 주세요.';
  if (isCorporate && touched.title && !form.title.trim())
    errors.title = '직위를 입력해 주세요.';

  const set = <K extends keyof ContactForm>(key: K, value: ContactForm[K]) =>
    onChange({ ...form, [key]: value });

  const field = (
    key: keyof ContactForm,
    label: string,
    props: React.InputHTMLAttributes<HTMLInputElement> = {},
  ) => (
    <div>
      <label className="field-label" htmlFor={key}>
        {label}
      </label>
      <input
        id={key}
        className="field"
        value={String(form[key] ?? '')}
        aria-invalid={Boolean(errors[key])}
        onBlur={() => setTouched((t) => ({ ...t, [key]: true }))}
        onChange={(event) => set(key, event.target.value as never)}
        {...props}
      />
      {errors[key] && <p className="field-error">{errors[key]}</p>}
    </div>
  );

  return (
    <div>
      <h1 className="text-2xl leading-snug sm:text-[1.75rem]">
        결과를 어디로 보내드릴까요?
      </h1>
      <p className="mt-3 text-[0.95rem] text-mute">
        답해주신 내용을 정리한 결과지를 이메일로 보내드립니다.
      </p>

      <div className="mt-8 grid gap-5">
        {isCorporate && (
          <div className="grid gap-5 sm:grid-cols-2">
            {field('companyName', '법인 · 단체명')}
            {field('title', '직위')}
          </div>
        )}
        {field('name', isCorporate ? '담당자 이름' : '이름')}
        {field('email', '이메일', { type: 'email', inputMode: 'email', placeholder: 'name@example.com' })}
        {field('phone', '연락처', { type: 'tel', inputMode: 'tel', placeholder: '010-0000-0000' })}
      </div>

      <div className="mt-8 grid gap-3 border-t border-hair pt-6">
        <Consent
          checked={form.privacy}
          onChange={(v) => set('privacy', v)}
          required
          label={
            <>
              <strong className="font-semibold">(필수)</strong> 개인정보 수집·이용에 동의합니다.{' '}
              <Link href="/privacy" target="_blank" className="underline underline-offset-2">
                내용 보기
              </Link>
            </>
          }
        />
        <Consent
          checked={form.marketing}
          onChange={(v) => set('marketing', v)}
          label={
            <>
              <span className="text-mute">(선택)</span> 투자 관련 정보를 메일로 받아보겠습니다.
            </>
          }
        />
        <p className="mt-1 text-xs leading-relaxed text-mute">
          선택 항목에 동의하지 않으셔도 문의는 정상 접수됩니다. 주민등록번호, 계좌번호, 주소는
          받지 않습니다.
        </p>
      </div>
    </div>
  );
}

function Consent({
  checked,
  onChange,
  label,
  required,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: React.ReactNode;
  required?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
      <input
        type="checkbox"
        className="mt-1 size-4 flex-none accent-[var(--color-ink)]"
        checked={checked}
        required={required}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
