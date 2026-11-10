'use client';

import React from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  ShieldCheck,
  BrainCircuit,
  Wallet,
  ReceiptText,
  Target,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  Lock,
  ChevronRight,
  Download,
  CalendarDays,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-[#F5F7F5] text-[#17251D] flex flex-col font-sans">
      {/* 1. Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#D9E2DC]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-inherit no-underline">
            <div className="h-9 w-9 bg-[#10251D] text-[#DDF8E8] rounded-xl flex items-center justify-center font-bold shadow-sm">
              <Activity size={20} />
            </div>
            <div>
              <div className="font-extrabold text-xl tracking-tight">
                finwise<span className="text-[#16A36A]">AI</span>
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#64748B]">
            <Link href="/features" className="hover:text-[#10251D] transition-colors">
              Features
            </Link>
            <a href="#how-it-works" className="hover:text-[#10251D] transition-colors">
              How It Works
            </a>
            <Link href="/security" className="hover:text-[#10251D] transition-colors">
              Security
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="bg-[#16A36A] hover:bg-[#128A58] text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
              >
                Go to Dashboard <ArrowRight size={14} />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-3.5 py-2 text-xs font-bold text-[#17251D] hover:text-[#16A36A] transition-colors"
                >
                  Log In
                </Link>
                <Link
                  href="/register"
                  className="bg-[#16A36A] hover:bg-[#128A58] text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                >
                  Get Started <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="py-16 md:py-24 px-6 max-w-7xl mx-auto flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#DDF8E8] text-[#10251D] text-xs font-bold tracking-wide">
              <Sparkles size={14} className="text-[#16A36A]" />
              <span>Multi-Agent Financial Planning Engine</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#10251D] leading-[1.12]">
              Make smarter decisions with your money<span className="text-[#16A36A]">.</span>
            </h1>

            <p className="text-base sm:text-lg text-[#64748B] max-w-2xl leading-relaxed">
              Understand your spending, plan your savings, and build better financial habits with an intelligent financial planning assistant.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href="/register"
                className="bg-[#16A36A] hover:bg-[#128A58] text-white px-6 py-3.5 rounded-xl text-sm font-bold transition-all shadow-md flex items-center gap-2"
              >
                Get Started Free <ArrowRight size={16} />
              </Link>
              <Link
                href="/features"
                className="bg-white hover:bg-gray-50 text-[#17251D] border border-[#D9E2DC] px-5 py-3.5 rounded-xl text-sm font-bold transition-all shadow-sm"
              >
                Explore Features
              </Link>
            </div>

            <div className="pt-4 flex items-center gap-6 text-xs text-[#64748B]">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-[#16A36A]" />
                <span>Supports Indian Rupees (INR)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-[#16A36A]" />
                <span>Deterministic calculations</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-[#16A36A]" />
                <span>Transparent AI audit trails</span>
              </div>
            </div>
          </div>

          {/* Polished Dashboard Preview Card */}
          <div className="lg:col-span-5">
            <div className="relative rounded-2xl bg-white border border-[#D9E2DC] shadow-xl p-5 overflow-hidden">
              <div className="flex items-center justify-between pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#DDF8E8] text-[#16A36A] flex items-center justify-center font-bold text-xs">
                    N
                  </div>
                  <div>
                    <div className="font-bold text-xs">Workspace Snapshot</div>
                    <div className="text-[10px] text-[#64748B]">October 2026 Sample</div>
                  </div>
                </div>
                <div className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DDF8E8] text-[#16A36A]">
                  Healthy
                </div>
              </div>

              {/* Metric grid */}
              <div className="grid grid-cols-2 gap-3 my-4">
                <div className="p-3 bg-[#F5F7F5] rounded-xl border border-gray-100">
                  <div className="text-[10px] text-[#64748B]">Total Income</div>
                  <div className="text-lg font-extrabold text-[#10251D]">₹60,500</div>
                  <div className="text-[9px] text-[#16A36A]">● Recorded cash inflows</div>
                </div>
                <div className="p-3 bg-[#F5F7F5] rounded-xl border border-gray-100">
                  <div className="text-[10px] text-[#64748B]">Total Expenses</div>
                  <div className="text-lg font-extrabold text-[#10251D]">₹15,879</div>
                  <div className="text-[9px] text-amber-600">● Controlled spending</div>
                </div>
              </div>

              {/* Cash flow banner */}
              <div className="p-3 bg-[#10251D] text-white rounded-xl flex items-center justify-between mb-4">
                <div>
                  <div className="text-[9px] tracking-wider text-[#DDF8E8] font-bold">NET CASH FLOW</div>
                  <div className="text-xl font-extrabold text-white">₹44,621</div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-[#DDF8E8]">SAVINGS RATE</div>
                  <div className="text-xl font-extrabold text-[#16A36A]">74%</div>
                </div>
              </div>

              {/* AI Copilot card */}
              <div className="p-3.5 bg-[#F0FDF4] border border-[#DDF8E8] rounded-xl space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#10251D]">
                  <BrainCircuit size={15} className="text-[#16A36A]" />
                  <span>AI Copilot Finding</span>
                </div>
                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  "You have ₹44,621 in monthly surplus. You can comfortably allocate ₹6,000 toward your Emergency Reserve goal while maintaining bill coverage."
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[10px] text-[#64748B]">
                <span>Illustrative Demonstration Data</span>
                <Link href="/login" className="text-[#16A36A] font-bold flex items-center gap-0.5">
                  Try Live Demo <ChevronRight size={12} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Features Section */}
      <section id="features" className="py-20 bg-white border-y border-[#D9E2DC] px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
            <div className="text-xs font-bold tracking-widest uppercase text-[#16A36A]">COMPREHENSIVE CAPABILITIES</div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#10251D]">
              Everything you need for total financial clarity
            </h2>
            <p className="text-sm sm:text-base text-[#64748B]">
              Built with mathematical rigor, accessible design, and transparent multi-agent reasoning.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Activity className="text-[#16A36A]" size={22} />}
              title="Smart Financial Dashboard"
              description="Monitor monthly income, expenses, net cash flow, and savings rates computed in real time from database ledgers."
            />
            <FeatureCard
              icon={<ReceiptText className="text-[#2563EB]" size={22} />}
              title="Income & Expense Tracking"
              description="Add, filter, paginate, and search transactions. Import CSV bank statements with duplicate detection and export filtered records."
            />
            <FeatureCard
              icon={<Wallet className="text-[#F59E0B]" size={22} />}
              title="Personalized Budgeting"
              description="Establish monthly category spending limits with automatic warning thresholds (80%) and one-click budget cloning."
            />
            <FeatureCard
              icon={<Target className="text-[#16A36A]" size={22} />}
              title="Savings Goals Planning"
              description="Track emergency funds and purchase targets with required monthly contribution quotas and duplicate-safe contribution logs."
            />
            <FeatureCard
              icon={<BrainCircuit className="text-[#8B5CF6]" size={22} />}
              title="Multi-Agent AI Assistant"
              description="A coordinator, expense analyst, budget planner, savings planner, and forecasting agent collaborate to analyze your authorized numbers."
            />
            <FeatureCard
              icon={<TrendingUp className="text-[#10251D]" size={22} />}
              title="Cash-Flow Forecasting"
              description="Simulate what-if scenarios with adjustable income, recurring expenses, unexpected buffers, and one-time purchases."
            />
          </div>
        </div>
      </section>

      {/* 4. How It Works */}
      <section id="how-it-works" className="py-20 px-6 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-16">
          <div className="text-xs font-bold tracking-widest uppercase text-[#16A36A]">SIMPLE THREE-STEP WORKFLOW</div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#10251D]">
            From uncertainty to structured control
          </h2>
          <p className="text-sm sm:text-base text-[#64748B]">
            How FinWise AI guides your personal money management from day one.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <StepCard
            step="01"
            title="Enter your financial information"
            description="Complete the 4-step onboarding wizard or import bank transactions via CSV to establish your verified financial baseline."
          />
          <StepCard
            step="02"
            title="Set goals and receive a plan"
            description="Define savings targets, review proposed category limits, and receive transparent recommendations verified by the policy engine."
          />
          <StepCard
            step="03"
            title="Track progress and adapt"
            description="Monitor cash flow trends, model what-if purchase scenarios, and test debt repayment strategies to reach debt freedom faster."
          />
        </div>
      </section>

      {/* 5. Security & Privacy Section */}
      <section className="py-20 bg-white border-t border-[#D9E2DC] px-6">
        <div className="max-w-4xl mx-auto rounded-3xl bg-[#F5F7F5] border border-[#D9E2DC] p-8 sm:p-12 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#DDF8E8] text-[#16A36A] flex items-center justify-center">
              <Lock size={24} />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-[#10251D]">
                Transparent Security & Data Control
              </h3>
              <p className="text-xs sm:text-sm text-[#64748B]">You remain in complete control of your financial records.</p>
            </div>
          </div>

          <p className="text-sm text-[#64748B] leading-relaxed">
            FinWise AI implements modern bcrypt password hashing, server-side JWT authorization, user-level data isolation, and parameterized ORM queries to prevent unauthorized record access.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="flex items-start gap-2.5 text-xs text-[#17251D]">
              <CheckCircle2 size={16} className="text-[#16A36A] shrink-0 mt-0.5" />
              <span><strong>Data minimization:</strong> Prompts to AI agents include only authorized numerical summaries, never raw credentials.</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-[#17251D]">
              <CheckCircle2 size={16} className="text-[#16A36A] shrink-0 mt-0.5" />
              <span><strong>Explicit approval:</strong> AI agents cannot automatically alter budgets or initiate payments without user confirmation.</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-[#17251D]">
              <CheckCircle2 size={16} className="text-[#16A36A] shrink-0 mt-0.5" />
              <span><strong>Full data export:</strong> Export all transactions, budgets, goals and debt profiles in standard JSON at any time.</span>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-[#17251D]">
              <CheckCircle2 size={16} className="text-[#16A36A] shrink-0 mt-0.5" />
              <span><strong>Account deletion:</strong> Permanent, complete database deletion is available directly in your privacy settings.</span>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-[#D9E2DC] text-xs">
            <span className="text-[#64748B]">Honest security statement. No unsupported bank-grade marketing claims.</span>
            <Link href="/security" className="text-[#16A36A] font-bold flex items-center gap-1">
              Read Security Policy <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="bg-white border-t border-[#D9E2DC] py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-xs text-[#64748B]">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 bg-[#10251D] text-[#DDF8E8] rounded-md flex items-center justify-center font-bold text-xs">
              <Activity size={14} />
            </div>
            <span className="font-bold text-[#10251D]">FinWise AI</span>
            <span>— Financial clarity for everyone.</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 font-medium">
            <Link href="/features" className="hover:text-[#10251D]">Features</Link>
            <Link href="/security" className="hover:text-[#10251D]">Security</Link>
            <Link href="/settings/privacy" className="hover:text-[#10251D]">Privacy Policy</Link>
            <Link href="/login" className="hover:text-[#10251D]">Demo Access</Link>
            <Link href="/dashboard" className="text-[#16A36A] font-bold">Launch App</Link>
          </div>

          <div>
            <span>© 2026 FinWise AI. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-[#F5F7F5] border border-[#D9E2DC] hover:border-[#16A36A] transition-colors space-y-3">
      <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-sm border border-gray-100">
        {icon}
      </div>
      <h3 className="font-extrabold text-base text-[#10251D]">{title}</h3>
      <p className="text-xs text-[#64748B] leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="p-6 rounded-2xl bg-white border border-[#D9E2DC] space-y-3 relative">
      <div className="text-2xl font-black text-[#16A36A] font-mono">{step}</div>
      <h3 className="font-extrabold text-base text-[#10251D]">{title}</h3>
      <p className="text-xs text-[#64748B] leading-relaxed">{description}</p>
    </div>
  );
}
