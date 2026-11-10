'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { api } from '@/lib/api';
import AuthShell from '@/components/auth/AuthShell';
import OtpInput from '@/components/auth/OtpInput';
import { useCooldown } from '@/components/auth/useCooldown';
import { PasswordField, PasswordStrength, passwordIsStrong } from '@/components/auth/PasswordField';
import { ErrorAlert, SuccessAlert } from '@/components/auth/Alert';

function ResetForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(params.get('sent') ? 'If that email has an account, a 6-digit code is on its way.' : '');
  const [done, setDone] = useState(false);
  const cooldown = useCooldown(params.get('sent') ? 60 : 0);

  const strong = passwordIsStrong(password);
  const matches = password.length > 0 && password === confirm;

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setNotice('');
    if (code.length !== 6) return setError('Enter the 6-digit code from your email.');
    if (!strong) return setError('Please choose a stronger password that meets every requirement.');
    if (!matches) return setError('The two passwords do not match.');

    setLoading(true);
    try {
      await api.auth.resetPassword({ email: email.trim(), code, new_password: password });
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not reset your password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError('');
    try {
      await api.auth.forgotPassword({ email: email.trim() });
      setNotice('If that email has an account, a new code is on its way.');
      cooldown.start(60);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not resend the code.');
    }
  }

  if (done) {
    return (
      <div className="text-center space-y-4 py-2">
        <div className="w-14 h-14 rounded-full bg-[#DDF8E8] text-[#16A36A] mx-auto flex items-center justify-center">
          <CheckCircle2 size={28} />
        </div>
        <h2 className="font-extrabold text-lg text-[#10251D]">Password updated</h2>
        <p className="text-sm text-[#64748B] leading-relaxed">
          You can now sign in with your new password. We also emailed you a confirmation.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 w-full bg-[#16A36A] hover:bg-[#128A58] text-white py-3 rounded-xl text-sm font-bold transition-all shadow-sm"
        >
          Go to sign in <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleReset} className="space-y-5">
      {notice && <SuccessAlert>{notice}</SuccessAlert>}
      {error && <ErrorAlert>{error}</ErrorAlert>}

      <div>
        <label className="block text-xs font-bold text-[#64748B] mb-1.5" htmlFor="email">
          Account email
        </label>
        <div className="relative">
          <Mail size={16} className="absolute left-3.5 top-3.5 text-gray-400" aria-hidden />
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-10 pr-3.5 py-3 bg-white border border-[#D9E2DC] rounded-xl text-sm outline-none focus:border-[#16A36A] focus:ring-2 focus:ring-[#16A36A]/15"
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="block text-xs font-bold text-[#64748B]">6-digit code from your email</p>
        <OtpInput value={code} onChange={setCode} disabled={loading} />
        <p className="text-[11px] text-[#64748B] text-center">
          Didn&apos;t get it? Check spam, or{' '}
          <button
            type="button"
            onClick={resend}
            disabled={cooldown.left > 0 || !email}
            className="text-[#16A36A] font-bold hover:underline disabled:text-[#94A3B8] disabled:no-underline"
          >
            {cooldown.left > 0 ? `resend in ${cooldown.left}s` : 'resend the code'}
          </button>
        </p>
      </div>

      <div className="space-y-3">
        <PasswordField id="password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" />
        <PasswordStrength password={password} />
      </div>

      <div>
        <PasswordField id="confirm" label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        {confirm.length > 0 && !matches && <p className="text-[11px] text-red-600 mt-1.5">Passwords don&apos;t match yet.</p>}
      </div>

      <button
        type="submit"
        disabled={loading || code.length !== 6 || !strong || !matches}
        className="w-full bg-[#16A36A] hover:bg-[#128A58] disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Updating password...
          </>
        ) : (
          <>
            Reset password <ArrowRight size={16} />
          </>
        )}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the code we emailed you and choose a new password."
      footer={
        <Link href="/login" className="text-[#16A36A] font-bold hover:underline">
          Back to sign in
        </Link>
      }
    >
      <Suspense fallback={<div className="text-center py-6 text-xs text-gray-400">Loading...</div>}>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
