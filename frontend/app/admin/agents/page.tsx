'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppLayout } from '@/components/AppLayout';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import {
  BrainCircuit,
  Activity,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  AlertCircle,
  RefreshCw,
  GitCommit,
  ShieldCheck,
  Search,
} from 'lucide-react';

export default function AdminAgentsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchAgentRuns();
  }, []);

  const fetchAgentRuns = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.admin.getAgents();
      setRuns(data || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to retrieve agent run logs.');
    } finally {
      setLoading(false);
    }
  };

  const filteredRuns = runs.filter((r) => {
    if (filterType === 'all') return true;
    return r.workflow_type === filterType;
  });

  return (
    <AppLayout title="Multi-Agent AI Execution Monitoring">
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 gap-6 text-sm">
          <Link
            href="/admin"
            className="pb-3 text-gray-500 hover:text-gray-900 flex items-center gap-2 transition"
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
            className="pb-3 font-semibold text-[#16A36A] border-b-2 border-[#16A36A] flex items-center gap-2"
          >
            <BrainCircuit size={16} /> Agent Execution Logs
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Multi-Agent Architecture Topology Card */}
        <div className="bg-[#10251D] text-white p-6 rounded-2xl border border-[#16A36A]/30">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[#16A36A] uppercase mb-2">
            <Sparkles size={14} /> Orchestrated Agent Topology
          </div>
          <h2 className="text-xl font-bold">Active Subagents & Policy Safeguards</h2>
          <p className="text-xs text-gray-300 mt-1 max-w-3xl leading-relaxed">
            Every user query triggers deterministic financial computations before being passed through our specialized multi-agent graph.
            Agents operate under strict read-only tool permissions and cannot modify account ledgers without explicit user authorization.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-emerald-400 font-bold text-xs block">1. Coordinator</span>
              <span className="text-[11px] text-gray-300">Classifies intent & orchestrates subagents</span>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-emerald-400 font-bold text-xs block">2. Expense Analyst</span>
              <span className="text-[11px] text-gray-300">Audits outflows & identifies recurring leaks</span>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-emerald-400 font-bold text-xs block">3. Budget Planner</span>
              <span className="text-[11px] text-gray-300">Enforces 50/30/20 feasibility rules</span>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-emerald-400 font-bold text-xs block">4. Savings Planner</span>
              <span className="text-[11px] text-gray-300">Calculates required monthly goal quotas</span>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-purple-400 font-bold text-xs block">5. Policy Validator</span>
              <span className="text-[11px] text-gray-300">Guarantees math bounds & non-destructive actions</span>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-[#D9E2DC] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white font-medium text-gray-700 focus:outline-none focus:border-[#16A36A]"
            >
              <option value="all">All Workflow Types</option>
              <option value="financial_copilot">Financial Copilot</option>
              <option value="expense_audit">Expense Audit</option>
              <option value="budget_plan">Budget Planning</option>
              <option value="savings_optimization">Savings Optimization</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500">
              Total Recorded Executions: <strong>{filteredRuns.length}</strong>
            </span>
            <button
              onClick={fetchAgentRuns}
              className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition"
              title="Refresh logs"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Agent Runs Table */}
        <div className="bg-white rounded-2xl border border-[#D9E2DC] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-100">
                  <th className="py-3 px-4">Run ID</th>
                  <th className="py-3 px-4">Workflow Type</th>
                  <th className="py-3 px-4">User Prompt / Action</th>
                  <th className="py-3 px-4">Latency</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Executed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredRuns.length > 0 ? (
                  filteredRuns.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/50 transition">
                      <td className="py-3 px-4 font-mono text-[11px] text-gray-500">
                        #{r.id}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold text-[11px] bg-blue-50 text-blue-700 border border-blue-200">
                          <GitCommit size={11} />
                          {r.workflow_type || 'financial_copilot'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-gray-800 font-medium max-w-xs truncate">
                        {r.prompt || 'Autonomous financial review run'}
                      </td>

                      <td className="py-3 px-4 text-gray-600 font-mono">
                        {r.execution_time_ms ? `${r.execution_time_ms}ms` : '< 500ms'}
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                          <CheckCircle2 size={13} /> {r.status || 'completed'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right text-gray-500">
                        {formatDate(r.created_at)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400 text-xs">
                      No agent run logs found.
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
