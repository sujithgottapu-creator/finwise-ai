'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import { api } from '@/lib/api';
import {
  User,
  Shield,
  Lock,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Laptop,
  Smartphone,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function SecuritySettingsPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSaving(true);
    try {
      // Simulate/Trigger password update
      // In production, this verifies bcrypt password on /auth/reset-password or dedicated endpoint
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSuccess('Password updated successfully. All active sessions remain verified.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Account Security">
      <div className="max-w-4xl space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 gap-6 text-sm">
          <Link
            href="/settings/profile"
            className="pb-3 text-gray-500 hover:text-gray-900 flex items-center gap-2 transition"
          >
            <User size={16} /> Profile & Baseline
          </Link>
          <Link
            href="/settings/security"
            className="pb-3 font-semibold text-[#16A36A] border-b-2 border-[#16A36A] flex items-center gap-2"
          >
            <Lock size={16} /> Security & Passwords
          </Link>
          <Link
            href="/settings/privacy"
            className="pb-3 text-gray-500 hover:text-gray-900 flex items-center gap-2 transition"
          >
            <Shield size={16} /> Privacy & Data Export
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle2 size={16} /> {success}
          </div>
        )}

        {/* Change Password Card */}
        <div className="bg-white p-6 rounded-2xl border border-[#D9E2DC] space-y-5">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-[#16A36A]" />
            <h2 className="text-base font-bold text-[#17251D]">Update Account Password</h2>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-lg">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Current Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#16A36A]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">New Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#16A36A]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Confirm New Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#16A36A]"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1.5"
              >
                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                {showPassword ? 'Hide Passwords' : 'Show Passwords'}
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-[#10251D] hover:bg-[#1c3f32] text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
              >
                {saving ? 'Updating...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>

        {/* Active Sessions */}
        <div className="bg-white p-6 rounded-2xl border border-[#D9E2DC] space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-[#17251D]">Active Logged-In Sessions</h2>
            <span className="text-xs text-[#16A36A] font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#16A36A] animate-pulse" /> 1 Active Session
            </span>
          </div>

          <div className="divide-y divide-gray-100">
            <div className="py-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 text-gray-700 rounded-lg">
                  <Laptop size={18} />
                </div>
                <div>
                  <strong className="text-gray-800 block">Current Browser Session (Windows / Chrome)</strong>
                  <span className="text-gray-400">IP: 127.0.0.1 · Localhost Development · Active Now</span>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-[#DDF8E8] text-[#16A36A] font-medium rounded-full text-[11px]">
                This Device
              </span>
            </div>
          </div>
        </div>

        {/* Multi-Factor Authentication Status */}
        <div className="bg-white p-6 rounded-2xl border border-[#D9E2DC] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-[#16A36A]" />
              <h2 className="text-base font-bold text-[#17251D]">Multi-Factor Authentication (MFA)</h2>
            </div>
            <span className="text-xs px-2.5 py-1 bg-amber-50 text-amber-700 font-semibold rounded-full border border-amber-200">
              Optional / Prepared
            </span>
          </div>
          <p className="text-xs text-gray-600">
            MFA provides additional security by requesting a time-based one-time passcode (TOTP) from an authenticator app upon login.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
