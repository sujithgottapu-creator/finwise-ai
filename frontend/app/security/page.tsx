'use client';

import React from 'react';
import Link from 'next/link';
import { Activity, ShieldCheck, Lock, Database, KeyRound, ArrowRight, UserCheck } from 'lucide-react';

export default function SecurityPage() {
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
        <Link href="/login" className="px-3 py-1.5 text-xs font-bold text-[#17251D]">
          Log In
        </Link>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16 flex-1 space-y-12">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#DDF8E8] text-[#10251D] text-xs font-bold">
            <ShieldCheck size={14} className="text-[#16A36A]" />
            <span>Honest Security Disclosures</span>
          </div>
          <h1 className="text-4xl font-extrabold text-[#10251D]">Security & Data Architecture</h1>
          <p className="text-sm text-[#64748B] max-w-xl mx-auto">
            We describe actual implemented technical measures only. We do not make unsupported claims of "bank-grade security" or "guaranteed privacy."
          </p>
        </div>

        <div className="space-y-6">
          <SecurityCard
            icon={<KeyRound size={22} className="text-[#16A36A]" />}
            title="Authentication & Password Hashing"
            details="Passwords are hashed locally using modern bcrypt with salted work factors. Sessions are verified server-side with cryptographic JSON Web Tokens (JWT) signed using SHA-256 HMAC secrets. Tokens are issued with standard expiration windows and validated on every backend request."
          />

          <SecurityCard
            icon={<UserCheck size={22} className="text-[#2563EB]" />}
            title="User-Level Data Isolation & Authorization"
            details="User identity is derived strictly from verified JWT claims on the backend, never from untrusted browser query parameters. All database queries enforce strict user_id filtering at the ORM layer, preventing horizontal privilege escalation."
          />

          <SecurityCard
            icon={<Database size={22} className="text-[#F59E0B]" />}
            title="SQL Injection & Parameterized ORM Protection"
            details="All database transactions execute through SQLAlchemy ORM with parameterized prepared statements. No raw, concatenated user strings are ever executed against the database. An LLM agent is strictly prohibited from running arbitrary SQL queries."
          />

          <SecurityCard
            icon={<Lock size={22} className="text-[#8B5CF6]" />}
            title="Data Minimization in AI Prompts"
            details="Prompts dispatched to the AI coordinator and specialist agents pass only aggregated numerical figures necessary to resolve specific planning tasks. No bank credentials, payment card numbers, or passwords are ever passed to LLM APIs."
          />

          <SecurityCard
            icon={<ShieldCheck size={22} className="text-[#10251D]" />}
            title="Consequential Action Gatekeeping"
            details="The AI system is strictly advisory. Agents cannot independently alter budget limits, debit accounts, or execute transfers without explicit, manual user review and approval."
          />
        </div>

        <div className="bg-white rounded-2xl border border-[#D9E2DC] p-6 text-xs text-[#64748B] space-y-2">
          <strong className="text-[#10251D] block text-sm">Data Export and Account Deletion Guarantee</strong>
          <p>
            You have the right to download your entire ledger in standard JSON format at any time. If you choose to delete your account, all associated transactions, budgets, goals, and profiles are permanently erased from the database via cascade deletion.
          </p>
        </div>
      </main>
    </div>
  );
}

function SecurityCard({ icon, title, details }: { icon: React.ReactNode; title: string; details: string }) {
  return (
    <div className="bg-white rounded-2xl border border-[#D9E2DC] p-6 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#F5F7F5] flex items-center justify-center shrink-0">{icon}</div>
        <h2 className="font-extrabold text-base text-[#10251D]">{title}</h2>
      </div>
      <p className="text-xs text-[#64748B] leading-relaxed pl-13">{details}</p>
    </div>
  );
}
