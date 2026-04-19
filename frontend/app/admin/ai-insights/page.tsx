'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { symptomApi } from '../../services/api';
import { Card } from '../../components/UI';
import { Brain, AlertTriangle, TrendingUp, Activity, ShieldBan, RefreshCcw } from 'lucide-react';

interface Analytics {
  totalChecks: number;
  urgencyBreakdown: Array<{ _id: string; count: number }>;
  topSpecialties: Array<{ _id: string; count: number }>;
  dailyTrend: Array<{ _id: string; count: number; emergencies: number }>;
  windowDays: number;
  generatedAt: string;
}

const URGENCY_COLOR: Record<string, string> = {
  low: 'var(--success)',
  medium: 'var(--warning)',
  high: 'var(--error)',
  emergency: 'var(--emergency)',
};

export default function AdminAIInsights() {
  const { user, isLoading } = useAuth();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'admin') load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await symptomApi.getAdminAnalytics();
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) return <div className="animate-in" style={{ padding: '20px' }}>Loading…</div>;

  if (user?.role !== 'admin') {
    return (
      <div className="empty-state">
        <div className="empty-icon"><ShieldBan size={48} /></div>
        <h3>Access Denied</h3>
      </div>
    );
  }

  const maxDaily = data ? Math.max(1, ...data.dailyTrend.map((d) => d.count)) : 1;

  const urgencyTotal = data ? data.urgencyBreakdown.reduce((s, u) => s + u.count, 0) : 0;
  const totalEmergencies = data
    ? data.urgencyBreakdown.find((u) => u._id === 'emergency')?.count || 0
    : 0;

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">AI Triage Insights</h1>
          <p className="page-subtitle">Population-level signal from the AI Symptom Checker over the last {data?.windowDays || 30} days.</p>
        </div>
        <button className="med-button secondary" onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      {loading || !data ? (
        <div className="med-card" style={{ padding: '40px', textAlign: 'center' }}>Loading analytics…</div>
      ) : (
        <>
          <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '28px', gap: '16px' }}>
            <div className="med-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', color: 'var(--primary)' }}>
                <Brain size={18} /><span style={{ fontWeight: 600 }}>Total checks</span>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>{data.totalChecks}</div>
            </div>
            <div className="med-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', color: 'var(--emergency)' }}>
                <AlertTriangle size={18} /><span style={{ fontWeight: 600 }}>Emergency triage</span>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>{totalEmergencies}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                {urgencyTotal > 0 ? `${Math.round((totalEmergencies / urgencyTotal) * 100)}% of all checks` : '—'}
              </div>
            </div>
            <div className="med-card" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', color: 'var(--accent)' }}>
                <Activity size={18} /><span style={{ fontWeight: 600 }}>Active days</span>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700 }}>{data.dailyTrend.length}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>days with at least one check</div>
            </div>
          </div>

          <div className="grid-2" style={{ gap: '20px' }}>
            <Card title="Urgency Distribution" icon={<TrendingUp size={20} />}>
              {data.urgencyBreakdown.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No data yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.urgencyBreakdown.map((u) => {
                    const pct = urgencyTotal > 0 ? (u.count / urgencyTotal) * 100 : 0;
                    return (
                      <div key={u._id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.9rem' }}>
                          <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{u._id}</span>
                          <span>{u.count} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div style={{ height: '8px', background: 'var(--card-border)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${pct}%`, height: '100%',
                            background: URGENCY_COLOR[u._id] || 'var(--text-muted)',
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card title="Top 10 Recommended Specialties" icon={<Brain size={20} />}>
              {data.topSpecialties.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No data yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.topSpecialties.map((s, i) => (
                    <div key={s._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.9rem' }}>
                        <span style={{ color: 'var(--text-muted)', marginRight: '8px' }}>#{i + 1}</span>
                        {s._id}
                      </span>
                      <span className="badge low">{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card title={`Daily Volume — last ${data.windowDays} days`} icon={<TrendingUp size={20} />} className="" >
            {data.dailyTrend.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No data yet.</p>
            ) : (
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '180px', borderBottom: '1px solid var(--card-border)', paddingBottom: '8px', marginTop: '12px' }}>
                {data.dailyTrend.map((d) => (
                  <div key={d._id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }} title={`${d._id} — ${d.count} checks (${d.emergencies} emergency)`}>
                    <div style={{
                      width: '100%',
                      height: `${(d.count / maxDaily) * 100}%`,
                      background: d.emergencies > 0 ? 'var(--error)' : 'var(--primary)',
                      borderRadius: '3px 3px 0 0',
                      minHeight: '4px',
                    }} />
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}>
                      {d._id.slice(5)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '12px' }}>
            Generated at {new Date(data.generatedAt).toLocaleString()}
          </p>
        </>
      )}
    </div>
  );
}
