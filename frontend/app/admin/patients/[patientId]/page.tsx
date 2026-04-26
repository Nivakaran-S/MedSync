'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../context/AuthContext';
import { patientApi } from '../../../services/api';
import { Card, Tabs, Badge } from '../../../components/UI';
import SourceBadge from '../../../components/SourceBadge';
import { ShieldBan, ArrowLeft, FileText, Activity, ScrollText, Clock } from 'lucide-react';

export default function AdminPatientDetailPage({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = use(params);
  const { user, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [full, setFull] = useState<any>(null);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === 'admin') load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const load = async () => {
    try {
      setLoading(true);
      const [f, log] = await Promise.all([
        patientApi.getPatientFull(patientId).catch(() => null),
        patientApi.getAuditLog(patientId).catch(() => []),
      ]);
      setFull(f);
      setAuditLog(Array.isArray(log) ? log : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading || loading) return <div className="animate-in" style={{ padding: '20px' }}>Loading…</div>;

  if (user?.role !== 'admin') {
    return <div className="empty-state"><div className="empty-icon"><ShieldBan size={48} /></div><h3>Access Denied</h3></div>;
  }

  if (!full) {
    return (
      <div className="empty-state">
        <div className="empty-icon"><FileText size={48} /></div>
        <h3>Patient not found</h3>
        <Link href="/admin/patients" className="med-button secondary">Back</Link>
      </div>
    );
  }

  const p = full.profile;
  const score = full.healthScore || 0;

  return (
    <div className="animate-in">
      <Link href="/admin/patients" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '0.9rem' }}>
        <ArrowLeft size={16} /> Back to all patients
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">{p.firstName} {p.lastName}</h1>
          <p className="page-subtitle">{p.email} · {p.phone || 'no phone'}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: score >= 85 ? 'var(--success-light)' : score >= 70 ? 'var(--primary-light)' : score >= 50 ? 'var(--warning-light)' : 'var(--error-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: score >= 85 ? 'var(--success)' : score >= 70 ? 'var(--primary)' : score >= 50 ? 'var(--warning)' : 'var(--error)',
            fontSize: '1.4rem', fontWeight: 800,
          }}>
            {score}
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Health score</div>
            <div style={{ fontWeight: 600 }}>{score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Attention required'}</div>
          </div>
        </div>
      </div>

      <Tabs
        tabs={['Overview', 'History & Prescriptions', 'Documents', 'Audit Log']}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <div className="tab-content">
        {activeTab === 0 && (
          <div className="grid-2" style={{ gap: '16px' }}>
            <Card title="Demographics" icon={<Activity size={20} />}>
              <div style={{ fontSize: '0.9rem', lineHeight: 1.8 }}>
                <div><strong>Gender:</strong> {p.gender || '—'}</div>
                <div><strong>DOB:</strong> {p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString() : '—'}</div>
                <div><strong>Blood type:</strong> {p.bloodType || '—'}</div>
                {p.emergencyContact?.name && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--card-border)' }}>
                    <strong>Emergency:</strong> {p.emergencyContact.name} ({p.emergencyContact.relationship}) — {p.emergencyContact.phone}
                  </div>
                )}
              </div>
            </Card>

            <Card title={`Allergies (${(p.allergies || []).length})`} icon={<Activity size={20} />}>
              {(p.allergies || []).length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>None recorded.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {p.allergies.map((a: any) => (
                    <div key={a._id} style={{ fontSize: '0.9rem' }}>
                      <strong>{a.substance}</strong>{' '}
                      <Badge text={a.severity} variant={['severe', 'life-threatening'].includes(a.severity) ? 'high' : 'medium'} />
                      {a.reaction && <span style={{ color: 'var(--text-secondary)' }}> · {a.reaction}</span>}
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title={`Active Conditions (${(p.chronicConditions || []).filter((c: any) => c.status === 'active').length})`} icon={<Activity size={20} />}>
              {(p.chronicConditions || []).length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>None recorded.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {p.chronicConditions.map((c: any) => (
                    <div key={c._id} style={{ fontSize: '0.9rem' }}>
                      <strong>{c.name}</strong>{' '}
                      <Badge text={c.status} variant={c.status === 'active' ? 'high' : c.status === 'managed' ? 'medium' : 'low'} />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Latest Vitals" icon={<Activity size={20} />}>
              {(full.vitalSigns || []).length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>None recorded.</p>
              ) : (
                <div style={{ fontSize: '0.9rem', lineHeight: 1.8 }}>
                  {(() => {
                    const v = full.vitalSigns[full.vitalSigns.length - 1];
                    return (
                      <>
                        {v.bloodPressureSystolic && <div><strong>BP:</strong> {v.bloodPressureSystolic}/{v.bloodPressureDiastolic}</div>}
                        {v.heartRateBpm && <div><strong>HR:</strong> {v.heartRateBpm} bpm</div>}
                        {v.temperatureC && <div><strong>Temp:</strong> {v.temperatureC}°C</div>}
                        {v.oxygenSaturation && <div><strong>SpO₂:</strong> {v.oxygenSaturation}%</div>}
                        {v.bmi && <div><strong>BMI:</strong> {v.bmi}</div>}
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Recorded: {new Date(v.recordedAt).toLocaleString()}</div>
                      </>
                    );
                  })()}
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === 1 && (
          <div className="grid-2" style={{ gap: '16px' }}>
            <Card title={`Medical History (${(full.medicalHistory || []).length})`} icon={<ScrollText size={20} />}>
              {full.medicalHistory?.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>No history.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {full.medicalHistory.map((h: any) => (
                    <div key={h._id} className="history-item" style={{ borderLeft: h.source === 'self' ? '3px solid #f59e0b' : undefined }}>
                      <div style={{ fontSize: '0.9rem' }}>
                        <strong>{h.description}</strong>
                        <SourceBadge source={h.source} by={h.createdByName} />
                      </div>
                      {h.diagnosis && <div style={{ fontSize: '0.85rem' }}>Diagnosis: {h.diagnosis}</div>}
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {h.doctor || 'Unknown doctor'} · {new Date(h.date).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card title={`Prescriptions (${(full.prescriptions || []).length})`} icon={<ScrollText size={20} />}>
              {full.prescriptions?.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>None.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {full.prescriptions.map((rx: any) => (
                    <div key={rx._id} className="history-item" style={{ borderLeft: rx.source === 'self' ? '3px solid #f59e0b' : undefined }}>
                      <div style={{ fontSize: '0.9rem' }}>
                        <strong>{rx.medication || (rx.medications && rx.medications[0]?.medication)}</strong> — {rx.dosage || (rx.medications && rx.medications[0]?.dosage)}
                        <SourceBadge source={rx.source} by={rx.createdByName || rx.doctorName} />
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{rx.frequency || ''} {rx.duration ? `· ${rx.duration}` : ''}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{rx.prescribedBy || ''} · {new Date(rx.date).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {activeTab === 2 && (
          <Card title={`Documents (${(full.documents || []).length})`} icon={<FileText size={20} />}>
            {full.documents?.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No documents.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {full.documents.map((d: any) => (
                  <div key={d._id} className="history-item" style={{ display: 'flex', justifyContent: 'space-between', borderLeft: d.source === 'self' ? '3px solid #f59e0b' : undefined }}>
                    <div>
                      <strong>{d.fileName}</strong>
                      <SourceBadge source={d.source} by={d.createdByName} />
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{d.type} · {new Date(d.uploadDate).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {activeTab === 3 && (
          <Card title={`Audit Log (${auditLog.length})`} icon={<Clock size={20} />}>
            {auditLog.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No audit entries.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead style={{ background: '#f8fafc' }}>
                  <tr style={{ borderBottom: '2px solid var(--card-border)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 12px' }}>Timestamp</th>
                    <th style={{ padding: '10px 12px' }}>Accessed by</th>
                    <th style={{ padding: '10px 12px' }}>Role</th>
                    <th style={{ padding: '10px 12px' }}>Action</th>
                    <th style={{ padding: '10px 12px' }}>Resource</th>
                    <th style={{ padding: '10px 12px' }}>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLog.map((e) => (
                    <tr key={e._id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{new Date(e.timestamp).toLocaleString()}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem' }}>{e.accessedBy || '—'}</td>
                      <td style={{ padding: '10px 12px' }}><Badge text={e.accessedByRole} variant={e.accessedByRole === 'admin' ? 'low' : 'info'} /></td>
                      <td style={{ padding: '10px 12px' }}>{e.action}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{e.resource || '—'}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-muted)' }}>{e.ipAddress || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
