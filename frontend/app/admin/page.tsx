'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { doctorApi, patientApi, appointmentApi, paymentApi } from '../services/api';
import {
  ShieldBan, Users, UserCheck, AlertTriangle, ArrowRight, Database,
  LayoutDashboard, LineChart, Calendar, CreditCard,
} from 'lucide-react';

interface RevenueRow { _id: string; total: number; count: number }

export default function AdminDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState({
    totalDoctors: 0,
    pendingDoctors: 0,
    totalPatients: 0,
    totalAppointments: 0,
    pendingAppointments: 0,
    revenueRows: [] as RevenueRow[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'admin') loadStats();
  }, [user]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [doctors, patientsRes, appts, payRes] = await Promise.all([
        doctorApi.listDoctors().catch(() => []),
        patientApi.listAllPatients({ limit: 1 }).catch(() => ({ total: 0, items: [] })),
        appointmentApi.listAllAppointments().catch(() => []),
        paymentApi.listAllPayments().catch(() => ({ payments: [], totals: [] })),
      ]);

      const drs = Array.isArray(doctors) ? doctors : [];
      const as = Array.isArray(appts) ? appts : [];

      setStats({
        totalDoctors: drs.length,
        pendingDoctors: drs.filter((d: any) => !d.isVerified).length,
        totalPatients: typeof patientsRes?.total === 'number' ? patientsRes.total : (patientsRes?.items?.length || 0),
        totalAppointments: as.length,
        pendingAppointments: as.filter((a: any) => a.status === 'pending').length,
        revenueRows: Array.isArray(payRes?.totals) ? payRes.totals : [],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return <div className="animate-in" style={{ padding: '20px' }}>Loading dashboard…</div>;
  }

  if (user?.role !== 'admin') {
    return (
      <div className="empty-state">
        <div className="empty-icon"><ShieldBan size={48} /></div>
        <h3>Access Denied</h3>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  const revenueSummary = stats.revenueRows.length === 0
    ? '—'
    : stats.revenueRows
        .map(r => `${(r._id || 'USD').toUpperCase()} ${r.total.toLocaleString()}`)
        .join(' · ');

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Admin Control Center</h1>
          <p className="page-subtitle">Platform-wide overview, user verification, and financial monitoring.</p>
        </div>
        <div className="badge low" style={{ background: 'var(--success-light)', color: 'var(--success)', fontWeight: 600 }}>
          System: Optimal
        </div>
      </div>

      <div className="stats-bar" style={{ marginBottom: '32px' }}>
        <div className="stat-item">
          <div className="stat-value">{stats.totalDoctors}</div>
          <div className="stat-label">Total Doctors</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ color: stats.pendingDoctors > 0 ? 'var(--warning)' : 'inherit' }}>
            {stats.pendingDoctors}
          </div>
          <div className="stat-label">Pending Verification</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.totalPatients}</div>
          <div className="stat-label">Registered Patients</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{stats.totalAppointments}</div>
          <div className="stat-label">Appointments</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ fontSize: '1.4rem' }}>{revenueSummary}</div>
          <div className="stat-label">Gross Revenue</div>
        </div>
      </div>

      <div className="grid-2" style={{ gap: '20px' }}>
        <div className="med-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div className="avatar sm" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <UserCheck size={20} />
            </div>
            <h3 className="card-title" style={{ margin: 0 }}>Doctor Verification</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '18px' }}>
            Review registrations, validate credentials, and toggle access for medical professionals.
          </p>
          <Link href="/admin/doctors" className="med-button primary" style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Manage Doctors <ArrowRight size={16} />
          </Link>
        </div>

        <div className="med-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div className="avatar sm" style={{ background: 'var(--accent-light)', color: 'var(--accent)' }}>
              <Users size={20} />
            </div>
            <h3 className="card-title" style={{ margin: 0 }}>Patient Directory</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '18px' }}>
            Browse every patient account registered on MedSync with contact and demographic info.
          </p>
          <Link href="/admin/patients" className="med-button secondary" style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}>
            View Patients <ArrowRight size={16} />
          </Link>
        </div>

        <div className="med-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div className="avatar sm" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
              <Calendar size={20} />
            </div>
            <h3 className="card-title" style={{ margin: 0 }}>Appointments</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '18px' }}>
            System-wide consultation overview. Pending, confirmed, and completed bookings across providers.
          </p>
          <Link href="/admin/appointments" className="med-button primary" style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} /> View All Bookings <ArrowRight size={16} />
          </Link>
        </div>

        <div className="med-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div className="avatar sm" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
              <CreditCard size={20} />
            </div>
            <h3 className="card-title" style={{ margin: 0 }}>Payments &amp; Revenue</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '18px' }}>
            Platform financial logs. Transaction statuses, revenue distribution, and reconciliation of provider fees.
          </p>
          <Link href="/admin/payments" className="med-button secondary" style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CreditCard size={16} /> Revenue Dashboard <ArrowRight size={16} />
          </Link>
        </div>

        <div className="med-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div className="avatar sm" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <LineChart size={20} />
            </div>
            <h3 className="card-title" style={{ margin: 0 }}>Platform Oversight</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '18px' }}>
            Unified view of appointments and transactions — trend monitoring with live summary totals.
          </p>
          <Link href="/admin/oversight" className="med-button primary" style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Open Oversight <ArrowRight size={16} />
          </Link>
        </div>

        <div className="med-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div className="avatar sm" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
              <Database size={20} />
            </div>
            <h3 className="card-title" style={{ margin: 0 }}>Infrastructure</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '18px' }}>
            Live health status of all 8 microservices — latency monitoring and up/down indicators.
          </p>
          <Link href="/admin/health" className="med-button secondary" style={{ width: '100%', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <LayoutDashboard size={16} /> Service Health Dashboard
          </Link>
        </div>
      </div>

      {stats.pendingDoctors > 0 && (
        <div className="med-card" style={{ border: '1px solid var(--warning-light)', background: 'var(--warning-light)', color: 'var(--warning)', marginTop: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={20} />
            <div>
              <strong>Action required:</strong> {stats.pendingDoctors} doctor{stats.pendingDoctors > 1 ? 's' : ''} awaiting verification.{' '}
              <Link href="/admin/doctors" style={{ color: 'var(--warning)', textDecoration: 'underline' }}>Review now</Link>
            </div>
          </div>
        </div>
      )}

      {stats.pendingAppointments > 0 && (
        <div className="med-card" style={{ border: '1px solid var(--primary-light)', background: 'var(--primary-light)', color: 'var(--primary)', marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Calendar size={20} />
            <div>
              <strong>Heads up:</strong> {stats.pendingAppointments} appointment{stats.pendingAppointments > 1 ? 's' : ''} awaiting doctor response.{' '}
              <Link href="/admin/oversight" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Open oversight</Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
