'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, ArrowRight, Sparkles, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import AuthShell from '@/components/auth/AuthShell';
import { PasswordField } from '@/components/auth/PasswordField';
import { ErrorAlert } from '@/components/auth/Alert';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginAsDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.push('/dashboard');
    } catch (err: unknown) {
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        // Correct password, but the email was never confirmed: a fresh code was just sent.
        router.push(`/verify-email?email=${encodeURIComponent(email.trim())}&sent=1`);
        return;
      }
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDemoLogin() {
    setError('');
    setLoading(true);
    try {
      await loginAsDemo();
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in with your email and password."
      footer={
        <>
          New to FinWise AI?{' '}
          <Link href="/register" className="text-[#16A36A] font-bold hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      {error && <ErrorAlert>{error}</ErrorAlert>}

      <form onSubmit={handleLogin} className="space-y-4" noValidate={false}>
        <div>
          <label className="block text-xs font-bold text-[#64748B] mb-1.5" htmlFor="email">
            Email address
          </label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-3.5 text-gray-400" aria-hidden />
            <input
              id="email"
              type="email"
              required
              autoComplete="username"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-3.5 py-3 bg-white border border-[#D9E2DC] rounded-xl text-sm outline-none focus:border-[#16A36A] focus:ring-2 focus:ring-[#16A36A]/15"
              placeholder="name@example.com"
            />
          </div>
        </div>

        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          rightLabel={
            <Link href={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="text-[11px] text-[#16A36A] hover:underline font-semibold">
              Forgot password?
            </Link>
          }
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[#16A36A] hover:bg-[#128A58] disabled:opacity-60 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" /> Signing in...
            </>
          ) : (
            <>
              Sign in <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      <div className="relative py-1">
        <div className="absolute inset-0 flex items-center" aria-hidden>
          <div className="w-full border-t border-gray-100" />
        </div>
        <p className="relative text-center">
          <span className="bg-white px-3 text-[11px] text-[#94A3B8]">or just look around</span>
        </p>
      </div>

      <button
        type="button"
        onClick={handleDemoLogin}
        disabled={loading}
        className="w-full bg-[#F0FDF4] hover:bg-[#DDF8E8] disabled:opacity-60 text-[#10251D] border border-[#16A36A]/30 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
      >
        <Sparkles size={15} className="text-[#16A36A]" />
        Try the demo account
      </button>
    </AuthShell>
  );
}
