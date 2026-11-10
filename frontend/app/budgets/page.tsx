'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Copy, Edit2, Trash2, Wallet, ReceiptText, ShieldCheck, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { SummaryCard } from '@/components/SummaryCard';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

export default function BudgetsPage() {
  const [budgetsData, setBudgetsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editBudget, setEditBudget] = useState<any>(null);
  const [copying, setCopying] = useState(false);
  const [toast, setToast] = useState('');

  // Form states
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [limitAmount, setLimitAmount] = useState('');
  const [warningThreshold, setWarningThreshold] = useState('80');

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function loadBudgets() {
    try {
      setLoading(true);
      const res = await api.budgets.list();
      setBudgetsData(res);
    } catch {
      setBudgetsData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBudgets();
    api.categories.list('expense').then((cats) => {
      const expenseCats = cats || [];
      setCategories(expenseCats);
      if (expenseCats.length > 0) {
        setCategoryId(String(expenseCats[0].id));
      }
    }).catch(console.error);
  }, []);

  async function handleCopyPrevious() {
    setCopying(true);
    try {
      const res = await api.budgets.copyPrevious();
      notify(res.message);
      loadBudgets();
    } catch (err: any) {
      alert(err.message || 'No previous budgets found to copy.');
    } finally {
      setCopying(false);
    }
  }

  async function handleSaveBudget(e: React.FormEvent) {
    e.preventDefault();
    const numLimit = parseFloat(limitAmount);
    if (isNaN(numLimit) || numLimit <= 0) {
      alert('Please enter a valid positive limit.');
      return;
    }

    if (!editBudget) {
      const parsedCat = parseInt(categoryId);
      if (isNaN(parsedCat) || parsedCat <= 0) {
        alert('Please select a valid expense category.');
        return;
      }
    }

    try {
      if (editBudget) {
        await api.budgets.update(editBudget.id, {
          limit_amount: numLimit,
          warning_threshold: parseFloat(warningThreshold),
        });
        notify('Budget updated successfully.');
      } else {
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

        await api.budgets.create({
          category_id: parseInt(categoryId),
          period_start: start,
          period_end: end,
          limit_amount: numLimit,
          warning_threshold: parseFloat(warningThreshold),
        });
        notify('Budget created successfully.');
      }
      setShowCreateModal(false);
      setEditBudget(null);
      setLimitAmount('');
      loadBudgets();
    } catch (err: any) {
      alert(err.message || 'Failed to save budget.');
    }
  }

  async function handleDeleteBudget(id: number) {
    if (!confirm('Are you sure you want to delete this category budget?')) return;
    try {
      await api.budgets.delete(id);
      notify('Budget deleted.');
      loadBudgets();
    } catch (err: any) {
      alert(err.message || 'Failed to delete budget.');
    }
  }

  const items = budgetsData?.items || [];
  const totalBudget = budgetsData?.total_budget || 0;
  const totalSpent = budgetsData?.total_spent || 0;
  const remainingBudget = budgetsData?.remaining_budget || 0;
  const overallUsage = budgetsData?.overall_usage_percentage || 0;

  return (
    <AppLayout pageTitle="Monthly Budgets">
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" /> SPENDING PLANS
          </div>
          <h1>
            Monthly Budgets<span className="heading-period">.</span>
          </h1>
          <p className="page-sub">Establish purposeful category spending limits and monitor adherence in real time.</p>
        </div>

        <div className="head-actions">
          <button
            className="button button-secondary"
            onClick={handleCopyPrevious}
            disabled={copying}
            title="Copy category limits from previous month"
          >
            <Copy size={15} /> {copying ? 'Copying...' : 'Copy Previous Month'}
          </button>
          <button
            className="button button-primary"
            onClick={() => {
              setEditBudget(null);
              setLimitAmount('');
              if (categories.length > 0 && !categoryId) {
                setCategoryId(String(categories[0].id));
              }
              setShowCreateModal(true);
            }}
          >
            <Plus size={16} /> Create Budget
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="metrics-grid">
        <SummaryCard
          title="Total Budget"
          amount={formatCurrency(totalBudget)}
          change={`Across ${items.length} categories`}
          icon={<Wallet size={18} />}
          tone="green"
        />
        <SummaryCard
          title="Total Spent"
          amount={formatCurrency(totalSpent)}
          change="This billing cycle"
          icon={<ReceiptText size={18} />}
          tone="orange"
        />
        <SummaryCard
          title="Remaining Budget"
          amount={formatCurrency(remainingBudget)}
          change="Available to spend"
          icon={<ShieldCheck size={18} />}
          tone="blue"
        />
        <SummaryCard
          title="Budget Health"
          amount={overallUsage > 100 ? 'Exceeded' : overallUsage >= 80 ? 'Warning' : 'On Track'}
          change={`${overallUsage}% utilized`}
          icon={<Activity size={18} />}
          tone="purple"
        />
      </div>

      {/* Category Budgets List */}
      <section className="panel full-panel">
        <div className="panel-head">
          <div>
            <h3>Active Category Budgets</h3>
            <p>Actual expenses compared with your established monthly thresholds</p>
          </div>
        </div>

        <div className="budget-list large-budget-list">
          {items.length > 0 ? (
            items.map((b: any) => {
              const limit = Number(b.limit_amount);
              const spent = Number(b.spent_amount);
              const pct = Math.min(100, Math.round(b.usage_percentage));
              const isExceeded = b.status === 'exceeded';
              const isWarning = b.status === 'warning';
              const barColor = isExceeded ? '#DC2626' : isWarning ? '#F59E0B' : '#16845d';

              return (
                <div key={b.id} className="budget-item p-4 bg-[#F5F7F5] rounded-xl border border-gray-100">
                  <div className="budget-top items-center">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm text-[#10251D]">{b.category_name}</strong>
                      {isExceeded && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 flex items-center gap-1">
                          <AlertTriangle size={11} /> Limit Exceeded
                        </span>
                      )}
                      {isWarning && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 flex items-center gap-1">
                          <AlertTriangle size={11} /> Nearing Limit (80%+)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span>
                        <strong className="text-sm">{formatCurrency(spent)}</strong>
                        <em className="text-xs"> / {formatCurrency(limit)}</em>
                      </span>
                      <button
                        onClick={() => {
                          setEditBudget(b);
                          setLimitAmount(String(b.limit_amount));
                          setWarningThreshold(String(b.warning_threshold || '80'));
                          setShowCreateModal(true);
                        }}
                        className="text-gray-400 hover:text-emerald-700 p-1"
                        title="Edit limit"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteBudget(b.id)}
                        className="text-gray-400 hover:text-red-600 p-1"
                        title="Delete budget"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="progress-track my-2 h-2.5">
                    <div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} />
                  </div>

                  <div className="budget-foot">
                    <span className="font-semibold text-xs">{b.usage_percentage}% used</span>
                    <span className={`font-semibold text-xs ${isExceeded ? 'text-red-600' : 'text-gray-600'}`}>
                      {isExceeded
                        ? `Over budget by ${formatCurrency(spent - limit)}`
                        : `${formatCurrency(limit - spent)} remaining`}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-xs text-gray-500 py-8 text-center">
              No budgets established for the current period. Click "Create Budget" or "Copy Previous Month" above.
            </div>
          )}
        </div>
      </section>

      {/* Modal for Create/Edit Budget */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{editBudget ? 'Edit Budget Limit' : 'Create Monthly Budget'}</h2>
                <p>Define spending ceilings for this category.</p>
              </div>
              <button className="icon-button" onClick={() => setShowCreateModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBudget} className="space-y-4">
              {!editBudget && (
                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none"
                    required
                  >
                    {categories.length > 0 ? (
                      categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))
                    ) : (
                      <option value="">No categories available</option>
                    )}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1">Monthly Limit (₹)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={limitAmount}
                  onChange={(e) => setLimitAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                  placeholder="e.g. 15000"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1">Warning Threshold (%)</label>
                <input
                  type="number"
                  min="50"
                  max="100"
                  value={warningThreshold}
                  onChange={(e) => setWarningThreshold(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                  placeholder="80"
                  required
                />
                <span className="text-[10px] text-gray-400">Triggers an alert when category spending reaches this percentage.</span>
              </div>

              <div className="modal-actions">
                <button type="button" className="button button-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary">
                  {editBudget ? 'Save Changes' : 'Create Budget'}
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
