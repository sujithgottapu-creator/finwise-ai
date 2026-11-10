'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  User,
  Shield,
  Lock,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  Coins,
  DollarSign,
  Wallet,
} from 'lucide-react';

export default function ProfileSettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [monthlyIncome, setMonthlyIncome] = useState<number | string>('');
  const [essentialExpenses, setEssentialExpenses] = useState<number | string>('');
  const [discretionaryExpenses, setDiscretionaryExpenses] = useState<number | string>('');
  const [currentSavings, setCurrentSavings] = useState<number | string>('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const data = await api.settings.getProfile();
      setDisplayName(data.display_name || '');
      setEmail(data.email || '');
      setCurrency(data.currency || 'INR');
      setTimezone(data.timezone || 'Asia/Kolkata');
      setMonthlyIncome(data.monthly_income ?? 0);
      setEssentialExpenses(data.essential_expenses ?? 0);
      setDiscretionaryExpenses(data.discretionary_expenses ?? 0);
      setCurrentSavings(data.current_savings ?? 0);
    } catch (err: any) {
      console.error(err);
      setError('Could not load profile settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await api.settings.updateProfile({
        display_name: displayName,
        currency,
        timezone,
        monthly_income: Number(monthlyIncome) || 0,
        essential_expenses: Number(essentialExpenses) || 0,
        discretionary_expenses: Number(discretionaryExpenses) || 0,
        current_savings: Number(currentSavings) || 0,
      });

      setSuccess('Profile and financial planning defaults updated successfully.');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update profile settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Profile & Preferences">
      <div className="max-w-4xl space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 gap-6 text-sm">
          <Link
            href="/settings/profile"
            className="pb-3 font-semibold text-[#16A36A] border-b-2 border-[#16A36A] flex items-center gap-2"
          >
            <User size={16} /> Profile & Baseline
          </Link>
          <Link
            href="/settings/security"
            className="pb-3 text-gray-500 hover:text-gray-900 flex items-center gap-2 transition"
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

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: User Identity */}
          <div className="bg-white p-6 rounded-2xl border border-[#D9E2DC] space-y-4">
            <h2 className="text-base font-bold text-[#17251D]">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#16A36A]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 bg-gray-50 text-gray-500 rounded-xl cursor-not-allowed"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Primary identifier used for security alerts.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Preferred Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-[#16A36A]"
                >
                  <option value="INR">INR (₹ - Indian Rupee)</option>
                  <option value="USD">USD ($ - US Dollar)</option>
                  <option value="EUR">EUR (€ - Euro)</option>
                  <option value="GBP">GBP (£ - British Pound)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Timezone</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:border-[#16A36A]"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST +05:30)</option>
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT +08:00)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Financial Baseline Defaults */}
          <div className="bg-white p-6 rounded-2xl border border-[#D9E2DC] space-y-4">
            <div>
              <h2 className="text-base font-bold text-[#17251D]">Financial Planning Baselines</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                These monthly figures seed the AI assistant recommendations and cash flow simulation models.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Expected Monthly Income (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#16A36A]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Current Liquid Savings / Emergency Reserve (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={currentSavings}
                  onChange={(e) => setCurrentSavings(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#16A36A]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Monthly Essential Expenses (Needs) (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={essentialExpenses}
                  onChange={(e) => setEssentialExpenses(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#16A36A]"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Monthly Discretionary Expenses (Wants) (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={discretionaryExpenses}
                  onChange={(e) => setDiscretionaryExpenses(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#16A36A]"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#16A36A] hover:bg-[#138d5b] text-white rounded-xl text-sm font-semibold transition shadow-sm disabled:opacity-50"
            >
              <Save size={16} /> {saving ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
