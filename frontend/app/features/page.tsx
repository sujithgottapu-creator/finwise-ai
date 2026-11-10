'use client';

import React from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  ReceiptText,
  Wallet,
  Target,
  BrainCircuit,
  TrendingUp,
  CreditCard,
  CalendarDays,
  FileText,
  Lock,
  Sparkles,
} from 'lucide-react';

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-[#F5F7F5] text-[#17251D] flex flex-col font-sans">
      <header className="bg-white border-b border-[#D9E2DC] px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 text-inherit no-underline">
          <div className="h-9 w-9 bg-[#10251D] text-[#DDF8E8] rounded-xl flex items-center justify-center font-bold">
            <Activity size={20} />
          </div>
          <div className="font-extrabold text-xl tracking-tight">
            finwise<span className="text-[#16A36A]">AI</span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="px-3 py-1.5 text-xs font-bold text-[#17251D]">
            Log In
          </Link>
          <Link
            href="/register"
            className="bg-[#16A36A] hover:bg-[#128A58] text-white px-4 py-2 rounded-lg text-xs font-bold"
          >
            Get Started Free
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16 flex-1 space-y-16">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <div className="text-xs font-bold tracking-widest uppercase text-[#16A36A]">SYSTEM ARCHITECTURE</div>
          <h1 className="text-4xl font-extrabold text-[#10251D]">Explore FinWise AI Features</h1>
          <p className="text-sm text-[#64748B]">
            Engineered from first principles with deterministic finance formulas, multi-agent AI collaboration, and relational data structures.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <FeatureDetail
            icon={<Activity className="text-[#16A36A]" size={24} />}
            title="Real-Time Dashboard & Cash Flow Visuals"
            description="Computes monthly income, expenses, positive net cash flow, and savings rate. Handles zero income and negative balances explicitly with area and donut charts."
            bullets={[
              'Strict sign convention for inflows and outflows',
              'Explicit zero income and negative cash flow handling',
              'Past 6-month historical income vs expense comparison',
            ]}
          />

          <FeatureDetail
            icon={<ReceiptText className="text-[#2563EB]" size={24} />}
            title="Transaction Management & CSV Pipeline"
            description="Comprehensive ledger for income and expense transactions with search, date filtering, pagination, and automated CSV import duplicate detection."
            bullets={[
              'Add, edit, delete, and search transactions',
              'CSV statement upload with duplicate entry warning',
              'CSV export for external spreadsheet workflows',
            ]}
          />

          <FeatureDetail
            icon={<Wallet className="text-[#F59E0B]" size={24} />}
            title="Category Budgets & Warning Thresholds"
            description="Control spending with category limits (Housing, Food, Transport, Lifestyle, etc.). Tracks spent amount against threshold warning badges."
            bullets={[
              'Warning alerts at 80% category utilization',
              'One-click clone previous month limits',
              'AI budget proposals require manual user acceptance',
            ]}
          />

          <FeatureDetail
            icon={<Target className="text-[#16A36A]" size={24} />}
            title="Savings Goals & Quota Allocation"
            description="Manage emergency reserves, travel funds, and hardware goals. Calculates required monthly contributions based on time until target date."
            bullets={[
              'Handles past deadlines and completed targets',
              'Idempotent contribution records prevent duplicate billing',
              'Live completion percentages and progress bars',
            ]}
          />

          <FeatureDetail
            icon={<BrainCircuit className="text-[#8B5CF6]" size={24} />}
            title="Multi-Agent AI Financial Assistant"
            description="Coordinates specialized agents: Expense Analyst, Budget Planner, Savings Planner, and Forecasting Agent. All monetary figures verified before display."
            bullets={[
              'Affordability checks (e.g. Can I afford ₹10,000?)',
              'Policy validation engine verifies liquidity constraints',
              'Structured recommendation cards with Approve/Reject actions',
            ]}
          />

          <FeatureDetail
            icon={<CreditCard className="text-[#DC2626]" size={24} />}
            title="Debt Snowball vs Avalanche Comparator"
            description="Compare repayment strategies mathematically. Shows exact interest saved and debt-free schedules using deterministic month-by-month compounding."
            bullets={[
              'Avalanche: Highest interest rate prioritization',
              'Snowball: Lowest balance psychological win',
              'Simulates extra monthly payments to accelerate payoff',
            ]}
          />
        </div>

        <div className="bg-white rounded-2xl border border-[#D9E2DC] p-8 text-center space-y-4">
          <h2 className="text-2xl font-extrabold text-[#10251D]">Ready to take control of your finances?</h2>
          <p className="text-xs text-[#64748B] max-w-md mx-auto">
            Experience the complete FinWise AI interface with pre-loaded demonstration data.
          </p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-[#16A36A] hover:bg-[#128A58] text-white px-6 py-3 rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              Launch Interactive Demo <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function FeatureDetail({
  icon,
  title,
  description,
  bullets,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#D9E2DC] p-7 space-y-4">
      <div className="w-12 h-12 rounded-xl bg-[#F5F7F5] flex items-center justify-center">{icon}</div>
      <h3 className="font-extrabold text-lg text-[#10251D]">{title}</h3>
      <p className="text-xs text-[#64748B] leading-relaxed">{description}</p>
      <ul className="space-y-2 pt-2 border-t border-gray-100 text-xs text-[#17251D]">
        {bullets.map((b, idx) => (
          <li key={idx} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A36A]" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
