'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowRight,
  ArrowLeft,
  Check,
  Sparkles,
  ShieldCheck,
  Target,
  Wallet,
  ReceiptText,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency } from '@/lib/utils';

export default function OnboardingPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Basic Profile
  const [displayName, setDisplayName] = useState(user?.display_name || 'John Smith');
  const [currency, setCurrency] = useState(user?.currency || 'INR');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [ageRange, setAgeRange] = useState('25-34');

  // Step 2: Financial Information
  const [monthlyIncome, setMonthlyIncome] = useState('60000');
  const [incomeFrequency, setIncomeFrequency] = useState('monthly');
  const [essentialExpenses, setEssentialExpenses] = useState('22000');
  const [discretionaryExpenses, setDiscretionaryExpenses] = useState('12000');
  const [currentSavings, setCurrentSavings] = useState('40000');
  const [totalDebt, setTotalDebt] = useState('15000');

  // Step 3: Financial Goals
  const [goals, setGoals] = useState<Array<{ name: string; target_amount: number; priority: string }>>([
    { name: 'Emergency Reserve', target_amount: 50000, priority: 'high' },
    { name: 'New Laptop', target_amount: 35000, priority: 'medium' },
  ]);
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalAmount, setNewGoalAmount] = useState('');

  // Calculations for Step 4
  const incNum = parseFloat(monthlyIncome) || 0;
  const essNum = parseFloat(essentialExpenses) || 0;
  const discNum = parseFloat(discretionaryExpenses) || 0;
  const totalExp = essNum + discNum;
  const netSurplus = incNum - totalExp;
  const savingsRate = incNum > 0 && netSurplus > 0 ? Math.round((netSurplus / incNum) * 100) : 0;

  function addGoal() {
    const amt = parseFloat(newGoalAmount);
    if (!newGoalName.trim() || isNaN(amt) || amt <= 0) return;
    setGoals([...goals, { name: newGoalName.trim(), target_amount: amt, priority: 'medium' }]);
    setNewGoalName('');
    setNewGoalAmount('');
  }

  function removeGoal(index: number) {
    setGoals(goals.filter((_, i) => i !== index));
  }

  async function handleCompleteOnboarding() {
    setError('');
    setSubmitting(true);
    try {
      await api.onboarding.submit({
        profile: {
          display_name: displayName,
          currency,
          timezone,
          age_range: ageRange,
        },
        financials: {
          monthly_income: incNum,
          income_frequency: incomeFrequency,
          essential_expenses: essNum,
          discretionary_expenses: discNum,
          current_savings: parseFloat(currentSavings) || 0,
          total_debt: parseFloat(totalDebt) || 0,
        },
        goals: goals.map((g) => ({
          name: g.name,
          target_amount: g.target_amount,
          priority: g.priority,
        })),
        initial_budget_confirmed: true,
      });

      await refreshUser();
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to complete onboarding setup.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F7F5] flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#DDF8E8] text-[#10251D] text-xs font-bold mb-2">
            <Sparkles size={14} className="text-[#16A36A]" />
            <span>Personal Financial Profile Wizard</span>
          </div>
          <h1 className="text-3xl font-extrabold text-[#10251D]">Set Up Your FinWise Workspace</h1>
          <p className="text-xs text-[#64748B]">
            Help FinWise establish your financial baseline. You can modify these settings anytime.
          </p>
        </div>

        {/* Stepper Progress */}
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          {[
            { num: 1, title: 'Profile' },
            { num: 2, title: 'Financials' },
            { num: 3, title: 'Goals' },
            { num: 4, title: 'Plan Review' },
          ].map((s) => (
            <div key={s.num} className="space-y-1.5">
              <div
                className={`h-2 rounded-full transition-all ${
                  step >= s.num ? 'bg-[#16A36A]' : 'bg-[#D9E2DC]'
                }`}
              />
              <span className={`text-[11px] font-bold ${step === s.num ? 'text-[#10251D]' : 'text-[#64748B]'}`}>
                {s.title}
              </span>
            </div>
          ))}
        </div>

        {/* Step Card */}
        <div className="bg-white rounded-2xl border border-[#D9E2DC] shadow-sm p-8 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
              {error}
            </div>
          )}

          {/* STEP 1: Basic Profile */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-extrabold text-[#10251D]">Step 1: Basic Profile</h2>
              <p className="text-xs text-[#64748B]">Tell us how you would like to be addressed in reports.</p>

              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                  placeholder="e.g. John Smith"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">Primary Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                  >
                    <option value="INR">INR (₹) — Indian Rupee</option>
                    <option value="USD">USD ($) — US Dollar</option>
                    <option value="EUR">EUR (€) — Euro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                  >
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New_York (EST)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1">Age Range (Optional)</label>
                <select
                  value={ageRange}
                  onChange={(e) => setAgeRange(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                >
                  <option value="18-24">18–24 (Student / Early Career)</option>
                  <option value="25-34">25–34 (Young Professional)</option>
                  <option value="35-49">35–49 (Mid Career / Household)</option>
                  <option value="50+">50+ (Pre-retirement)</option>
                </select>
              </div>
            </div>
          )}

          {/* STEP 2: Financial Information */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-extrabold text-[#10251D]">Step 2: Monthly Financials</h2>
              <p className="text-xs text-[#64748B]">Provide your estimated monthly baseline inflows and outflows.</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">Monthly Income (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={monthlyIncome}
                    onChange={(e) => setMonthlyIncome(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                    placeholder="50000"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">Income Frequency</label>
                  <select
                    value={incomeFrequency}
                    onChange={(e) => setIncomeFrequency(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                  >
                    <option value="monthly">Monthly Salary</option>
                    <option value="biweekly">Bi-weekly / Freelance</option>
                    <option value="irregular">Irregular / Variable</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">Essential Monthly Expenses (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={essentialExpenses}
                    onChange={(e) => setEssentialExpenses(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                    placeholder="Rent, groceries, utilities"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">Discretionary Expenses (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={discretionaryExpenses}
                    onChange={(e) => setDiscretionaryExpenses(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                    placeholder="Dining, shopping, hobbies"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">Current Liquid Savings (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={currentSavings}
                    onChange={(e) => setCurrentSavings(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                    placeholder="Bank balances, cash"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">Total Outstanding Debt (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={totalDebt}
                    onChange={(e) => setTotalDebt(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                    placeholder="Optional debt total"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Financial Goals */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-extrabold text-[#10251D]">Step 3: Initial Savings Goals</h2>
              <p className="text-xs text-[#64748B]">Set your top priorities. FinWise will calculate your contribution schedule.</p>

              <div className="space-y-2">
                {goals.map((g, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-[#F5F7F5] rounded-xl border border-gray-100 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Target size={16} className="text-[#16A36A]" />
                      <strong>{g.name}</strong>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-[#10251D]">{formatCurrency(g.target_amount)}</span>
                      <button
                        type="button"
                        onClick={() => removeGoal(idx)}
                        className="text-red-500 hover:text-red-700 font-bold text-[11px]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-gray-100 flex gap-2">
                <input
                  type="text"
                  placeholder="New goal name (e.g. Goa Trip)"
                  value={newGoalName}
                  onChange={(e) => setNewGoalName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                />
                <input
                  type="number"
                  placeholder="Target (₹)"
                  value={newGoalAmount}
                  onChange={(e) => setNewGoalAmount(e.target.value)}
                  className="w-32 px-3 py-2 border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                />
                <button
                  type="button"
                  onClick={addGoal}
                  className="px-4 py-2 bg-[#10251D] text-white rounded-xl text-xs font-bold"
                >
                  Add Goal
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Initial Plan & Budget Review */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-extrabold text-[#10251D]">Step 4: Review Starting Plan</h2>
              <p className="text-xs text-[#64748B]">
                Here is your baseline financial equation derived deterministically from your inputs.
              </p>

              {/* Summary Metrics */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-3 bg-[#F5F7F5] rounded-xl border border-gray-100">
                  <div className="text-[10px] text-[#64748B]">Monthly Inflow</div>
                  <strong className="text-sm text-[#10251D]">{formatCurrency(incNum)}</strong>
                </div>
                <div className="p-3 bg-[#F5F7F5] rounded-xl border border-gray-100">
                  <div className="text-[10px] text-[#64748B]">Total Outflows</div>
                  <strong className="text-sm text-[#10251D]">{formatCurrency(totalExp)}</strong>
                </div>
                <div className="p-3 bg-[#DDF8E8] rounded-xl border border-[#16A36A]/20">
                  <div className="text-[10px] text-[#10251D] font-bold">Net Cash Flow</div>
                  <strong className="text-sm text-[#16A36A]">{formatCurrency(netSurplus)}</strong>
                </div>
              </div>

              {/* Suggested Starting Budgets */}
              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold text-[#10251D] flex items-center gap-1.5">
                  <Wallet size={15} className="text-[#16A36A]" />
                  <span>Proposed Starting Monthly Budgets:</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-gray-50 rounded-lg flex justify-between">
                    <span>Housing (35%):</span>
                    <strong>{formatCurrency(incNum * 0.35)}</strong>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-lg flex justify-between">
                    <span>Food & Groceries (20%):</span>
                    <strong>{formatCurrency(incNum * 0.2)}</strong>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-lg flex justify-between">
                    <span>Transport (10%):</span>
                    <strong>{formatCurrency(incNum * 0.1)}</strong>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-lg flex justify-between">
                    <span>Lifestyle (15%):</span>
                    <strong>{formatCurrency(incNum * 0.15)}</strong>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
                <strong>Explicit Plan Confirmation:</strong> Clicking "Save Plan & Launch Dashboard" confirms saving these initial category limits and goals to your database. No AI agent will automatically change these limits without your subsequent approval.
              </div>
            </div>
          )}

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#D9E2DC] text-xs font-bold text-[#17251D]"
              >
                <ArrowLeft size={14} /> Back
              </button>
            ) : <div />}

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-[#16A36A] hover:bg-[#128A58] text-white rounded-xl text-xs font-bold shadow-sm"
              >
                Next Step <ArrowRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={handleCompleteOnboarding}
                className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-[#16A36A] hover:bg-[#128A58] text-white rounded-xl text-xs font-bold shadow-sm"
              >
                <Check size={14} />
                {submitting ? 'Saving Plan...' : 'Save Plan & Launch Dashboard'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
