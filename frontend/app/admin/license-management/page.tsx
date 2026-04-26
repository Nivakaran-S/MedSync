'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { doctorApi } from '../../services/api';
import { ShieldBan, ShieldCheck, RefreshCcw, Search, FileImage } from 'lucide-react';
import { showToast, Skeleton } from '../../components/UI';

interface PendingDoctor {
  _id: string;
  name: string;
  specialty: string;
  contact?: { email?: string; phone?: string };
  licenseImageUrl?: string;
  qualifications?: string[];
  consultationFee?: number;
  createdAt?: string;
}

export default function PendingLicensesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [doctors, setDoctors] = useState<PendingDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await doctorApi.listPendingLicenses();
      setDoctors(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to load pending licenses', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') load();
  }, [user]);

  if (authLoading) return <Skeleton type="card" />;

  if (user?.role !== 'admin') {
    return (
      <div className="empty-state">
        <div className="empty-icon"><ShieldBan size={48} /></div>
        <h3>Access Denied</h3>
        <p>Only admins can review pending license submissions.</p>
      </div>
    );
  }

  const filtered = doctors.filter((d) => {
    const t = searchTerm.toLowerCase();
    return (
      !t ||
      d.name?.toLowerCase().includes(t) ||
      d.specialty?.toLowerCase().includes(t) ||
      d.contact?.email?.toLowerCase().includes(t)
    );
  });

  const formatRelative = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const ms = Date.now() - d.getTime();
    const min = Math.floor(ms / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="animate-in" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: '#fef3c7', color: '#b45309',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>Pending Licenses</h1>
            <p className="page-subtitle" style={{ margin: 0 }}>
              {loading ? 'Loading…' : `${doctors.length} doctor${doctors.length === 1 ? '' : 's'} awaiting review`}
            </p>
          </div>
        </div>
        <button className="med-button secondary" onClick={load}>
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      {!loading && doctors.length > 0 && (
        <div className="med-card" style={{ marginBottom: '20px', padding: '12px 16px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Filter by name, specialty or email…"
              className="med-input"
              style={{ paddingLeft: '40px', marginBottom: 0, border: 'none' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: '#94a3b8' }}>Loading pending licenses…</div>
      ) : doctors.length === 0 ? (
        <div className="empty-state" style={{ padding: 60 }}>
          <div className="empty-icon"><ShieldCheck size={40} /></div>
          <h3>All caught up</h3>
          <p>No doctors are currently waiting for license verification.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: 60 }}>
          <div className="empty-icon"><Search size={40} /></div>
          <h3>No matches</h3>
          <p>Try a different search term.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
          {filtered.map((d) => (
            <div
              key={d._id}
              className="med-card"
              style={{ marginBottom: 0, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            >
              <div style={{
                background: '#f1f5f9', height: 180,
                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              }}>
                {d.licenseImageUrl ? (
                  <img
                    src={d.licenseImageUrl}
                    alt={`License for ${d.name}`}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, color: '#94a3b8' }}>
                    <FileImage size={28} />
                    <span style={{ fontSize: '0.85rem' }}>No license uploaded</span>
                  </div>
                )}
              </div>
              <div style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Dr. {d.name}</h3>
                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{formatRelative(d.createdAt)}</span>
                </div>
                <div className="badge low" style={{
                  display: 'inline-block', width: 'fit-content',
                  background: 'var(--primary-light)', color: 'var(--primary)',
                }}>
                  {d.specialty}
                </div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {d.contact?.email}
                </p>
                {d.qualifications && d.qualifications.length > 0 && (
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    {d.qualifications.join(', ')}
                  </p>
                )}
                <div style={{ marginTop: 'auto', paddingTop: 12 }}>
                  <Link href={`/admin/license-management/${d._id}`} className="med-button primary sm" style={{ display: 'inline-flex', gap: 6 }}>
                    Review license &rarr;
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
