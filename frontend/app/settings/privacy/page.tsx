'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/AppLayout';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  User,
  Shield,
  Lock,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  FileJson,
  X,
} from 'lucide-react';

export default function PrivacySettingsPage() {
  const router = useRouter();
  const { logout } = useAuth();

  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExportData = async () => {
    setExporting(true);
    setError(null);
    try {
      const data = await api.settings.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finwise_personal_archive_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 5000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate data export archive.');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== 'DELETE') return;
    setDeleting(true);
    setError(null);
    try {
      await api.settings.deleteAccount();
      logout();
      router.push('/');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to delete account.');
      setDeleting(false);
    }
  };

  return (
    <AppLayout title="Privacy & Data Management">
      <div className="max-w-4xl space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 gap-6 text-sm">
          <Link
            href="/settings/profile"
            className="pb-3 text-gray-500 hover:text-gray-900 flex items-center gap-2 transition"
          >
            <User size={16} /> Profile & Baseline
          </Link>
          <Link
            href="/settings/security"
            className="pb-3 text-gray-500 hover:text-gray-900 flex items-center gap-2 transition"
          >
            <Lock size={16} /> Security & Passwords
          </Link>
          <Link
            href="/settings/privacy"
            className="pb-3 font-semibold text-[#16A36A] border-b-2 border-[#16A36A] flex items-center gap-2"
          >
            <Shield size={16} /> Privacy & Data Export
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-center gap-2">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {exportSuccess && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm flex items-center gap-2">
            <CheckCircle2 size={16} /> Personal data archive generated and downloaded successfully.
          </div>
        )}

        {/* Data Portability Section */}
        <div className="bg-white p-6 rounded-2xl border border-[#D9E2DC] space-y-4">
          <div className="flex items-center gap-2">
            <FileJson size={18} className="text-[#16A36A]" />
            <h2 className="text-base font-bold text-[#17251D]">Data Portability & Export</h2>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            In compliance with open financial data principles and personal privacy standards, you can download a complete,
            machine-readable JSON copy of your entire financial profile, transactions, budgets, savings goals, bills, and debt plans.
          </p>

          <div className="pt-2">
            <button
              onClick={handleExportData}
              disabled={exporting}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-semibold transition disabled:opacity-50"
            >
              <Download size={15} />
              {exporting ? 'Generating JSON Package...' : 'Download Full JSON Archive'}
            </button>
          </div>
        </div>

        {/* Privacy Principles */}
        <div className="bg-white p-6 rounded-2xl border border-[#D9E2DC] space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-[#16A36A]" />
            <h2 className="text-base font-bold text-[#17251D]">Our Data Protection Commitments</h2>
          </div>
          <ul className="text-xs text-gray-600 space-y-2 list-disc pl-5">
            <li>
              <strong>No Advertising Brokerage:</strong> Your financial data is strictly yours. We do not sell or monetize transaction history to advertisers.
            </li>
            <li>
              <strong>Bounded AI Inference:</strong> The multi-agent AI assistant accesses only the data required to calculate your answers. It does not initiate external banking transfers without manual approval.
            </li>
            <li>
              <strong>Audit Logging:</strong> Critical mutations such as data exports and deletions produce immutable audit records for traceability.
            </li>
          </ul>
        </div>

        {/* Danger Zone */}
        <div className="bg-white p-6 rounded-2xl border border-red-200 space-y-4">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle size={18} />
            <h2 className="text-base font-bold">Danger Zone: Permanent Account Deletion</h2>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Permanently deletes your user account, transaction records, budget categories, goals, debt records, and AI agent execution logs. This operation cannot be reversed.
          </p>

          <div className="pt-2">
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold transition"
            >
              <Trash2 size={15} /> Permanently Delete My Account
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-red-200 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle size={20} />
                <h3 className="text-base font-bold">Confirm Account Deletion</h3>
              </div>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              This action will permanently delete all your financial records and credentials from the FinWise database.
            </p>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">
                Type <strong className="text-red-600">DELETE</strong> to confirm:
              </label>
              <input
                type="text"
                placeholder="DELETE"
                value={deleteConfirmationText}
                onChange={(e) => setDeleteConfirmationText(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:border-red-500 font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmationText !== 'DELETE' || deleting}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition disabled:opacity-50"
              >
                {deleting ? 'Deleting Account...' : 'Confirm Permanent Deletion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
