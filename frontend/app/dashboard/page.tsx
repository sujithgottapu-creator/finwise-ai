'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BrainCircuit,
  CalendarDays,
  CreditCard,
  Download,
  Plus,
  ShieldCheck,
  Sparkles,
  Target,
  Wallet,
  ReceiptText,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

import { AppLayout } from '@/components/AppLayout';
import { SummaryCard } from '@/components/SummaryCard';
import { TransactionModal } from '@/components/TransactionModal';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<any>(null);
  const [cashFlowTrend, setCashFlowTrend] = useState<any[]>([]);
  const [spendingBreakdown, setSpendingBreakdown] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function loadDashboardData() {
    try {
      setLoading(true);
      const [sumRes, cfRes, sbRes, bRes, gRes, txRes, billRes] = await Promise.all([
        api.dashboard.getSummary().catch(() => null),
        api.dashboard.getCashFlow().catch(() => []),
        api.dashboard.getSpendingBreakdown().catch(() => []),
        api.budgets.list().catch(() => ({ items: [] })),
        api.goals.list().catch(() => []),
        api.transactions.list({ page_size: 5 }).catch(() => ({ items: [] })),
        api.bills.list().catch(() => []),
      ]);

      setSummary(sumRes);
      setCashFlowTrend(cfRes);
      setSpendingBreakdown(sbRes);
      setBudgets(bRes.items || []);
      setGoals(gRes || []);
      setTransactions(txRes.items || []);
      setBills(billRes || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  const totalIncome = summary?.total_income ?? 0;
  const totalExpenses = summary?.total_expenses ?? 0;
  const netCashFlow = summary?.net_cash_flow ?? (totalIncome - totalExpenses);
  const rawSavingsRate = summary?.savings_rate ?? (totalIncome > 0 ? Math.round((netCashFlow / totalIncome) * 100) : 0);
  const savingsRate = Math.max(0, rawSavingsRate);

  const pieData = spendingBreakdown.map((s) => ({
    name: s.category_name,
    value: Number(s.amount),
    color: s.color || '#16A36A',
  }));

  async function handleExportReport() {
    try {
      setExporting(true);
      const blob = await api.reports.exportCsv();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finwise_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Failed to export report CSV.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppLayout pageTitle="Financial Overview">
      {/* 1. Page Header */}
      <div className="page-head">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" /> LIVE FINANCIAL OVERVIEW
          </div>
          <h1>
            Welcome back, {user?.display_name || 'User'}
            <span className="heading-period">.</span>
          </h1>
          <p className="page-sub">A verified, deterministic overview of your current cash flow and savings trajectory.</p>
        </div>

        <div className="head-actions">
          <button
            onClick={handleExportReport}
            disabled={exporting}
            className="button button-secondary"
          >
            <Download size={16} /> {exporting ? 'Exporting...' : 'Export Report'}
          </button>
          <button className="button button-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} /> Add Transaction
          </button>
        </div>
      </div>

      {/* 2. AI Insight Banner */}
      <div className="insight-banner">
        <div className="insight-icon">
          <Sparkles size={19} />
        </div>
        <div className="insight-text">
          <strong>A little insight goes a long way</strong>
          <p>
            Your current recorded cash flow is positive ({formatCurrency(netCashFlow)}). Review your upcoming bills before
            committing additional surplus to long-term goals.
          </p>
        </div>
        <Link href="/assistant" className="no-underline">
          Explore insight <ArrowUpRight size={15} />
        </Link>
      </div>

      {/* 3. Section Heading & Period Filter */}
      <div className="section-heading">
        <div>
          <h2>Your money at a glance</h2>
          <p>Calculated directly from verified ledger records.</p>
        </div>
        <div className="period-select">
          <CalendarDays size={14} /> {summary?.period_label || 'Current Month'}
        </div>
      </div>

      {/* 4. Financial Summary Cards */}
      <div className="metrics-grid">
        <SummaryCard
          title="Total Income"
          amount={formatCurrency(totalIncome)}
          change="Recorded inflows"
          icon={<ArrowDownLeft size={18} />}
          tone="green"
        />
        <SummaryCard
          title="Total Expenses"
          amount={formatCurrency(totalExpenses)}
          change="Recorded outflows"
          icon={<ArrowUpRight size={18} />}
          tone="orange"
        />
        <SummaryCard
          title="Net Cash Flow"
          amount={formatCurrency(netCashFlow)}
          change="Income minus expenses"
          icon={<Activity size={18} />}
          tone="blue"
        />
        <SummaryCard
          title="Savings Rate"
          amount={`${savingsRate}%`}
          change="Of recorded income"
          icon={<Target size={18} />}
          tone="purple"
        />
      </div>

      {/* 5. Charts Grid: Cash Flow & Spending Breakdown */}
      <div className="dashboard-grid">
        {/* Cash Flow Line/Area Chart */}
        <section className="panel cashflow-panel">
          <div className="panel-head">
            <div>
              <h3>Cash Flow Trend</h3>
              <p>Income versus expenses across recent reporting periods</p>
            </div>
            <span className="select-small">Trailing 6 Months</span>
          </div>

          <div className="chart-legend">
            <span>
              <i className="legend-income" /> Income
            </span>
            <span>
              <i className="legend-expense" /> Expenses
            </span>
          </div>

          <div className="cashflow-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashFlowTrend} margin={{ top: 12, right: 5, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#16845d" stopOpacity={0.16} />
                    <stop offset="95%" stopColor="#16845d" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e3a65c" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#e3a65c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e9eee9" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#89948d', fontSize: 11 }} />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#89948d', fontSize: 11 }}
                  tickFormatter={(v) => `₹${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  formatter={(v: any) => formatCurrency(Number(v))}
                  contentStyle={{
                    border: '1px solid #e4eae5',
                    borderRadius: 12,
                    fontSize: 12,
                    boxShadow: '0 8px 24px #183b2410',
                  }}
                />
                <Area type="monotone" dataKey="income" name="Income" stroke="#16845d" strokeWidth={2.5} fill="url(#incomeFill)" />
                <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#dfa45d" strokeWidth={2.5} fill="url(#expenseFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-footer">
            <span>
              <span className="footer-dot green-dot" /> Inflows consistently exceeding regular outflows
            </span>
            <span className="chart-foot-note">Deterministic Ledger Data</span>
          </div>
        </section>

        {/* Spending Breakdown Donut Chart */}
        <section className="panel spending-panel">
          <div className="panel-head">
            <div>
              <h3>Spending Breakdown</h3>
              <p>Where your money goes this month</p>
            </div>
            <Link href="/transactions" className="text-xs text-[#16A36A] font-bold no-underline">
              View all
            </Link>
          </div>

          {pieData.length > 0 ? (
            <>
              <div className="donut-wrap">
                <div className="donut-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="65%"
                        outerRadius="90%"
                        paddingAngle={3}
                        stroke="none"
                      >
                        {pieData.map((d, idx) => (
                          <Cell key={idx} fill={d.color || '#16A36A'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => formatCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="donut-center">
                  <span>Total spent</span>
                  <strong>{formatCurrency(totalExpenses)}</strong>
                  <small>This month</small>
                </div>
              </div>

              <div className="category-list">
                {pieData.slice(0, 4).map((d) => (
                  <div className="category-row" key={d.name}>
                    <span className="category-name">
                      <i style={{ background: d.color }} />
                      {d.name}
                    </span>
                    <strong>{formatCurrency(d.value)}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-xs text-gray-500">
              No expense transactions logged for this month.
            </div>
          )}

          <Link href="/transactions" className="text-link full-link no-underline">
            View all transactions <ArrowUpRight size={14} />
          </Link>
        </section>
      </div>

      {/* 6. Budgets & Goals Grid */}
      <div className="lower-grid">
        {/* Monthly Budgets */}
        <section className="panel budget-panel">
          <div className="panel-head">
            <div>
              <h3>Monthly Budgets</h3>
              <p>Keep the important things on track</p>
            </div>
            <Link href="/budgets" className="text-link no-underline">
              View budgets <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="budget-list">
            {budgets.length > 0 ? (
              budgets.slice(0, 4).map((b) => {
                const limit = Number(b.limit_amount);
                const spent = Number(b.spent_amount);
                const pct = Math.min(100, Math.round(b.usage_percentage));
                const barColor = b.status === 'exceeded' ? '#DC2626' : b.status === 'warning' ? '#F59E0B' : '#16845d';

                return (
                  <div className="budget-item" key={b.id}>
                    <div className="budget-top">
                      <span>{b.category_name}</span>
                      <span>
                        <strong>{formatCurrency(spent)}</strong>
                        <em> / {formatCurrency(limit)}</em>
                      </span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                    <div className="budget-foot">
                      <span>{pct}% used</span>
                      <span>{formatCurrency(limit - spent)} left</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-gray-500 py-4 text-center">No active budgets. Click below to create one.</div>
            )}
          </div>
        </section>

        {/* Savings Goals */}
        <section className="panel goals-panel">
          <div className="panel-head">
            <div>
              <h3>Savings Goals</h3>
              <p>Every small contribution builds toward freedom</p>
            </div>
            <Link href="/goals" className="text-link no-underline">
              All goals <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="goals-list">
            {goals.length > 0 ? (
              goals.slice(0, 3).map((g, i) => (
                <div className="goal-item" key={g.id}>
                  <div className={`goal-symbol goal-${i % 3}`}>
                    {i === 0 ? <ShieldCheck size={18} /> : i === 1 ? <CreditCard size={18} /> : <Target size={18} />}
                  </div>
                  <div className="goal-main">
                    <div className="goal-title">
                      <strong>{g.name}</strong>
                      <span>{Math.round(g.completion_percentage)}%</span>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${Math.min(100, g.completion_percentage)}%`,
                          background: ['#16845d', '#6387d8', '#d6a04c'][i % 3],
                        }}
                      />
                    </div>
                    <div className="goal-foot">
                      <span>{formatCurrency(g.current_saved_amount)} saved</span>
                      <span>of {formatCurrency(g.target_amount)}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-xs text-gray-500 py-4 text-center">No goals set yet.</div>
            )}
          </div>

          <Link href="/goals" className="button button-outline full-button no-underline text-center">
            <Plus size={15} /> Create a savings goal
          </Link>
        </section>
      </div>

      {/* 7. Bottom Grid: Recent Transactions & AI Copilot Card */}
      <div className="bottom-grid">
        {/* Recent Transactions Table */}
        <section className="panel transactions-panel">
          <div className="panel-head">
            <div>
              <h3>Recent Transactions</h3>
              <p>Your latest money movements</p>
            </div>
            <Link href="/transactions" className="text-link no-underline">
              See all <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="table-scroll">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>TRANSACTION</th>
                  <th>CATEGORY</th>
                  <th>DATE</th>
                  <th className="amount-col">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length > 0 ? (
                  transactions.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <div className="tx-name-cell">
                          <span className={`tx-symbol ${t.transaction_type === 'income' ? 'tx-income' : ''}`}>
                            {t.transaction_type === 'income' ? '↗' : '⌂'}
                          </span>
                          <strong>{t.description}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="category-pill">{t.category_name || 'General'}</span>
                      </td>
                      <td className="tx-date">{formatDate(t.transaction_date)}</td>
                      <td className={`tx-amount ${t.transaction_type === 'income' ? 'income-amount' : ''}`}>
                        {t.transaction_type === 'income' ? '+' : '−'}
                        {formatCurrency(t.amount)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="empty-state">
                      No recent transactions recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* AI Copilot Card */}
        <section className="copilot-card">
          <div className="copilot-top">
            <div className="copilot-mark">
              <BrainCircuit size={21} />
            </div>
            <span className="live-tag">
              <i /> MULTI-AGENT READY
            </span>
          </div>
          <div className="copilot-kicker">FINWISE AI COPILOT</div>
          <h3>Make your next money move a smarter one.</h3>
          <p>
            Ask a question, simulate major purchases, or test debt repayment scenarios with verified numbers.
          </p>

          <div className="prompt-chips">
            <Link href="/assistant?prompt=Analyze%20my%20spending%20this%20month" className="no-underline">
              <button type="button">
                Analyze spending <ArrowUpRight size={13} />
              </button>
            </Link>
            <Link href="/assistant?prompt=Can%20I%20afford%20a%20purchase%20of%20₹10,000?" className="no-underline">
              <button type="button">
                Affordability check <ArrowUpRight size={13} />
              </button>
            </Link>
          </div>

          <Link href="/assistant" className="copilot-cta no-underline inline-flex">
            Chat with FinWise AI <ArrowUpRight size={16} />
          </Link>

          <div className="copilot-orb orb-one" />
          <div className="copilot-orb orb-two" />
        </section>
      </div>

      {/* 8. Upcoming Recurring Bills Section */}
      <div className="mt-8 panel">
        <div className="panel-head">
          <div>
            <h3>Upcoming Recurring Bills</h3>
            <p>Commitments scheduled across your current cycle</p>
          </div>
          <Link href="/bills" className="text-link no-underline">
            Manage bills <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {bills.length > 0 ? (
            bills.slice(0, 4).map((b) => (
              <div key={b.id} className="p-3.5 bg-[#F5F7F5] rounded-xl border border-gray-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <strong className="text-[#10251D] truncate">{b.name}</strong>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#DDF8E8] text-[#16A36A]">
                    {b.frequency}
                  </span>
                </div>
                <div className="text-base font-extrabold text-[#10251D]">{formatCurrency(b.amount)}</div>
                <div className="text-[10px] text-[#64748B]">Due: {formatDate(b.next_due_date)}</div>
              </div>
            ))
          ) : (
            <div className="col-span-4 text-xs text-gray-500 py-3 text-center">No recurring bills scheduled.</div>
          )}
        </div>
      </div>

      {/* Add Transaction Modal */}
      <TransactionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadDashboardData}
      />
    </AppLayout>
  );
}
