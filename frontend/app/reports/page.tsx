'use client';

import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  FileText,
  Calendar,
  Download,
  Printer,
  TrendingUp,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieIcon,
  ShieldCheck,
  AlertCircle,
  BarChart3,
} from 'lucide-react';

export default function ReportsPage() {
  const [reportType, setReportType] = useState<'monthly' | 'annual'>('monthly');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);

  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const monthsList = [
    { num: 1, name: 'January' },
    { num: 2, name: 'February' },
    { num: 3, name: 'March' },
    { num: 4, name: 'April' },
    { num: 5, name: 'May' },
    { num: 6, name: 'June' },
    { num: 7, name: 'July' },
    { num: 8, name: 'August' },
    { num: 9, name: 'September' },
    { num: 10, name: 'October' },
    { num: 11, name: 'November' },
    { num: 12, name: 'December' },
  ];

  useEffect(() => {
    fetchReport();
  }, [reportType, selectedYear, selectedMonth]);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      if (reportType === 'monthly') {
        const res = await api.reports.getMonthly(selectedYear, selectedMonth);
        setReportData(res);
      } else {
        const res = await api.reports.getAnnual(selectedYear);
        setReportData(res);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch financial report.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = async () => {
    try {
      const csvBlob = await api.transactions.exportCsv();
      const url = window.URL.createObjectURL(csvBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finwise_financial_report_${reportType}_${selectedYear}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert('Failed to download CSV export: ' + err.message);
    }
  };

  return (
    <AppLayout title="Financial Reports & Statements">
      <div className="space-y-6 print:m-0 print:p-0">
        {/* Top Control Bar */}
        <div className="bg-white p-5 rounded-2xl border border-[#D9E2DC] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 print:hidden">
          <div className="flex items-center gap-3">
            {/* View Type Toggle */}
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setReportType('monthly')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  reportType === 'monthly'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Monthly Statement
              </button>
              <button
                onClick={() => setReportType('annual')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                  reportType === 'annual'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                Annual Summary
              </button>
            </div>

            {/* Date Selectors */}
            {reportType === 'monthly' && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-white font-medium text-gray-700 focus:outline-none focus:border-[#16A36A]"
              >
                {monthsList.map((m) => (
                  <option key={m.num} value={m.num}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-white font-medium text-gray-700 focus:outline-none focus:border-[#16A36A]"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 transition"
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-[#10251D] hover:bg-[#1b3d30] text-white transition shadow-sm"
            >
              <Printer size={14} /> Print / Save PDF
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Printable Statement Sheet */}
        <div className="bg-white rounded-2xl border border-[#D9E2DC] p-8 shadow-sm space-y-8 print:border-none print:shadow-none print:p-0">
          {/* Statement Header */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between pb-6 border-b border-gray-100 gap-4">
            <div>
              <div className="text-xs font-semibold text-[#16A36A] uppercase tracking-wider mb-1">
                FinWise AI · Verified Accounting Statement
              </div>
              <h1 className="text-2xl font-bold text-[#17251D]">
                {reportType === 'monthly'
                  ? `${monthsList.find((m) => m.num === selectedMonth)?.name} ${selectedYear} Statement`
                  : `Annual Financial Audit — ${selectedYear}`}
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                Generated dynamically from verified ledger transactions and planning entries.
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">Currency</span>
              <span className="text-sm font-bold text-gray-800">INR (₹ Indian Rupee)</span>
              <span className="text-[10px] text-gray-400 block mt-0.5">Timezone: Asia/Kolkata</span>
            </div>
          </div>

          {/* Key Executive Summary Figures */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
                <ArrowUpRight size={14} className="text-emerald-500" /> Total Inflow / Income
              </div>
              <div className="text-xl font-bold text-emerald-600 mt-2">
                {formatCurrency(reportData?.total_income || 0)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
                <ArrowDownRight size={14} className="text-red-500" /> Total Outflow / Expenses
              </div>
              <div className="text-xl font-bold text-red-600 mt-2">
                {formatCurrency(reportData?.total_expenses || 0)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
                <Wallet size={14} className="text-[#16A36A]" /> Net Cash Flow
              </div>
              <div
                className={`text-xl font-bold mt-2 ${
                  (reportData?.net_cash_flow || 0) >= 0 ? 'text-[#16A36A]' : 'text-red-600'
                }`}
              >
                {formatCurrency(reportData?.net_cash_flow || 0)}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
              <div className="text-xs text-gray-500 font-medium flex items-center gap-1">
                <TrendingUp size={14} className="text-blue-500" /> Savings Rate
              </div>
              <div className="text-xl font-bold text-blue-600 mt-2">
                {reportData?.savings_rate_pct || 0}%
              </div>
            </div>
          </div>

          {/* Monthly View: Budgets & Category Breakdown */}
          {reportType === 'monthly' && (
            <div className="space-y-6">
              {/* Secondary Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 rounded-xl border border-gray-100 bg-white">
                  <span className="text-gray-500">Budgeted Expenditure</span>
                  <div className="font-bold text-base text-gray-800 mt-1">
                    {formatCurrency(reportData?.total_budgeted || 0)}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">
                    Adherence: {reportData?.budget_adherence_pct || 0}% of allocation used
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-gray-100 bg-white">
                  <span className="text-gray-500">Active Savings Goals</span>
                  <div className="font-bold text-base text-gray-800 mt-1">
                    {reportData?.active_goals_count || 0} active targets
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Funded via auto & manual contributions</div>
                </div>

                <div className="p-4 rounded-xl border border-gray-100 bg-white">
                  <span className="text-gray-500">Total Outstanding Liabilities</span>
                  <div className="font-bold text-base text-gray-800 mt-1">
                    {formatCurrency(reportData?.total_outstanding_debt || 0)}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-0.5">Managed through Debt Planner</div>
                </div>
              </div>

              {/* Categorical Spending Breakdown Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <PieIcon size={16} className="text-[#16A36A]" /> Expense Categorization Breakdown
                  </h2>
                  <span className="text-xs text-gray-400">Sorted by expenditure volume</span>
                </div>

                {reportData?.category_breakdown?.length > 0 ? (
                  <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                          <th className="py-2.5 px-4">Category</th>
                          <th className="py-2.5 px-4">Expenditure Amount</th>
                          <th className="py-2.5 px-4">Share of Outflow</th>
                          <th className="py-2.5 px-4">Visual Weight</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {reportData.category_breakdown.map((c: any, idx: number) => (
                          <tr key={idx} className="hover:bg-gray-50/50 transition">
                            <td className="py-3 px-4 font-semibold text-gray-800">{c.category}</td>
                            <td className="py-3 px-4 text-gray-900 font-bold">{formatCurrency(c.amount)}</td>
                            <td className="py-3 px-4 text-gray-600">{c.percentage}%</td>
                            <td className="py-3 px-4 w-48">
                              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#16A36A] rounded-full"
                                  style={{ width: `${Math.min(c.percentage, 100)}%` }}
                                />
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
                    No expense records found for this period.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Annual View: 12-Month Performance Matrix */}
          {reportType === 'annual' && (
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                <BarChart3 size={16} className="text-[#16A36A]" /> Month-by-Month Annual Progression ({selectedYear})
              </h2>

              {reportData?.monthly_summary?.length > 0 ? (
                <div className="overflow-x-auto border border-gray-100 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                        <th className="py-2.5 px-4">Month</th>
                        <th className="py-2.5 px-4">Inflow</th>
                        <th className="py-2.5 px-4">Outflow</th>
                        <th className="py-2.5 px-4">Net Cash Flow</th>
                        <th className="py-2.5 px-4 text-right">Savings Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {reportData.monthly_summary.map((m: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition">
                          <td className="py-3 px-4 font-semibold text-gray-800">
                            {monthsList.find((item) => item.num === m.month)?.name || `Month ${m.month}`}
                          </td>
                          <td className="py-3 px-4 text-emerald-600 font-medium">{formatCurrency(m.income)}</td>
                          <td className="py-3 px-4 text-red-500 font-medium">{formatCurrency(m.expenses)}</td>
                          <td
                            className={`py-3 px-4 font-bold ${
                              m.net_flow >= 0 ? 'text-[#16A36A]' : 'text-red-600'
                            }`}
                          >
                            {formatCurrency(m.net_flow)}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-gray-700">
                            {m.savings_rate_pct}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
                  No annual transaction records logged for {selectedYear}.
                </div>
              )}
            </div>
          )}

          {/* Statement Verification Footer */}
          <div className="pt-6 border-t border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between text-xs text-gray-400 gap-4">
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-[#16A36A]" />
              <span>FinWise Financial Ledger Integrity Seal · Deterministic Python Accounting Engine</span>
            </div>
            <div>Report Ref: FW-AUDIT-{selectedYear}-{reportType.toUpperCase()}</div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
