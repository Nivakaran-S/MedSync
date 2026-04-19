'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { appointmentApi, paymentApi } from '../../services/api';
import { ShieldBan, RefreshCcw, Calendar, CreditCard, TrendingUp, Activity } from 'lucide-react';

interface Appointment {
  _id: string;
  patientName: string;
  doctorName: string;
  specialty: string;
  slotDate: string;
  slotTime: string;
  status: string;
  paymentStatus: string;
  consultationFee: number;
  createdAt: string;
}

interface Payment {
  _id: string;
  appointmentId: string;
  patientId: string;
  doctorName?: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

interface RevenueTotal {
  _id: string;
  total: number;
  count: number;
}

const STATUS_COLOURS: Record<string, { bg: string; color: string }> = {
  pending: { bg: 'var(--warning-light)', color: 'var(--warning)' },
  confirmed: { bg: 'var(--primary-light)', color: 'var(--primary)' },
  completed: { bg: 'var(--success-light)', color: 'var(--success)' },
  cancelled: { bg: 'var(--error-light)', color: 'var(--error)' },
  rejected: { bg: 'var(--error-light)', color: 'var(--error)' },
  paid: { bg: 'var(--success-light)', color: 'var(--success)' },
  unpaid: { bg: 'var(--warning-light)', color: 'var(--warning)' },
  refunded: { bg: 'var(--text-muted)', color: '#fff' },
};

const StatusPill = ({ value }: { value: string }) => {
  const style = STATUS_COLOURS[value] || { bg: 'var(--card-border)', color: 'var(--text-secondary)' };
  return (
    <span className="badge" style={{ background: style.bg, color: style.color, textTransform: 'capitalize' }}>
      {value}
    </span>
  );
};

export default function PlatformOversight() {
  const { user, isLoading } = useAuth();
  const [tab, setTab] = useState<'appointments' | 'payments'>('appointments');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [totals, setTotals] = useState<RevenueTotal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'admin') load();
  }, [user]);

  const load = async () => {
    try {
      setLoading(true);
      const [appts, payRes] = await Promise.all([
        appointmentApi.listAllAppointments(),
        paymentApi.listAllPayments(),
      ]);
      setAppointments(Array.isArray(appts) ? appts : []);
      setPayments(Array.isArray(payRes?.payments) ? payRes.payments : []);
      setTotals(Array.isArray(payRes?.totals) ? payRes.totals : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
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

  const apptByStatus: Record<string, number> = appointments.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Platform Oversight</h1>
          <p className="page-subtitle">Monitor appointments and financial transactions across MedSync.</p>
        </div>
        <button className="med-button secondary" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      <div className="grid-2" style={{ marginBottom: '28px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="med-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', color: 'var(--primary)' }}>
            <Calendar size={18} /><span style={{ fontWeight: 600 }}>Appointments</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{appointments.length}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {apptByStatus.confirmed || 0} confirmed · {apptByStatus.completed || 0} completed
          </div>
        </div>
        <div className="med-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', color: 'var(--accent)' }}>
            <Activity size={18} /><span style={{ fontWeight: 600 }}>Pending</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{apptByStatus.pending || 0}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>awaiting doctor action</div>
        </div>
        <div className="med-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', color: 'var(--success)' }}>
            <CreditCard size={18} /><span style={{ fontWeight: 600 }}>Transactions</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 700 }}>{payments.length}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            {payments.filter(p => p.status === 'paid').length} succeeded
          </div>
        </div>
        <div className="med-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', color: 'var(--primary-dark)' }}>
            <TrendingUp size={18} /><span style={{ fontWeight: 600 }}>Revenue</span>
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>
            {totals.length === 0
              ? '—'
              : totals.map(t => `${(t._id || 'USD').toUpperCase()} ${t.total.toLocaleString()}`).join(' · ')}
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>gross paid volume</div>
        </div>
      </div>

      <div className="tabs-container" style={{ marginBottom: '16px' }}>
        <div className="tabs-header">
          <button className={`tab-button ${tab === 'appointments' ? 'active' : ''}`} onClick={() => setTab('appointments')}>
            Appointments
          </button>
          <button className={`tab-button ${tab === 'payments' ? 'active' : ''}`} onClick={() => setTab('payments')}>
            Payments
          </button>
        </div>
      </div>

      <div className="med-card" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading…</div>
        ) : tab === 'appointments' ? (
          appointments.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px' }}>
              <div className="empty-icon"><Calendar size={40} /></div>
              <h3>No appointments yet</h3>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr style={{ borderBottom: '2px solid var(--card-border)', textAlign: 'left' }}>
                  <th style={{ padding: '14px 16px', fontWeight: 600 }}>Patient</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600 }}>Doctor</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600 }}>Slot</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600 }}>Fee</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '14px 16px', fontWeight: 600 }}>Payment</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map(a => (
                  <tr key={a._id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                    <td style={{ padding: '14px 16px' }}>{a.patientName}</td>
                    <td style={{ padding: '14px 16px' }}>
                      <div>{a.doctorName}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{a.specialty}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div>{a.slotDate}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{a.slotTime}</div>
                    </td>
                    <td style={{ padding: '14px 16px' }}>{a.consultationFee}</td>
                    <td style={{ padding: '14px 16px' }}><StatusPill value={a.status} /></td>
                    <td style={{ padding: '14px 16px' }}><StatusPill value={a.paymentStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : payments.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px' }}>
            <div className="empty-icon"><CreditCard size={40} /></div>
            <h3>No transactions yet</h3>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr style={{ borderBottom: '2px solid var(--card-border)', textAlign: 'left' }}>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>Appointment</th>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>Doctor</th>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>Amount</th>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '14px 16px', fontWeight: 600 }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p._id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                  <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {p.appointmentId.substring(0, 12)}…
                  </td>
                  <td style={{ padding: '14px 16px' }}>{p.doctorName || '—'}</td>
                  <td style={{ padding: '14px 16px' }}>
                    {(p.currency || 'USD').toUpperCase()} {p.amount?.toLocaleString()}
                  </td>
                  <td style={{ padding: '14px 16px' }}><StatusPill value={p.status} /></td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {new Date(p.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
