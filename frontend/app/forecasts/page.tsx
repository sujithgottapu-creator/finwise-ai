'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  TrendingUp,
  Sliders,
  Save,
  Plus,
  Trash2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  FolderOpen,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

interface OneTimePurchase {
  month: number;
  description: string;
  amount: number;
}

export default function ForecastsPage() {
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Simulation Parameters
  const [months, setMonths] = useState<number>(12);
  const [monthlyIncome, setMonthlyIncome] = useState<number>(65000);
  const [monthlyExpenses, setMonthlyExpenses] = useState<number>(38000);
  const [savingsContribution, setSavingsContribution] = useState<number>(15000);
  const [bufferExpense, setBufferExpense] = useState<number>(3000);
  const [investmentReturnRate, setInvestmentReturnRate] = useState<number>(8.0);
  const [oneTimePurchases, setOneTimePurchases] = useState<OneTimePurchase[]>([
    { month: 4, description: 'Electronics & Gadget Upgrade', amount: 35000 },
  ]);

  // One time item inputs
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newItemMonth, setNewItemMonth] = useState(3);
  const [newItemAmount, setNewItemAmount] = useState('');

  // Results
  const [projection, setProjection] = useState<any>(null);
  const [savedScenarios, setSavedScenarios] = useState<any[]>([]);
  const [scenarioName, setScenarioName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch user profile for default income/expenses
      const prof = await api.settings.getProfile().catch(() => null);
      if (prof) {
        if (prof.monthly_income) setMonthlyIncome(prof.monthly_income);
        if (prof.essential_expenses || prof.discretionary_expenses) {
          setMonthlyExpenses(prof.essential_expenses + prof.discretionary_expenses);
        }
      }

      // 2. Load saved scenarios
      const sc = await api.forecasts.getScenarios().catch(() => []);
      setSavedScenarios(sc || []);

      // 3. Run default simulation
      await runSimulation(
        months,
        prof?.monthly_income || 65000,
        prof?.essential_expenses ? prof.essential_expenses + prof.discretionary_expenses : 38000,
        15000,
        3000,
        8.0,
        oneTimePurchases
      );
    } catch (err: any) {
      console.error(err);
      setError('Failed to initialize forecasting workspace.');
    } finally {
      setLoading(false);
    }
  };

  const runSimulation = async (
    m = months,
    inc = monthlyIncome,
    exp = monthlyExpenses,
    sav = savingsContribution,
    buf = bufferExpense,
    ret = investmentReturnRate,
    otp = oneTimePurchases
  ) => {
    setSimulating(true);
    setError(null);
    try {
      const res = await api.forecasts.simulate({
        months: m,
        custom_monthly_income: inc,
        custom_monthly_expenses: exp,
        monthly_savings_contribution: sav,
        unexpected_expense_buffer: buf,
        annual_investment_return_rate: ret,
        one_time_purchases: otp,
      });
      setProjection(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Simulation calculation failed.');
    } finally {
      setSimulating(false);
    }
  };

  const handleAddOneTime = () => {
    if (!newItemDesc.trim() || !newItemAmount || Number(newItemAmount) <= 0) return;
    const updated = [
      ...oneTimePurchases,
      {
        month: Number(newItemMonth),
        description: newItemDesc.trim(),
        amount: Number(newItemAmount),
      },
    ];
    setOneTimePurchases(updated);
    setNewItemDesc('');
    setNewItemAmount('');
    runSimulation(months, monthlyIncome, monthlyExpenses, savingsContribution, bufferExpense, investmentReturnRate, updated);
  };

  const handleRemoveOneTime = (index: number) => {
    const updated = oneTimePurchases.filter((_, i) => i !== index);
    setOneTimePurchases(updated);
    runSimulation(months, monthlyIncome, monthlyExpenses, savingsContribution, bufferExpense, investmentReturnRate, updated);
  };

  const handleSaveScenario = async () => {
    if (!scenarioName.trim()) return;
    try {
      await api.forecasts.saveScenario({
        name: scenarioName.trim(),
        assumptions: {
          months,
          monthlyIncome,
          monthlyExpenses,
          savingsContribution,
          bufferExpense,
          investmentReturnRate,
          oneTimePurchases,
        },
        projection: {
          expected_ending_balance: projection?.expected_ending_balance,
          best_case_ending_balance: projection?.best_case_ending_balance,
          adverse_case_ending_balance: projection?.adverse_case_ending_balance,
        },
      });
      setShowSaveModal(false);
      setScenarioName('');
      setSuccessMsg('Scenario saved successfully to your archive.');
      setTimeout(() => setSuccessMsg(null), 4000);
      const sc = await api.forecasts.getScenarios();
      setSavedScenarios(sc || []);
    } catch (err: any) {
      alert(err.message || 'Failed to save scenario.');
    }
  };

  const handleLoadScenario = (sc: any) => {
    const a = sc.assumptions;
    if (!a) return;
    if (a.months) setMonths(a.months);
    if (a.monthlyIncome) setMonthlyIncome(a.monthlyIncome);
    if (a.monthlyExpenses) setMonthlyExpenses(a.monthlyExpenses);
    if (a.savingsContribution) setSavingsContribution(a.savingsContribution);
    if (a.bufferExpense) setBufferExpense(a.bufferExpense);
    if (a.investmentReturnRate) setInvestmentReturnRate(a.investmentReturnRate);
    if (a.oneTimePurchases) setOneTimePurchases(a.oneTimePurchases);

    runSimulation(
      a.months || months,
      a.monthlyIncome || monthlyIncome,
      a.monthlyExpenses || monthlyExpenses,
      a.savingsContribution || savingsContribution,
      a.bufferExpense || bufferExpense,
      a.investmentReturnRate || investmentReturnRate,
      a.oneTimePurchases || oneTimePurchases
    );
  };

  // Prepare chart data
  const chartData = projection?.monthly_projections?.map((p: any) => ({
    month: `M${p.month}`,
    expected: Number(p.expected_balance),
    best: Number(p.best_case_balance),
    adverse: Number(p.adverse_case_balance),
    netFlow: Number(p.net_monthly_flow),
  })) || [];

  return (
    <AppLayout title="What-If Financial Forecasts">
      <div className="space-y-6">
        {/* Banner */}
        <div className="bg-[#10251D] text-white p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border border-[#16A36A]/30">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#16A36A] uppercase mb-1">
              <Sparkles size={14} /> Multi-Month Cash Flow Modeling
            </div>
            <h1 className="text-2xl font-bold">Interactive What-If Scenario Simulator</h1>
            <p className="text-gray-300 text-sm mt-1 max-w-2xl">
              Model your future liquidity under varied assumptions: income raises, unexpected shocks, inflation, and market returns.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#16A36A] hover:bg-[#138d5b] text-white text-sm font-semibold transition shadow-sm"
            >
              <Save size={16} /> Save Scenario
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle2 size={16} /> {successMsg}
          </div>
        )}

        {/* Top KPI Cards from Simulation */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-[#D9E2DC]">
            <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Starting Balance</span>
            <div className="text-2xl font-bold text-[#17251D] mt-2">
              {formatCurrency(projection?.starting_balance || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Liquid baseline</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#D9E2DC]">
            <span className="text-xs font-semibold text-[#16A36A] uppercase tracking-wider">Expected Balance</span>
            <div className="text-2xl font-bold text-[#16A36A] mt-2">
              {formatCurrency(projection?.expected_ending_balance || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">At month {months} horizon</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#D9E2DC]">
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">Best-Case Outcome</span>
            <div className="text-2xl font-bold text-blue-600 mt-2">
              {formatCurrency(projection?.best_case_ending_balance || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Favorable investment yield</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#D9E2DC]">
            <span className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Adverse-Case Stress</span>
            <div className="text-2xl font-bold text-amber-600 mt-2">
              {formatCurrency(projection?.adverse_case_ending_balance || 0)}
            </div>
            <p className="text-xs text-gray-500 mt-1">Buffer drain & zero yield</p>
          </div>
        </div>

        {/* Simulation Controls & Chart Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Controls Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-[#D9E2DC] space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Sliders size={18} className="text-[#16A36A]" />
                  <h2 className="text-base font-bold text-[#17251D]">Scenario Assumptions</h2>
                </div>
                <button
                  onClick={() => runSimulation()}
                  disabled={simulating}
                  className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-lg transition"
                  title="Recalculate simulation"
                >
                  <RefreshCw size={16} className={simulating ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Horizon */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">
                  Timeline Horizon: {months} Months
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[6, 12, 24, 36].map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setMonths(m);
                        runSimulation(m);
                      }}
                      className={`py-1.5 text-xs font-semibold rounded-lg border transition ${
                        months === m
                          ? 'bg-[#10251D] text-white border-[#10251D]'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {m} Mo
                    </button>
                  ))}
                </div>
              </div>

              {/* Monthly Income */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                  <span>Monthly Inflow</span>
                  <span className="text-[#16A36A]">{formatCurrency(monthlyIncome)}</span>
                </div>
                <input
                  type="range"
                  min="20000"
                  max="300000"
                  step="5000"
                  value={monthlyIncome}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMonthlyIncome(val);
                    runSimulation(months, val);
                  }}
                  className="w-full accent-[#16A36A] h-2 bg-gray-100 rounded-lg cursor-pointer"
                />
              </div>

              {/* Monthly Expenses */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                  <span>Monthly Outflow (Essential + Discretionary)</span>
                  <span className="text-red-600">{formatCurrency(monthlyExpenses)}</span>
                </div>
                <input
                  type="range"
                  min="10000"
                  max="200000"
                  step="2000"
                  value={monthlyExpenses}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMonthlyExpenses(val);
                    runSimulation(months, monthlyIncome, val);
                  }}
                  className="w-full accent-red-500 h-2 bg-gray-100 rounded-lg cursor-pointer"
                />
              </div>

              {/* Monthly Savings Contribution */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                  <span>Target Savings / Investment</span>
                  <span className="text-blue-600">{formatCurrency(savingsContribution)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100000"
                  step="2000"
                  value={savingsContribution}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setSavingsContribution(val);
                    runSimulation(months, monthlyIncome, monthlyExpenses, val);
                  }}
                  className="w-full accent-blue-600 h-2 bg-gray-100 rounded-lg cursor-pointer"
                />
              </div>

              {/* Unexpected Buffer */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                  <span>Emergency Shock Buffer</span>
                  <span className="text-amber-600">{formatCurrency(bufferExpense)}/mo</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20000"
                  step="1000"
                  value={bufferExpense}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setBufferExpense(val);
                    runSimulation(months, monthlyIncome, monthlyExpenses, savingsContribution, val);
                  }}
                  className="w-full accent-amber-500 h-2 bg-gray-100 rounded-lg cursor-pointer"
                />
              </div>

              {/* Investment Yield */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-gray-600 mb-1">
                  <span>Annual Expected Yield</span>
                  <span className="text-[#16A36A]">{investmentReturnRate}% p.a.</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="0.5"
                  value={investmentReturnRate}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setInvestmentReturnRate(val);
                    runSimulation(months, monthlyIncome, monthlyExpenses, savingsContribution, bufferExpense, val);
                  }}
                  className="w-full accent-[#16A36A] h-2 bg-gray-100 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* One-Time Major Outflows / Windfalls */}
            <div className="bg-white p-6 rounded-2xl border border-[#D9E2DC] space-y-4">
              <h2 className="text-base font-bold text-[#17251D]">One-Time Events & Milestones</h2>
              <p className="text-xs text-gray-500">
                Plan major upcoming lump sums (e.g., vacation, gadget purchase, tax refund, or bonus).
              </p>

              {/* Add event form */}
              <div className="space-y-3 pt-2">
                <input
                  type="text"
                  placeholder="Event description (e.g., Relocation, Laptop)"
                  value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#16A36A]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-1">Month Occurring</label>
                    <input
                      type="number"
                      min="1"
                      max={months}
                      value={newItemMonth}
                      onChange={(e) => setNewItemMonth(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#16A36A]"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-gray-500 block mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 50000"
                      value={newItemAmount}
                      onChange={(e) => setNewItemAmount(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#16A36A]"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAddOneTime}
                  className="w-full py-2 bg-gray-900 text-white hover:bg-black rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} /> Add One-Time Event
                </button>
              </div>

              {/* List of events */}
              {oneTimePurchases.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  {oneTimePurchases.map((otp, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl text-xs"
                    >
                      <div>
                        <span className="font-semibold text-gray-800">{otp.description}</span>
                        <div className="text-[11px] text-gray-500">
                          Month {otp.month} · {formatCurrency(otp.amount)}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveOneTime(idx)}
                        className="text-gray-400 hover:text-red-500 p-1 transition"
                        title="Delete event"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Saved Scenarios Card */}
            {savedScenarios.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border border-[#D9E2DC] space-y-3">
                <div className="flex items-center gap-2">
                  <FolderOpen size={16} className="text-[#16A36A]" />
                  <h3 className="text-sm font-bold text-gray-800">Saved Scenarios Archive</h3>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {savedScenarios.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => handleLoadScenario(s)}
                      className="p-2.5 rounded-xl border border-gray-100 hover:border-[#16A36A] hover:bg-[#DDF8E8]/20 cursor-pointer transition flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-gray-800">{s.name}</span>
                        <div className="text-[10px] text-gray-400">
                          Horizon: {s.assumptions?.months || 12} mo · Yield: {s.assumptions?.investmentReturnRate || 8}%
                        </div>
                      </div>
                      <ArrowRight size={14} className="text-gray-400" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Chart & Table Column */}
          <div className="lg:col-span-7 space-y-6">
            {/* Projection Area Chart */}
            <div className="bg-white p-6 rounded-2xl border border-[#D9E2DC]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-[#17251D]">Projected Net Wealth Trajectory</h2>
                  <p className="text-xs text-[#64748B]">Simulated portfolio balances under standard, optimistic, and stressed conditions</p>
                </div>
                <div className="text-xs px-2.5 py-1 bg-[#DDF8E8] text-[#16A36A] font-medium rounded-full">
                  Monte-Carlo Rule Simulation
                </div>
              </div>

              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBest" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorExpected" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16A36A" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#16A36A" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="colorAdverse" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="#94A3B8"
                      fontSize={11}
                      tickLine={false}
                      tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatCurrency(Number(val)), '']}
                      contentStyle={{
                        backgroundColor: '#10251D',
                        borderRadius: '8px',
                        border: 'none',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Area
                      type="monotone"
                      dataKey="best"
                      name="Best-Case Yield"
                      stroke="#2563EB"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorBest)"
                    />
                    <Area
                      type="monotone"
                      dataKey="expected"
                      name="Expected Baseline"
                      stroke="#16A36A"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorExpected)"
                    />
                    <Area
                      type="monotone"
                      dataKey="adverse"
                      name="Adverse Scenario"
                      stroke="#F59E0B"
                      strokeWidth={1.5}
                      strokeDasharray="4 4"
                      fillOpacity={1}
                      fill="url(#colorAdverse)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Monthly Projection Table */}
            <div className="bg-white p-6 rounded-2xl border border-[#D9E2DC]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-[#17251D]">Monthly Breakdown Ledger</h2>
                <span className="text-xs text-gray-500">First 12 months simulated</span>
              </div>

              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 text-gray-400 font-medium">
                      <th className="py-2.5 px-3">Month</th>
                      <th className="py-2.5 px-3">Expected Inflow</th>
                      <th className="py-2.5 px-3">Expenses</th>
                      <th className="py-2.5 px-3">One-Time Shocks</th>
                      <th className="py-2.5 px-3 text-right">Net Expected Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {projection?.monthly_projections?.slice(0, 12).map((row: any) => (
                      <tr key={row.month} className="hover:bg-gray-50/80 transition">
                        <td className="py-2.5 px-3 font-semibold text-gray-700">Month {row.month}</td>
                        <td className="py-2.5 px-3 text-emerald-600 font-medium">{formatCurrency(row.inflow)}</td>
                        <td className="py-2.5 px-3 text-red-500">{formatCurrency(row.outflow)}</td>
                        <td className="py-2.5 px-3 text-gray-600">
                          {row.one_time_expenses > 0 ? (
                            <span className="text-amber-600 font-medium">
                              -{formatCurrency(row.one_time_expenses)}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                          {formatCurrency(row.expected_balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Regulatory Disclaimer */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-500 flex items-start gap-2.5">
              <ShieldAlert size={16} className="text-gray-400 shrink-0 mt-0.5" />
              <div>
                <strong>Simulation Disclaimer:</strong> All projections generated above are mathematical calculations
                based solely on deterministic user assumptions and compound growth formulas. They do not constitute
                investment guarantees, SEBI-registered financial advisory, or bank account commitments.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Scenario Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-[#D9E2DC] shadow-xl">
            <h3 className="text-lg font-bold text-[#17251D]">Save Current Scenario</h3>
            <p className="text-xs text-gray-600">
              Give this simulation an identifier to recall its parameters later (e.g., &ldquo;Conservative 2-Year Plan with Car Purchase&rdquo;).
            </p>
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Scenario Name</label>
              <input
                type="text"
                placeholder="e.g. Higher Savings + European Holiday"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#16A36A]"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveScenario}
                disabled={!scenarioName.trim()}
                className="px-4 py-2 text-xs font-semibold bg-[#16A36A] hover:bg-[#138d5b] text-white rounded-xl transition disabled:opacity-50"
              >
                Save Scenario
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
