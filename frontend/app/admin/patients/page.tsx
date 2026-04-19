'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { patientApi } from '../../services/api';
import { ShieldBan, RefreshCcw, Search, Users, Mail, Phone, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

interface PatientRow {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  accountStatus?: string;
  createdAt: string;
  lastLoginAt?: string;
}

interface PatientPage {
  items: PatientRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminManagePatients() {
  const { user, isLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('');
  const [data, setData] = useState<PatientPage>({ items: [], page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  const load = async (overrides?: { page?: number; search?: string; status?: string }) => {
    try {
      setLoading(true);
      const result = await patientApi.listAllPatients({
        page: overrides?.page ?? page,
        limit,
        search: overrides?.search ?? search,
        status: overrides?.status ?? status,
      });
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') load({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    load({ page: 1 });
  };

  if (isLoading) return <div className="animate-in" style={{ padding: '20px' }}>Loading...</div>;

  if (user?.role !== 'admin') {
    return (
      <div className="empty-state">
        <div className="empty-icon"><ShieldBan size={48} /></div>
        <h3>Access Denied</h3>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  const goPage = (p: number) => {
    if (p < 1 || p > data.totalPages) return;
    setPage(p);
    load({ page: p });
  };

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">Manage Patients</h1>
          <p className="page-subtitle">Browse and search the entire patient directory ({data.total} total).</p>
        </div>
        <button className="med-button secondary" onClick={() => load()} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      <form onSubmit={onSearch} className="med-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px auto', gap: '12px', alignItems: 'end' }}>
          <div style={{ position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Search by name, email, phone..."
              className="med-input"
              style={{ paddingLeft: '40px', marginBottom: 0 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="med-input"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); load({ page: 1, status: e.target.value }); }}
            style={{ marginBottom: 0 }}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deactivated">Deactivated</option>
          </select>
          <button type="submit" className="med-button primary">Search</button>
        </div>
      </form>

      <div className="med-card" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading patients…</div>
        ) : data.items.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px' }}>
            <div className="empty-icon"><Users size={40} /></div>
            <h3>No patients found</h3>
            <p>{search ? 'No matches for your search.' : 'No patients have registered yet.'}</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr style={{ borderBottom: '2px solid var(--card-border)', textAlign: 'left' }}>
                <th style={{ padding: '16px', fontWeight: 600 }}>Patient</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Contact</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Demographics</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Joined</th>
                <th style={{ padding: '16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map(p => (
                <tr key={p._id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: 700 }}>{p.firstName} {p.lastName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ID: {p._id.substring(0, 8)}…</div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9rem' }}>
                      <Mail size={14} /> {p.email}
                    </div>
                    {p.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        <Phone size={14} /> {p.phone}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {p.gender || '—'} {p.dateOfBirth ? `• DOB ${new Date(p.dateOfBirth).toLocaleDateString()}` : ''}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span className={`badge ${p.accountStatus === 'active' ? 'low' : 'high'}`}>
                      {(p.accountStatus || 'active').toUpperCase()}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {new Date(p.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <Link href={`/admin/patients/${p._id}`} className="med-button secondary sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}>
                      <FileText size={14} /> Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {data.totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderTop: '1px solid var(--card-border)' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Page {data.page} of {data.totalPages} · {data.total} total
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="med-button secondary sm" disabled={page <= 1} onClick={() => goPage(page - 1)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ChevronLeft size={14} /> Prev
              </button>
              <button className="med-button secondary sm" disabled={page >= data.totalPages} onClick={() => goPage(page + 1)} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
