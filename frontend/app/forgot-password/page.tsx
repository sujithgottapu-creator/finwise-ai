'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import AuthShell from '@/components/auth/AuthShell';
import { ErrorAlert } from '@/components/auth/Alert';

function ForgotForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || !email.trim()) return;
    setError('');
    setLoading(true);
    try {
      await api.auth.forgotPassword({ email: email.trim() });
      // Same next step whether or not the account exists, so nothing is revealed.
      router.push(`/reset-password?email=${encodeURIComponent(email.trim())}&sent=1`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-10 pr-3.5 py-3 bg-white border border-[#D9E2DC] rounded-xl text-sm outline-none focus:border-[#16A36A] focus:ring-2 focus:ring-[#16A36A]/15"
            placeholder="name@example.com"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#16A36A] hover:bg-[#128A58] disabled:opacity-60 text-white py-3 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={16} className="animate-spin" /> Sending code...
          </>
        ) : (
          <>
            Email me a code <ArrowRight size={16} />
          </>
        )}
      </button>
    </form>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a one-time code to reset it."
      footer={
        <>
          Remembered it?{' '}
          <Link href="/login" className="text-[#16A36A] font-bold hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <Suspense fallback={<div className="text-center py-6 text-xs text-gray-400">Loading...</div>}>
        <ForgotForm />
      </Suspense>
    </AuthShell>
  );
}
