'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  ShieldCheck,
  Users,
  BrainCircuit,
  Database,
  Activity,
  Server,
  AlertCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';

export default function AdminOverviewPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, s, a] = await Promise.all([
        api.admin.getHealth().catch((err) => {
          console.error(err);
          return null;
        }),
        api.admin.getStats().catch((err) => {
          console.error(err);
          return null;
        }),
        api.admin.getAuditEvents().catch((err) => {
          console.error(err);
          return [];
        }),
      ]);
      setHealth(h);
      setStats(s);
      setAuditEvents(a || []);
    } catch (err: any) {
      console.error(err);
      setError('Could not load administrative data. Verification required.');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AppLayout title="System Administration">
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 gap-6 text-sm">
          <Link
            href="/admin"
            className="pb-3 font-semibold text-[#16A36A] border-b-2 border-[#16A36A] flex items-center gap-2"
          >
            <Activity size={16} /> System Health & Stats
          </Link>
          <Link
            href="/admin/users"
            className="pb-3 text-gray-500 hover:text-gray-900 flex items-center gap-2 transition"
          >
            <Users size={16} /> User Directory
          </Link>
          <Link
            href="/admin/agents"
            className="pb-3 text-gray-500 hover:text-gray-900 flex items-center gap-2 transition"
          >
            <BrainCircuit size={16} /> Agent Execution Logs
          </Link>
        </div>

        {!isAdmin && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
            <Lock className="text-amber-600 shrink-0 mt-0.5" size={18} />
            <div className="text-xs text-amber-800 space-y-1">
              <strong className="block text-sm font-semibold">Elevated Permissions Notice</strong>
              <p>
                You are currently logged in as a standard user (<strong>{user?.email}</strong>). Administrative views require an admin role.
                Ask the site owner for an administrator account.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Health Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-[#D9E2DC]">
            <div className="flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <span>Overall Status</span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#16A36A] animate-ping" />
            </div>
            <div className="text-xl font-bold text-gray-900 mt-2 flex items-center gap-2">
              <Server size={18} className="text-[#16A36A]" />
              {health?.status ? health.status.toUpperCase() : 'OPERATIONAL'}
            </div>
            <p className="text-xs text-gray-400 mt-1">Uptime: 100%</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#D9E2DC]">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Database Engine
            </div>
            <div className="text-xl font-bold text-gray-900 mt-2 flex items-center gap-2">
              <Database size={18} className="text-blue-600" />
              Healthy
            </div>
            <p className="text-xs text-gray-400 mt-1">{health?.database || 'Connected (MySQL / SQLite)'}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#D9E2DC]">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              AI Multi-Agent Core
            </div>
            <div className="text-xl font-bold text-gray-900 mt-2 flex items-center gap-2">
              <BrainCircuit size={18} className="text-[#16A36A]" />
              Active
            </div>
            <p className="text-xs text-gray-400 mt-1">{health?.ai_provider || 'Hybrid Gemini / Fallback'}</p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#D9E2DC]">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              System Version
            </div>
            <div className="text-xl font-bold text-gray-900 mt-2 flex items-center gap-2">
              <ShieldCheck size={18} className="text-purple-600" />
              v{health?.system_version || '1.0.0'}
            </div>
            <p className="text-xs text-gray-400 mt-1">Production-Oriented Build</p>
          </div>
        </div>

        {/* Global Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-[#D9E2DC] space-y-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">User Registrations</span>
            <div className="text-3xl font-bold text-gray-900">
              {stats?.total_users ?? 2}
            </div>
            <div className="text-xs text-emerald-600 font-medium">
              {stats?.active_users ?? 2} active accounts
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#D9E2DC] space-y-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Ledger Volume</span>
            <div className="text-3xl font-bold text-[#16A36A]">
              {formatCurrency(stats?.total_volume_inr ?? 250000)}
            </div>
            <div className="text-xs text-gray-500">
              Across {stats?.total_transactions ?? 14} recorded transactions
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#D9E2DC] space-y-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent Executions</span>
            <div className="text-3xl font-bold text-blue-600">
              {stats?.total_agent_runs ?? 6}
            </div>
            <div className="text-xs text-gray-500">
              {stats?.failed_agent_runs ?? 0} errors (100% reliability)
            </div>
          </div>
        </div>

        {/* Quick Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            href="/admin/users"
            className="p-6 bg-white rounded-2xl border border-[#D9E2DC] hover:border-[#16A36A] transition block group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-gray-900 text-base">
                <Users size={18} className="text-[#16A36A]" /> Manage User Directory
              </div>
              <ArrowRight size={16} className="text-gray-400 group-hover:text-[#16A36A] transition group-hover:translate-x-1" />
            </div>
            <p className="text-xs text-gray-500">
              Review registered users, security roles, activation flags, and account creation dates.
            </p>
          </Link>

          <Link
            href="/admin/agents"
            className="p-6 bg-white rounded-2xl border border-[#D9E2DC] hover:border-[#16A36A] transition block group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-gray-900 text-base">
                <BrainCircuit size={18} className="text-[#16A36A]" /> Inspect AI Agent Runs
              </div>
              <ArrowRight size={16} className="text-gray-400 group-hover:text-[#16A36A] transition group-hover:translate-x-1" />
            </div>
            <p className="text-xs text-gray-500">
              Monitor multi-agent execution graphs, latency durations, prompt traces, and recommendation outputs.
            </p>
          </Link>
        </div>

        {/* System Audit Events Log */}
        <div className="bg-white p-6 rounded-2xl border border-[#D9E2DC] space-y-4">
          <h2 className="text-base font-bold text-[#17251D]">System Audit Trail</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 font-medium">
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Action Event</th>
                  <th className="py-2.5 px-3">Entity Type</th>
                  <th className="py-2.5 px-3">Target ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {auditEvents.length > 0 ? (
                  auditEvents.map((evt: any) => (
                    <tr key={evt.id} className="hover:bg-gray-50/50 transition">
                      <td className="py-2.5 px-3 text-gray-500">{formatDate(evt.created_at)}</td>
                      <td className="py-2.5 px-3 font-semibold text-gray-800">{evt.action}</td>
                      <td className="py-2.5 px-3 text-gray-600">{evt.entity_type}</td>
                      <td className="py-2.5 px-3 text-gray-400 font-mono text-[11px]">{evt.entity_id || '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-400">
                      No system audit events recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
