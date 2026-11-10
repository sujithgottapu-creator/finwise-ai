'use client';

import React, { useEffect, useState } from 'react';
import { Plus, CreditCard, ShieldCheck, TrendingDown, ArrowRight, Edit2, Trash2, CheckCircle2, Sparkles } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function DebtsPage() {
  const [debts, setDebts] = useState<any[]>([]);
  const [strategyResult, setStrategyResult] = useState<any>(null);
  const [extraPayment, setExtraPayment] = useState(2000);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editDebt, setEditDebt] = useState<any>(null);
  const [toast, setToast] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [rate, setRate] = useState('');
  const [minPayment, setMinPayment] = useState('');
  const [targetDate, setTargetDate] = useState('');

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function loadDebtsAndStrategy(extra = extraPayment) {
    try {
      setLoading(true);
      const [dList, strat] = await Promise.all([
        api.debts.list().catch(() => []),
        api.debts.calculateStrategy(extra).catch(() => null),
      ]);
      setDebts(dList || []);
      setStrategyResult(strat);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDebtsAndStrategy();
  }, []);

  async function handleExtraPaymentChange(val: number) {
    setExtraPayment(val);
    try {
      const res = await api.debts.calculateStrategy(val);
      setStrategyResult(res);
    } catch {
      // ignore
    }
  }

  async function handleSaveDebt(e: React.FormEvent) {
    e.preventDefault();
    const numBal = parseFloat(balance);
    const numRate = parseFloat(rate);
    const numMin = parseFloat(minPayment);

    if (!name.trim() || isNaN(numBal) || numBal <= 0 || isNaN(numRate) || isNaN(numMin)) {
      alert('Please fill out all fields with valid positive numbers.');
      return;
    }

    try {
      if (editDebt) {
        await api.debts.update(editDebt.id, {
          name: name.trim(),
          outstanding_balance: numBal,
          interest_rate: numRate,
          minimum_payment: numMin,
          target_payoff_date: targetDate || null,
        });
        notify('Debt record updated.');
      } else {
        await api.debts.create({
          name: name.trim(),
          outstanding_balance: numBal,
          interest_rate: numRate,
          minimum_payment: numMin,
          target_payoff_date: targetDate || null,
        });
        notify('Debt registered.');
      }
      setShowAddModal(false);
      setEditDebt(null);
      setName('');
      setBalance('');
      setRate('');
      setMinPayment('');
      setTargetDate('');
      loadDebtsAndStrategy();
    } catch (err: any) {
      alert(err.message || 'Failed to save debt.');
    }
  }

  async function handleDeleteDebt(id: number) {
    if (!confirm('Are you sure you want to delete this debt entry?')) return;
    try {
      await api.debts.delete(id);
      notify('Debt deleted.');
      loadDebtsAndStrategy();
    } catch (err: any) {
      alert(err.message || 'Failed to delete debt.');
    }
  }

  const totalOutstanding = debts.reduce((sum, d) => sum + Number(d.outstanding_balance), 0);
  const totalMinPayments = debts.reduce((sum, d) => sum + Number(d.minimum_payment), 0);

  return (
    <AppLayout pageTitle="Debt Planner">
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" /> ACCELERATED DELEVERAGING
          </div>
          <h1>
            Debt Planner<span className="heading-period">.</span>
          </h1>
          <p className="page-sub">
            Compare Avalanche vs Snowball payoff strategies with deterministic interest calculations.
          </p>
        </div>

        <div className="head-actions">
          <button
            className="button button-primary"
            onClick={() => {
              setEditDebt(null);
              setName('');
              setBalance('');
              setRate('');
              setMinPayment('');
              setTargetDate('');
              setShowAddModal(true);
            }}
          >
            <Plus size={16} /> Add Debt Record
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-white rounded-2xl border border-[#D9E2DC] shadow-sm">
          <span className="text-xs text-[#64748B]">Total Outstanding Debt</span>
          <div className="text-2xl font-extrabold text-[#10251D] mt-1">{formatCurrency(totalOutstanding)}</div>
          <span className="text-[11px] text-[#64748B]">Across {debts.length} active liabilities</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-[#D9E2DC] shadow-sm">
          <span className="text-xs text-[#64748B]">Monthly Minimum Payments</span>
          <div className="text-2xl font-extrabold text-amber-600 mt-1">{formatCurrency(totalMinPayments)}</div>
          <span className="text-[11px] text-[#64748B]">Baseline required commitment</span>
        </div>

        <div className="p-4 bg-[#DDF8E8] rounded-2xl border border-[#16A36A]/20 shadow-sm">
          <span className="text-xs text-[#10251D] font-bold">Avalanche Interest Advantage</span>
          <div className="text-2xl font-extrabold text-[#16A36A] mt-1">
            {formatCurrency(strategyResult?.interest_saved_with_avalanche || 0)}
          </div>
          <span className="text-[11px] text-[#10251D]">Saved vs Snowball strategy</span>
        </div>
      </div>

      {/* Strategy Comparison Simulator */}
      <section className="panel full-panel">
        <div className="panel-head">
          <div>
            <h3>Strategy Comparator: Avalanche vs Snowball</h3>
            <p>Adjust your extra monthly payment to simulate debt-free acceleration</p>
          </div>
          <span className="text-xs font-bold px-3 py-1 bg-[#DDF8E8] text-[#16A36A] rounded-full">
            Deterministic Engine
          </span>
        </div>

        {/* Extra Payment Slider */}
        <div className="slider-block max-w-xl my-6">
          <div className="slider-label">
            <span>Extra Monthly Principal Boost:</span>
            <strong>{formatCurrency(extraPayment)}</strong>
          </div>
          <input
            type="range"
            min="0"
            max="15000"
            step="500"
            value={extraPayment}
            onChange={(e) => handleExtraPaymentChange(Number(e.target.value))}
            className="w-full accent-[#16A36A]"
          />
          <div className="flex justify-between text-[11px] text-gray-400 mt-1">
            <span>₹0 (Minimums Only)</span>
            <span>₹15,000/mo Extra</span>
          </div>
        </div>

        {/* Strategy Side-by-Side Results */}
        {strategyResult && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* Avalanche */}
            <div className="p-5 rounded-2xl bg-[#F0FDF4] border border-[#16A36A]/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#16A36A] uppercase tracking-wider">STRATEGY 1</span>
                <span className="text-[11px] font-extrabold px-2 py-0.5 rounded bg-[#16A36A] text-white">
                  Mathematical Optimum
                </span>
              </div>
              <h4 className="text-lg font-extrabold text-[#10251D]">Debt Avalanche</h4>
              <p className="text-xs text-[#64748B]">Prioritizes debts with the highest Annual Percentage Rate (APR).</p>

              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                <div className="p-3 bg-white rounded-xl border border-gray-100">
                  <span className="text-[#64748B] block text-[10px]">Time to Debt Freedom</span>
                  <strong className="text-base text-[#10251D]">
                    {strategyResult.avalanche.months_to_payoff} Months
                  </strong>
                </div>
                <div className="p-3 bg-white rounded-xl border border-gray-100">
                  <span className="text-[#64748B] block text-[10px]">Total Interest Cost</span>
                  <strong className="text-base text-emerald-700">
                    {formatCurrency(strategyResult.avalanche.total_interest_paid)}
                  </strong>
                </div>
              </div>
            </div>

            {/* Snowball */}
            <div className="p-5 rounded-2xl bg-white border border-[#D9E2DC] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">STRATEGY 2</span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                  Psychological Momentum
                </span>
              </div>
              <h4 className="text-lg font-extrabold text-[#10251D]">Debt Snowball</h4>
              <p className="text-xs text-[#64748B]">Prioritizes debts with the smallest outstanding balance first.</p>

              <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                <div className="p-3 bg-[#F5F7F5] rounded-xl border border-gray-100">
                  <span className="text-[#64748B] block text-[10px]">Time to Debt Freedom</span>
                  <strong className="text-base text-[#10251D]">
                    {strategyResult.snowball.months_to_payoff} Months
                  </strong>
                </div>
                <div className="p-3 bg-[#F5F7F5] rounded-xl border border-gray-100">
                  <span className="text-[#64748B] block text-[10px]">Total Interest Cost</span>
                  <strong className="text-base text-[#10251D]">
                    {formatCurrency(strategyResult.snowball.total_interest_paid)}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="p-3 mt-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-[#64748B] leading-relaxed">
          <strong>Calculation Assumptions:</strong> Projections assume minimum payments remain constant until a loan is paid off, after which liberated cash rolls completely into subsequent debts. APR rates are assumed fixed.
        </div>
      </section>

      {/* Liabilities List */}
      <section className="panel full-panel">
        <div className="panel-head">
          <div>
            <h3>Registered Liabilities</h3>
            <p>Active loan and credit card balances</p>
          </div>
        </div>

        <div className="table-scroll mt-4">
          <table className="transactions-table">
            <thead>
              <tr>
                <th>DEBT NAME</th>
                <th>INTEREST RATE (APR)</th>
                <th>MINIMUM PAYMENT</th>
                <th>TARGET PAYOFF</th>
                <th className="amount-col">OUTSTANDING BALANCE</th>
                <th className="text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {debts.length > 0 ? (
                debts.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <strong>{d.name}</strong>
                    </td>
                    <td>{d.interest_rate}%</td>
                    <td>{formatCurrency(d.minimum_payment)}</td>
                    <td>{formatDate(d.target_payoff_date)}</td>
                    <td className="tx-amount text-red-600 font-extrabold">{formatCurrency(d.outstanding_balance)}</td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditDebt(d);
                            setName(d.name);
                            setBalance(String(d.outstanding_balance));
                            setRate(String(d.interest_rate));
                            setMinPayment(String(d.minimum_payment));
                            setTargetDate(d.target_payoff_date || '');
                            setShowAddModal(true);
                          }}
                          className="p-1 text-gray-400 hover:text-emerald-700"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteDebt(d.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No outstanding debt records registered.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal: Create or Edit Debt */}
      {showAddModal && (
        <div className="modal-backdrop" onClick={() => setShowAddModal(false)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{editDebt ? 'Edit Debt Record' : 'Add Debt Record'}</h2>
                <p>Register balance and interest rate parameters.</p>
              </div>
              <button className="icon-button" onClick={() => setShowAddModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDebt} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1">Debt Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Student Laptop Loan, Credit Card EMI"
                  className="w-full px-3 py-2 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">Outstanding Balance (₹)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    placeholder="18000"
                    className="w-full px-3 py-2 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">Annual APR (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    placeholder="11.5"
                    className="w-full px-3 py-2 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">Minimum Payment (₹)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={minPayment}
                    onChange={(e) => setMinPayment(e.target.value)}
                    placeholder="2200"
                    className="w-full px-3 py-2 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">Target Payoff Date</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="button button-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary">
                  {editDebt ? 'Save Changes' : 'Register Debt'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {toast && (
        <div className="toast">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}
    </AppLayout>
  );
}
