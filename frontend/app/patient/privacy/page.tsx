'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Download, RefreshCcw, History, User, UserCog } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { patientApi } from '../../services/api';
import { showToast, Skeleton } from '../../components/UI';

interface AuditEntry {
  timestamp: string;
  accessedByRole: 'patient' | 'doctor' | 'admin';
  action: string;
  resource?: string | null;
}

const roleIcon = (role: string) => {
  if (role === 'doctor') return <UserCog size={14} />;
  if (role === 'admin') return <Shield size={14} />;
  return <User size={14} />;
};

const formatRelative = (iso: string) => {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1)  return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)  return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7)  return `${day}d ago`;
  return d.toLocaleString();
};

export default function PrivacyPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'patient')) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  const load = async () => {
    setLoading(true);
    try {
      const data = await patientApi.getMyAuditLog();
      setEntries(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to load activity', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user?.role === 'patient') load(); }, [user]);

  const exportData = async () => {
    setExporting(true);
    try {
      await patientApi.exportMyData();
      showToast('Your data export has been downloaded.', 'success');
      load(); // refresh — the export itself was logged
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  if (isLoading || !user) return <Skeleton type="card" />;

  return (
    <div className="animate-in" style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: '#eff6ff', color: '#0ea5e9',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Shield size={22} />
        </div>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Privacy & Activity</h1>
          <p className="page-subtitle" style={{ margin: 0 }}>
            See who has accessed your record, and download a copy of your data.
          </p>
        </div>
      </div>

      {/* Export card */}
      <div className="med-card" style={{ marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Download size={18} /> Download my data
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 14px' }}>
          A JSON snapshot containing your profile, allergies, vitals, vaccinations, conditions,
          family history, insurance, medical history, prescriptions and uploaded document metadata.
          Each export is logged below.
        </p>
        <button
          className="med-button primary"
          onClick={exportData}
          disabled={exporting}
        >
          <Download size={14} /> {exporting ? 'Preparing…' : 'Download JSON'}
        </button>
      </div>

      {/* Activity card */}
      <div className="med-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <History size={18} /> Recent activity
          </h3>
          <button className="med-button secondary sm" onClick={load} disabled={loading}>
            <RefreshCcw size={14} /> Refresh
          </button>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
        ) : !entries || entries.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>
            No activity recorded yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {entries.map((e, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 0',
                  borderBottom: i === entries.length - 1 ? 'none' : '1px solid #f1f5f9',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: '#f8fafc', color: '#475569',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {roleIcon(e.accessedByRole)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>
                    {e.action.replace(/_/g, ' ').toLowerCase()}
                    {e.resource ? <span style={{ color: '#94a3b8', fontWeight: 400 }}> · {e.resource}</span> : null}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    by <strong>{e.accessedByRole}</strong> · {formatRelative(e.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
