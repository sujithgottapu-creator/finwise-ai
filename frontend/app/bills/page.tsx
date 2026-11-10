'use client';

import React, { useEffect, useState } from 'react';
import { Plus, CalendarDays, CheckCircle2, AlertTriangle, Clock, Trash2, Edit2, ArrowRight } from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function BillsPage() {
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editBill, setEditBill] = useState<any>(null);
  const [toast, setToast] = useState('');

  // Form states
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [nextDueDate, setNextDueDate] = useState('');
  const [notes, setNotes] = useState('');

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function loadBills() {
    try {
      setLoading(true);
      const res = await api.bills.list();
      setBills(res || []);
    } catch {
      setBills([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBills();
    api.categories.list('expense').then((cats) => {
      setCategories(cats || []);
    }).catch(console.error);
  }, []);

  async function handleSaveBill(e: React.FormEvent) {
    e.preventDefault();
    const numAmt = parseFloat(amount);
    if (!name.trim() || isNaN(numAmt) || numAmt <= 0 || !nextDueDate) {
      alert('Please fill out all required fields with a valid amount and due date.');
      return;
    }

    try {
      const parsedCatId = categoryId ? parseInt(categoryId) : undefined;
      if (editBill) {
        await api.bills.update(editBill.id, {
          name: name.trim(),
          amount: numAmt,
          frequency,
          next_due_date: nextDueDate,
          category_id: parsedCatId,
          notes: notes.trim() || null,
        });
        notify('Bill updated.');
      } else {
        await api.bills.create({
          name: name.trim(),
          amount: numAmt,
          frequency,
          next_due_date: nextDueDate,
          currency: 'INR',
          category_id: parsedCatId,
          notes: notes.trim() || null,
        });
        notify('Recurring bill added.');
      }
      setShowCreateModal(false);
      setEditBill(null);
      setName('');
      setAmount('');
      setCategoryId('');
      setNextDueDate('');
      setNotes('');
      loadBills();
    } catch (err: any) {
      alert(err.message || 'Failed to save recurring bill.');
    }
  }

  async function handleMarkPaid(id: number) {
    try {
      const res = await api.bills.pay(id);
      notify(res.message);
      loadBills();
    } catch (err: any) {
      alert(err.message || 'Failed to mark bill as paid.');
    }
  }

  async function handleDeleteBill(id: number) {
    if (!confirm('Are you sure you want to delete this recurring bill?')) return;
    try {
      await api.bills.delete(id);
      notify('Bill deleted.');
      loadBills();
    } catch (err: any) {
      alert(err.message || 'Failed to delete bill.');
    }
  }

  const totalMonthlyCommitment = bills.reduce((acc, b) => {
    const amt = Number(b.amount);
    if (b.frequency === 'weekly') return acc + amt * 4;
    if (b.frequency === 'quarterly') return acc + amt / 3;
    if (b.frequency === 'yearly') return acc + amt / 12;
    return acc + amt;
  }, 0);

  return (
    <AppLayout pageTitle="Recurring Bills">
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" /> SCHEDULED LIABILITIES
          </div>
          <h1>
            Recurring Bills<span className="heading-period">.</span>
          </h1>
          <p className="page-sub">
            Track fixed payment commitments (rent, utilities, subscriptions) and protect cash liquidity.
          </p>
        </div>

        <div className="head-actions">
          <button
            className="button button-primary"
            onClick={() => {
              setEditBill(null);
              setName('');
              setAmount('');
              setCategoryId('');
              setNextDueDate('');
              setNotes('');
              setShowCreateModal(true);
            }}
          >
            <Plus size={16} /> Add Recurring Bill
          </button>
        </div>
      </div>

      <div className="p-4 bg-white rounded-2xl border border-[#D9E2DC] shadow-sm flex items-center justify-between mb-6">
        <div>
          <span className="text-xs text-[#64748B]">Total Normalized Monthly Commitment</span>
          <div className="text-2xl font-extrabold text-[#10251D]">{formatCurrency(totalMonthlyCommitment)}</div>
        </div>
        <span className="px-3 py-1 rounded-full bg-[#DDF8E8] text-[#16A36A] font-bold text-xs">
          {bills.length} active commitments
        </span>
      </div>

      <section className="panel full-panel">
        <div className="panel-head">
          <div>
            <h3>Scheduled Commitments</h3>
            <p>Bills awaiting settlement in your current cycle</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {bills.length > 0 ? (
            bills.map((b) => {
              const isOverdue = b.status === 'overdue';
              return (
                <div
                  key={b.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isOverdue ? 'bg-red-50/60 border-red-200' : 'bg-[#F5F7F5] border-gray-100'
                  } space-y-3 flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-white border border-gray-200 text-[#64748B]">
                          {b.frequency}
                        </span>
                        {b.category_name && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100">
                            {b.category_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditBill(b);
                            setName(b.name);
                            setAmount(String(b.amount));
                            setFrequency(b.frequency);
                            setCategoryId(b.category_id ? String(b.category_id) : '');
                            setNextDueDate(b.next_due_date);
                            setNotes(b.notes || '');
                            setShowCreateModal(true);
                          }}
                          className="p-1 text-gray-400 hover:text-emerald-700"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteBill(b.id)}
                          className="p-1 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <h3 className="font-extrabold text-base text-[#10251D] mt-2 truncate">{b.name}</h3>
                    <div className="text-xl font-extrabold text-[#10251D] mt-1">{formatCurrency(b.amount)}</div>
                    <div className="text-xs text-[#64748B] flex items-center gap-1 mt-1">
                      <Clock size={12} /> Due: <strong>{formatDate(b.next_due_date)}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => handleMarkPaid(b.id)}
                    className="w-full py-2 bg-white hover:bg-emerald-50 text-[#16A36A] border border-[#16A36A]/40 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 size={14} /> Mark as Paid
                  </button>
                </div>
              );
            })
          ) : (
            <div className="col-span-3 text-center py-8 text-xs text-gray-500">
              No recurring bills scheduled. Click "Add Recurring Bill" above.
            </div>
          )}
        </div>
      </section>

      {/* Modal: Create or Edit Bill */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <section className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <h2>{editBill ? 'Edit Recurring Bill' : 'Add Recurring Bill'}</h2>
                <p>Register automated commitments to forecast cash availability.</p>
              </div>
              <button className="icon-button" onClick={() => setShowCreateModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBill} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1">Bill Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Apartment Rent, Broadband, Netflix"
                  className="w-full px-3 py-2 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1">Expense Category (Optional)</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none"
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="12000"
                    className="w-full px-3 py-2 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#64748B] mb-1">Frequency</label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1">Next Due Date</label>
                <input
                  type="date"
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#64748B] mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Auto-debits from primary salary account"
                  className="w-full px-3 py-2 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none"
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="button button-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="button button-primary">
                  {editBill ? 'Save Changes' : 'Add Bill'}
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
