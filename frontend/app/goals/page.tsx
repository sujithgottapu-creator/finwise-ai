'use client';

import React, { useEffect, useState } from 'react';
import {
  Plus,
  ShieldCheck,
  CreditCard,
  Target,
  Edit2,
  Trash2,
  CheckCircle2,
  Calendar,
  History,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function GoalsPage() {
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editGoal, setEditGoal] = useState<any>(null);
  const [contributeGoal, setContributeGoal] = useState<any>(null);
  const [contributionHistory, setContributionHistory] = useState<any[]>([]);
  const [historyGoalName, setHistoryGoalName] = useState('');
  const [toast, setToast] = useState('');

  // Form states
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [priority, setPriority] = useState('medium');

  // Contribution form
  const [contributionAmt, setContributionAmt] = useState('');
  const [contributionNotes, setContributionNotes] = useState('');

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function loadGoals() {
    try {
      setLoading(true);
      const res = await api.goals.list();
      setGoals(res || []);
    } catch {
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGoals();
  }, []);

  async function handleSaveGoal(e: React.FormEvent) {
    e.preventDefault();
    const numTarget = parseFloat(targetAmount);
    if (!name.trim() || isNaN(numTarget) || numTarget <= 0) {
      alert('Please provide a valid goal name and positive target amount.');
      return;
    }

    try {
      if (editGoal) {
        await api.goals.update(editGoal.id, {
          name: name.trim(),
          target_amount: numTarget,
          target_date: targetDate || null,
          priority,
        });
        notify('Goal updated.');
      } else {
        await api.goals.create({
          name: name.trim(),
          target_amount: numTarget,
          target_date: targetDate || null,
          priority,
        });
        notify('Savings goal created.');
      }
      setShowCreateModal(false);
      setEditGoal(null);
      setName('');
      setTargetAmount('');
      setTargetDate('');
      loadGoals();
    } catch (err: any) {
      alert(err.message || 'Failed to save goal.');
    }
  }

  async function handleDeleteGoal(id: number) {
    if (!confirm('Are you sure you want to delete this savings goal?')) return;
    try {
      await api.goals.delete(id);
      notify('Goal deleted.');
      loadGoals();
    } catch (err: any) {
      alert(err.message || 'Failed to delete goal.');
    }
  }

  async function handleAddContribution(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(contributionAmt);
    if (!contributeGoal || isNaN(amt) || amt <= 0) {
      alert('Please provide a valid contribution amount.');
      return;
    }

    try {
      const idempotencyKey = `contrib-${contributeGoal.id}-${Date.now()}`;
      await api.goals.addContribution(contributeGoal.id, {
        amount: amt,
        contribution_date: new Date().toISOString().split('T')[0],
        notes: contributionNotes.trim() || null,
        idempotency_key: idempotencyKey,
      });
      notify(`Contribution of ${formatCurrency(amt)} recorded.`);
      setContributeGoal(null);
      setContributionAmt('');
      setContributionNotes('');
      loadGoals();
    } catch (err: any) {
      alert(err.message || 'Failed to record contribution.');
    }
  }

  async function viewHistory(goal: any) {
    try {
      setHistoryGoalName(goal.name);
      const hist = await api.goals.getContributions(goal.id);
      setContributionHistory(hist);
    } catch {
      setContributionHistory([]);
    }
  }

  return (
    <AppLayout pageTitle="Savings Goals">
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" /> CAPITAL ACCUMULATION
          </div>
          <h1>
            Savings Goals<span className="heading-period">.</span>
          </h1>
          <p className="page-sub">
            Translate aspirations into monthly contribution quotas with verified progress tracking.
          </p>
        </div>

        <div className="head-actions">
          <button
            className="button button-primary"
            onClick={() => {
              setEditGoal(null);
              setName('');
              setTargetAmount('');
              setTargetDate('');
              setShowCreateModal(true);
            }}
          >
            <Plus size={16} /> New Goal
          </button>
        </div>
      </div>

      {/* Goals Grid */}
      <div className="goals-page-grid">
        {goals.map((g, i) => {
          const isDone = g.status === 'completed';
          const isPast = g.months_remaining === 0 && !isDone;

          return (
            <section className="panel goal-big relative" key={g.id}>
              <div className="flex items-center justify-between">
                <div className={`goal-symbol goal-${i % 3}`}>
                  {i === 0 ? <ShieldCheck size={20} /> : i === 1 ? <CreditCard size={20} /> : <Target size={20} />}
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => {
                      setEditGoal(g);
                      setName(g.name);
                      setTargetAmount(String(g.target_amount));
                      setTargetDate(g.target_date || '');
                      setPriority(g.priority);
                      setShowCreateModal(true);
                    }}
                    className="p-1 text-gray-400 hover:text-emerald-700"
                    title="Edit goal"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDeleteGoal(g.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete goal"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="goal-big-title">
                <h3>{g.name}</h3>
                <span className="font-bold text-xs text-[#16A36A]">{Math.round(g.completion_percentage)}% complete</span>
              </div>

              <div className="goal-big-amount">
                {formatCurrency(g.current_saved_amount)}{' '}
                <span>of {formatCurrency(g.target_amount)}</span>
              </div>

              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(100, g.completion_percentage)}%`,
                    background: isDone ? '#16A36A' : ['#16845d', '#6387d8', '#d6a04c'][i % 3],
                  }}
                />
              </div>

              <div className="goal-foot">
                <span>Remaining: <strong>{formatCurrency(g.remaining_amount)}</strong></span>
                <span>
                  {isDone ? (
                    <strong className="text-emerald-700">Target Reached!</strong>
                  ) : isPast ? (
                    <strong className="text-red-600 flex items-center gap-1">
                      <AlertCircle size={12} /> Deadline passed
                    </strong>
                  ) : (
                    <span>
                      Need: <strong>{formatCurrency(g.required_monthly_contribution)}/mo</strong>
                    </span>
                  )}
                </span>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-[#64748B]">
                <span>Target Date: {formatDate(g.target_date)}</span>
                <button
                  type="button"
                  onClick={() => viewHistory(g)}
                  className="text-[#16A36A] font-bold flex items-center gap-1 hover:underline"
                >
                  <History size={13} /> History
                </button>
              </div>

              <button
                className="button button-outline full-button mt-4"
                disabled={isDone}
                onClick={() => {
                  setContributeGoal(g);
                  setContributionAmt('');
                  setContributionNotes('');
                }}
              >
                <Plus size={15} /> {isDone ? 'Goal Complete' : 'Add Contribution'}
              </button>
            </section>
          );
        })}
      </div>

      {/* Modal: Create or Edit Goal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{editGoal ? 'Edit Savings Goal' : 'Create Savings Goal'}</h2>
                <p>Define target capital and completion schedule.</p>
              </div>
              <button className="icon-button" onClick={() => setShowCreateModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1">Goal Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Emergency Fund, New Laptop, Goa Trip"
                  className="w-full px-3 py-2 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1">Target Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="50000"
                  className="w-full px-3 py-2 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">Target Date</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="button button-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary">
                  {editGoal ? 'Save Changes' : 'Create Goal'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Modal: Add Contribution */}
      {contributeGoal && (
        <div className="modal-backdrop" onClick={() => setContributeGoal(null)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Add Contribution</h2>
                <p>Deposit funds into {contributeGoal.name}.</p>
              </div>
              <button className="icon-button" onClick={() => setContributeGoal(null)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleAddContribution} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1">Contribution Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={contributionAmt}
                  onChange={(e) => setContributionAmt(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={contributionNotes}
                  onChange={(e) => setContributionNotes(e.target.value)}
                  placeholder="e.g. Monthly transfer, Festival bonus"
                  className="w-full px-3 py-2 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="button button-secondary" onClick={() => setContributeGoal(null)}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary">
                  Confirm Contribution
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* History Drawer Modal */}
      {historyGoalName && (
        <div className="modal-backdrop" onClick={() => setHistoryGoalName('')}>
          <section className="modal max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>Contribution History</h2>
                <p>{historyGoalName}</p>
              </div>
              <button className="icon-button" onClick={() => setHistoryGoalName('')}>
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {contributionHistory.length > 0 ? (
                contributionHistory.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 bg-[#F5F7F5] rounded-xl text-xs"
                  >
                    <div>
                      <strong>{formatDate(c.contribution_date)}</strong>
                      <div className="text-[10px] text-gray-500">{c.notes || 'Automated deposit'}</div>
                    </div>
                    <span className="font-extrabold text-[#16A36A]">+{formatCurrency(c.amount)}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-500 text-xs">No contributions recorded yet.</div>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="button button-primary" onClick={() => setHistoryGoalName('')}>
                Close
              </button>
            </div>
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
