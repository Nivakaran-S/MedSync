'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { platformApi } from '../../services/api';
import {
  ShieldBan, RefreshCcw, CheckCircle, XCircle, AlertTriangle,
  Activity, Clock, Wifi
} from 'lucide-react';

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unreachable' | 'error';
  latencyMs: number;
}

interface HealthData {
  timestamp: string;
  overall: 'healthy' | 'degraded';
  services: ServiceHealth[];
}

const SERVICE_LABELS: Record<string, string> = {
  'patient-management': 'Patient Management',
  'doctor-management': 'Doctor Management',
  'appointment': 'Appointment Service',
  'telemedicine': 'Telemedicine',
  'payment': 'Payment Service',
  'notification': 'Notification Service',
  'ai-symptom-checker': 'AI Symptom Checker',
};

const SERVICE_PORTS: Record<string, string> = {
  'patient-management': ':3001',
  'doctor-management': ':3002',
  'appointment': ':3003',
  'telemedicine': ':3004',
  'payment': ':3005',
  'notification': ':3006',
  'ai-symptom-checker': ':3007',
};

export default function PlatformHealthPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(30);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const data = await platformApi.getPlatformHealth();
      setHealth(data);
      setLastRefreshed(new Date());
      setCountdown(30);
    } catch (err) {
      console.error('Health check failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchHealth();
    }
  }, [user, fetchHealth]);

  // Auto-refresh every 30 seconds + countdown
  useEffect(() => {
    if (user?.role !== 'admin') return;
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchHealth();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [user, fetchHealth]);

  if (authLoading) return <div className="animate-in" style={{ padding: '20px' }}>Loading...</div>;

  if (user?.role !== 'admin') {
    return (
      <div className="empty-state">
        <div className="empty-icon"><ShieldBan size={48} /></div>
        <h3>Access Denied</h3>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  const healthyCount = health?.services.filter(s => s.status === 'healthy').length ?? 0;
  const totalCount = health?.services.length ?? 7;

  return (
    <div className="animate-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title">Service Health Dashboard</h1>
          <p className="page-subtitle">Live status monitoring for all MedSync microservices.</p>
          {lastRefreshed && (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Last checked: {lastRefreshed.toLocaleTimeString()} · Auto-refresh in {countdown}s
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {health && (
            <span
              className={`badge ${health.overall === 'healthy' ? 'low' : 'high'}`}
              style={{
                padding: '8px 16px',
                fontSize: '0.9rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: health.overall === 'healthy' ? 'var(--success-light)' : 'var(--warning-light)',
                color: health.overall === 'healthy' ? 'var(--success)' : 'var(--warning)',
              }}
            >
              {health.overall === 'healthy' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
              {health.overall === 'healthy' ? 'All Systems Operational' : 'Degraded Performance'}
            </span>
          )}
          <button
            className="med-button secondary"
            onClick={fetchHealth}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <RefreshCcw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Checking...' : 'Refresh Now'}
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="stats-bar" style={{ marginBottom: '32px' }}>
        <div className="stat-item">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{healthyCount}</div>
          <div className="stat-label">Healthy</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ color: totalCount - healthyCount > 0 ? 'var(--error)' : 'var(--text-muted)' }}>
            {totalCount - healthyCount}
          </div>
          <div className="stat-label">Unreachable</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{totalCount}</div>
          <div className="stat-label">Total Services</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ fontSize: '1.4rem' }}>
            {totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0}%
          </div>
          <div className="stat-label">Uptime Rate</div>
        </div>
      </div>

      {/* Service Cards Grid */}
      {loading && !health ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="med-card" style={{ padding: '24px', opacity: 0.5 }}>
              <div style={{ height: '80px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
          {(health?.services ?? []).map(svc => {
            const isHealthy = svc.status === 'healthy';
            const label = SERVICE_LABELS[svc.name] || svc.name;
            const port = SERVICE_PORTS[svc.name] || '';
            return (
              <div
                key={svc.name}
                className="med-card"
                style={{
                  padding: '24px',
                  border: `1px solid ${isHealthy ? 'var(--success-light)' : 'var(--error-light)'}`,
                  transition: 'all 0.3s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        background: isHealthy ? 'var(--success-light)' : 'var(--error-light)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isHealthy
                        ? <CheckCircle size={20} style={{ color: 'var(--success)' }} />
                        : <XCircle size={20} style={{ color: 'var(--error)' }} />
                      }
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>localhost{port}</div>
                    </div>
                  </div>
                  <span
                    className={`badge ${isHealthy ? 'low' : 'high'}`}
                    style={{
                      background: isHealthy ? 'var(--success-light)' : 'var(--error-light)',
                      color: isHealthy ? 'var(--success)' : 'var(--error)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                    }}
                  >
                    {svc.status.toUpperCase()}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <Clock size={14} />
                    <span>{svc.latencyMs} ms</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <Wifi size={14} />
                    <span>{isHealthy ? 'Reachable' : 'Offline'}</span>
                  </div>
                </div>

                {/* Latency bar */}
                <div style={{ marginTop: '16px', background: 'var(--bg-secondary)', borderRadius: '999px', height: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: isHealthy ? `${Math.min((svc.latencyMs / 500) * 100, 100)}%` : '100%',
                      background: isHealthy
                        ? svc.latencyMs < 100 ? 'var(--success)' : svc.latencyMs < 300 ? 'var(--warning)' : 'var(--error)'
                        : 'var(--error)',
                      borderRadius: '999px',
                      transition: 'width 0.5s ease',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
