'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  BrainCircuit,
  Sparkles,
  Send,
  ShieldCheck,
  Check,
  X,
  CheckCircle2,
  AlertCircle,
  Activity,
  ArrowUpRight,
  Target,
  Wallet,
  ReceiptText,
  Mail,
} from 'lucide-react';
import { AppLayout } from '@/components/AppLayout';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  agentSteps?: Array<{ agent: string; action: string; output_summary: string }>;
  recommendation?: any;
  dataSources?: string[];
}

function AssistantContent() {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get('prompt') || '';

  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: 'assistant',
      content:
        "Hello! I am your FinWise AI Copilot. I coordinate specialized financial agents (Expense Analyst, Budget Planner, Savings Planner, and Forecasting Agent) to evaluate your verified ledgers. What question or financial scenario can we explore?",
    },
  ]);
  const [input, setInput] = useState(initialPrompt);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const suggestedPrompts = [
    'Analyze my spending this month.',
    'Can I afford a purchase of ₹10,000?',
    'Build a budget based on my income.',
    'Help me save ₹25,000 in six months.',
    'Which budget categories need attention?',
    'What happens if my expenses increase by 15%?',
  ];

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend(textToSend = input) {
    const q = textToSend.trim();
    if (!q || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    try {
      const res = await api.ai.chat(q);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.reply,
          agentSteps: res.agent_steps,
          recommendation: res.recommendation,
          dataSources: res.data_sources,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Unable to complete agent workflow: ${err.message || 'Service temporarily unavailable'}.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(recId: number) {
    try {
      await api.ai.approveRecommendation(recId);
      notify('Recommendation approved and logged to audit trail.');
      // Update local state
      setMessages((prev) =>
        prev.map((m) =>
          m.recommendation && m.recommendation.id === recId
            ? { ...m, recommendation: { ...m.recommendation, status: 'approved' } }
            : m
        )
      );
    } catch (err: any) {
      alert(err.message || 'Failed to approve recommendation.');
    }
  }

  async function handleReject(recId: number) {
    try {
      await api.ai.rejectRecommendation(recId);
      notify('Recommendation declined.');
      setMessages((prev) =>
        prev.map((m) =>
          m.recommendation && m.recommendation.id === recId
            ? { ...m, recommendation: { ...m.recommendation, status: 'rejected' } }
            : m
        )
      );
    } catch (err: any) {
      alert(err.message || 'Failed to reject recommendation.');
    }
  }

  async function handleEmailReport(text: string) {
    try {
      await api.ai.emailReport('FinWise AI Financial Copilot Summary', text);
      notify('Financial report successfully dispatched to your email!');
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch email.');
    }
  }

  return (
    <AppLayout pageTitle="AI Financial Assistant">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Welcome Banner */}
        <div className="text-center max-w-xl mx-auto space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-[#DDF8E8] text-[#16A36A] mx-auto flex items-center justify-center font-bold">
            <BrainCircuit size={24} />
          </div>
          <h1 className="text-2xl font-extrabold text-[#10251D]">FinWise Multi-Agent Copilot</h1>
          <p className="text-xs text-[#64748B]">
            Transparent financial advice powered by coordinated specialist agents and deterministic verification.
          </p>
        </div>

        {/* Suggested Prompt Chips */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {suggestedPrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p)}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-full bg-white border border-[#D9E2DC] hover:border-[#16A36A] hover:bg-[#F0FDF4] transition-all text-[#17251D] shadow-sm flex items-center gap-1"
            >
              <span>{p}</span>
              <ArrowUpRight size={12} className="text-[#16A36A]" />
            </button>
          ))}
        </div>

        {/* Chat Conversation Card */}
        <div className="bg-white rounded-2xl border border-[#D9E2DC] shadow-sm overflow-hidden flex flex-col h-[600px]">
          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex gap-3 max-w-[92%] ${m.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                    m.role === 'user' ? 'bg-[#10251D] text-white' : 'bg-[#DDF8E8] text-[#16A36A]'
                  }`}
                >
                  {m.role === 'user' ? 'You' : <Sparkles size={16} />}
                </div>

                <div className="space-y-3 flex-1">
                  <div
                    className={`p-4 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                      m.role === 'user'
                        ? 'bg-[#10251D] text-white rounded-tr-none'
                        : 'bg-[#F5F7F5] border border-gray-100 text-[#17251D] rounded-tl-none'
                    }`}
                  >
                    {m.content}
                  </div>

                  {m.role === 'assistant' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEmailReport(m.content)}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#16A36A] hover:text-[#128A58] bg-[#F0FDF4] hover:bg-[#DCFCE7] px-2.5 py-1 rounded-lg border border-[#16A36A]/20 transition-all cursor-pointer shadow-xs"
                      >
                        <Mail size={12} /> Email report to my registered inbox
                      </button>
                    </div>
                  )}

                  {/* Multi-Agent Steps Trace */}
                  {m.agentSteps && m.agentSteps.length > 0 && (
                    <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-[11px]">
                      <div className="font-extrabold text-[#10251D] flex items-center gap-1.5">
                        <Activity size={13} className="text-[#16A36A]" />
                        <span>Multi-Agent Execution Breakdown:</span>
                      </div>
                      <div className="space-y-1.5 pl-2 border-l-2 border-[#16A36A]">
                        {m.agentSteps.map((step, sIdx) => (
                          <div key={sIdx} className="flex items-start justify-between gap-2">
                            <span className="font-bold text-gray-700">{step.agent}:</span>
                            <span className="text-[#64748B] text-right">{step.output_summary}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Structured Recommendation Card */}
                  {m.recommendation && (
                    <div className="p-4 bg-[#F0FDF4] border border-[#16A36A]/30 rounded-xl space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-[#16A36A] flex items-center gap-1 uppercase tracking-wider text-[10px]">
                          <ShieldCheck size={14} /> Actionable Recommendation
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            m.recommendation.status === 'approved'
                              ? 'bg-emerald-200 text-emerald-900'
                              : m.recommendation.status === 'rejected'
                              ? 'bg-red-200 text-red-900'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          Status: {m.recommendation.status}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-sm text-[#10251D]">{m.recommendation.title}</h4>
                      <p className="text-gray-600 leading-relaxed">{m.recommendation.explanation}</p>

                      {m.recommendation.status === 'pending' && (
                        <div className="flex items-center gap-2 pt-2 border-t border-[#16A36A]/20">
                          <button
                            onClick={() => handleApprove(m.recommendation.id)}
                            className="px-3.5 py-1.5 bg-[#16A36A] hover:bg-[#128A58] text-white rounded-lg font-bold flex items-center gap-1 transition-all"
                          >
                            <Check size={13} /> Approve Action
                          </button>
                          <button
                            onClick={() => handleReject(m.recommendation.id)}
                            className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 rounded-lg font-bold flex items-center gap-1 transition-all"
                          >
                            <X size={13} /> Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2.5 text-xs text-[#64748B] italic">
                <div className="w-4 h-4 border-2 border-[#16A36A] border-t-transparent rounded-full animate-spin" />
                <span>Coordinating financial specialist agents and verifying policies...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Form Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="p-4 border-t border-[#D9E2DC] bg-[#F5F7F5] flex items-center gap-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about spending, affordability, budgeting, or savings..."
              disabled={loading}
              className="flex-1 px-4 py-3 bg-white border border-[#D9E2DC] rounded-xl text-xs outline-none focus:border-[#16A36A] shadow-sm"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="bg-[#16A36A] hover:bg-[#128A58] disabled:opacity-40 text-white px-5 py-3 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <span>Send</span>
              <Send size={14} />
            </button>
          </form>
        </div>

        <div className="text-center text-[11px] text-[#64748B] flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} className="text-[#16A36A]" />
          <span>
            FinWise AI provides mathematical guidance based on authorized ledgers. Consequential actions require explicit user approval.
          </span>
        </div>
      </div>

      {toast && (
        <div className="toast">
          <CheckCircle2 size={16} /> {toast}
        </div>
      )}
    </AppLayout>
  );
}

export default function AssistantPage() {
  return (
    <Suspense
      fallback={
        <AppLayout title="AI Assistant">
          <div className="flex items-center justify-center h-64 text-xs text-gray-400">
            Loading AI Assistant...
          </div>
        </AppLayout>
      }
    >
      <AssistantContent />
    </Suspense>
  );
}

