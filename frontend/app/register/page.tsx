'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, User, ArrowRight, Loader2, ShieldCheck, MailCheck, ArrowLeft } from 'lucide-react';
import { useSignUp, useUser } from '@clerk/nextjs';
import { useAuth } from '@/lib/auth-context';
import AuthShell from '@/components/auth/AuthShell';
import { PasswordField, PasswordStrength } from '@/components/auth/PasswordField';
import { ErrorAlert, SuccessAlert } from '@/components/auth/Alert';
import OtpInput from '@/components/auth/OtpInput';
import { useCooldown } from '@/components/auth/useCooldown';

export default function RegisterPage() {
  const router = useRouter();
  const { isLoaded, signUp, setActive } = useSignUp();
  const { isSignedIn, isLoaded: userLoaded } = useUser();
  const { register } = useAuth();

  // If already authenticated in Clerk, redirect to dashboard
  useEffect(() => {
    if (userLoaded && isSignedIn) {
      router.push('/dashboard');
    }
  }, [userLoaded, isSignedIn, router]);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  // Verification states
  const [pendingVerification, setPendingVerification] = useState(false);
  const [code, setCode] = useState('');
  const cooldown = useCooldown(0);

  const matches = password.length > 0 && password === confirm;

  // Auto-submit verification code once 6 digits are typed
  useEffect(() => {
    if (pendingVerification && code.trim().length === 6 && !loading) {
      handleVerifyCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, pendingVerification]);

  async function handleRegister(e?: React.FormEvent | React.MouseEvent) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (loading) return;
    setError('');
    setNotice('');

    // Field-level validation checks
    if (!name.trim()) {
      setError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setError('Please create a password.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    if (!confirm) {
      setError('Please confirm your password.');
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match. Please ensure both fields are identical.');
      return;
    }

    setLoading(true);

    try {
      if (!isLoaded) {
        setError('Authentication service is still initializing. Please wait a moment and try again.');
        setLoading(false);
        return;
      }

      if (signUp) {
        // Clerk Sign-Up Flow
        const nameParts = name.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || undefined;

        const signUpAttempt = await signUp.create({
          emailAddress: email.trim(),
          password,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          unsafeMetadata: {
            currency,
            full_name: name.trim(),
          },
        });

        if (signUpAttempt.status === 'complete') {
          await setActive({ session: signUpAttempt.createdSessionId });
          router.push('/onboarding');
          return;
        }

        // Send the 6-digit email verification code
        try {
          await signUp.prepareEmailAddressVerification({
            strategy: 'email_code',
          });
        } catch (prepErr) {
          // If Clerk already prepared verification automatically during signUp.create(), proceed safely
          console.warn('prepareEmailAddressVerification note:', prepErr);
        }

        setPendingVerification(true);
        setNotice('A 6-digit confirmation code has been dispatched to your email.');
        cooldown.start(60);
      } else {
        // Fallback for offline / development environments without Clerk configured
        await register(email.trim(), password, name.trim(), currency);
        router.push(`/verify-email?email=${encodeURIComponent(email.trim())}&sent=1`);
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      const code = err?.errors?.[0]?.code;
      const msg =
        code === 'form_identifier_exists'
          ? 'An account with this email address already exists. Please sign in instead.'
          : err?.errors?.[0]?.longMessage ||
            err?.errors?.[0]?.message ||
            (err instanceof Error ? err.message : 'Registration failed. Please check your credentials and try again.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode(e?: React.FormEvent | React.MouseEvent) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (loading) return;

    if (code.trim().length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError('');
    setNotice('');

    try {
      if (isLoaded && signUp) {
        const completeSignUp = await signUp.attemptEmailAddressVerification({
          code: code.trim(),
        });

        if (completeSignUp.status === 'complete') {
          await setActive({ session: completeSignUp.createdSessionId });
          router.push('/onboarding');
        } else {
          setError(`Verification status: ${completeSignUp.status}. Please check your details.`);
        }
      } else {
        router.push(`/verify-email?email=${encodeURIComponent(email.trim())}&sent=1`);
      }
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        (err instanceof Error ? err.message : 'Invalid or expired verification code. Please request a new one.');
      setError(msg);
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    if (loading || cooldown.left > 0) return;
    setError('');
    setNotice('');
    setLoading(true);

    try {
      if (isLoaded && signUp) {
        await signUp.prepareEmailAddressVerification({
          strategy: 'email_code',
        });
        setNotice('A fresh 6-digit code has been sent to your email.');
        cooldown.start(60);
      }
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        (err instanceof Error ? err.message : 'Could not resend the code.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignUp() {
    if (!isLoaded || !signUp) return;
    setError('');
    try {
      await signUp.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: '/sso-callback',
        redirectUrlComplete: '/onboarding',
      });
    } catch (err: any) {
      const msg =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        (err instanceof Error ? err.message : 'Google sign-up failed.');
      setError(msg);
    }
  }

  return (
    <AuthShell
      title={pendingVerification ? 'Verify your email' : 'Create your account'}
      subtitle={
        pendingVerification
          ? `Enter the 6-digit code sent to ${email}`
          : "We'll email you a 6-digit code to confirm it's really you."
      }
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="text-[#16A36A] font-bold hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      {notice && <SuccessAlert>{notice}</SuccessAlert>}
      {error && <ErrorAlert>{error}</ErrorAlert>}

      {pendingVerification ? (
        /* STEP 2: 6-Digit Email Code Verification */
        <form onSubmit={handleVerifyCode} className="space-y-5" noValidate>
          <div className="flex items-center gap-3 py-1">
            <div className="h-11 w-11 rounded-full bg-[#DDF8E8] text-[#16A36A] flex items-center justify-center shrink-0">
              <MailCheck size={22} />
            </div>
            <p className="text-sm text-[#475569] leading-snug">
              We sent a verification code to <strong className="text-[#10251D] break-all">{email}</strong>.
            </p>
          </div>

          <OtpInput value={code} onChange={setCode} disabled={loading} autoFocus />

          <button
            type="submit"
            onClick={handleVerifyCode}
            disabled={loading || code.trim().length !== 6}
            className="w-full bg-[#16A36A] hover:bg-[#128A58] disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer relative z-10"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Verifying code...
              </>
            ) : (
              'Verify email & continue'
            )}
          </button>

          <div className="text-center text-xs text-[#64748B] space-y-2 pt-2">
            <p>
              Didn&apos;t get it? Check spam, or{' '}
              <button
                type="button"
                onClick={handleResendCode}
                disabled={cooldown.left > 0 || loading}
                className="text-[#16A36A] font-bold hover:underline disabled:text-[#94A3B8] disabled:no-underline cursor-pointer"
              >
                {cooldown.left > 0 ? `resend in ${cooldown.left}s` : 'resend the code'}
              </button>
            </p>
            <p>The code expires in 10 minutes.</p>
            <button
              type="button"
              onClick={() => {
                setPendingVerification(false);
                setError('');
                setNotice('');
                setCode('');
              }}
              className="inline-flex items-center gap-1 text-xs text-[#16A36A] hover:underline font-semibold cursor-pointer pt-1"
            >
              <ArrowLeft size={13} /> Edit account details / Use different email
            </button>
          </div>
        </form>
      ) : (
        /* STEP 1: Registration Form */
        <>
          <form onSubmit={handleRegister} className="space-y-4" noValidate>
            <div>
              <label className="block text-xs font-bold text-[#64748B] mb-1.5" htmlFor="name">
                Full name
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-3.5 text-gray-400" aria-hidden />
                <input
                  id="name"
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-3 bg-white border border-[#D9E2DC] rounded-xl text-sm outline-none focus:border-[#16A36A] focus:ring-2 focus:ring-[#16A36A]/15"
                  placeholder="John Smith"
                />
              </div>
            </div>

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
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-3 bg-white border border-[#D9E2DC] rounded-xl text-sm outline-none focus:border-[#16A36A] focus:ring-2 focus:ring-[#16A36A]/15"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-3">
              <PasswordField
                id="password"
                label="Create password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
              />
              <PasswordStrength password={password} />
            </div>

            <div>
              <PasswordField
                id="confirm"
                label="Confirm password"
                value={confirm}
                onChange={setConfirm}
                autoComplete="new-password"
              />
              {confirm.length > 0 && !matches && (
                <p className="text-[11px] text-red-600 mt-1.5">Passwords don&apos;t match yet.</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#64748B] mb-1.5" htmlFor="currency">
                Primary currency
              </label>
              <select
                id="currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3.5 py-3 bg-white border border-[#D9E2DC] rounded-xl text-sm outline-none focus:border-[#16A36A] focus:ring-2 focus:ring-[#16A36A]/15"
              >
                <option value="INR">INR (₹) — Indian Rupee</option>
                <option value="USD">USD ($) — US Dollar</option>
                <option value="EUR">EUR (€) — Euro</option>
                <option value="GBP">GBP (£) — British Pound</option>
              </select>
            </div>

            <button
              id="create-account-btn"
              type="submit"
              onClick={handleRegister}
              disabled={loading}
              className="w-full bg-[#16A36A] hover:bg-[#128A58] disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer relative z-10"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Sending code...
                </>
              ) : (
                <>
                  Create account &amp; send code <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Social SSO: Google Login */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center" aria-hidden>
              <div className="w-full border-t border-gray-100" />
            </div>
            <p className="relative text-center">
              <span className="bg-white px-3 text-[11px] text-[#94A3B8]">or continue with</span>
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={loading}
            className="w-full bg-white hover:bg-gray-50 border border-[#D9E2DC] text-[#10251D] py-3 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer relative z-10"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Sign up with Google
          </button>

          <p className="text-[11px] text-[#64748B] flex items-start gap-1.5 pt-2">
            <ShieldCheck size={14} className="text-[#16A36A] shrink-0 mt-px" />
            No bank login or card needed. Your records stay private to your account.
          </p>
        </>
      )}
    </AuthShell>
  );
}
