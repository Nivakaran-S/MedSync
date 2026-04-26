'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { appointmentApi, patientApi } from '../../services/api';
import { Modal, MedInput as Input, MedButton as Button, showToast } from '../../components/UI';
import PrescriptionEditor from '../../components/PrescriptionEditor';
import SourceBadge from '../../components/SourceBadge';
import {
  User, FileText, Pill, Calendar, ShieldBan, Video,
  CheckCircle, XCircle, Clock, RefreshCcw, Search,
  ChevronDown, AlertCircle, CreditCard
} from 'lucide-react';

interface Appointment {
  _id: string;
  patientId: string;
  patientName: string;
  patientEmail?: string;
  slotDate: string;
  slotTime: string;
  reason?: string;
  consultationFee?: number;
  paymentStatus: string;
  status: string;
  specialty?: string;
  notes?: string;
}

interface PatientRecord {
  profile: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    dateOfBirth?: string;
    gender?: string;
    bloodType?: string;
    allergies?: string;
  };
  medicalHistory: Array<{ _id: string; description: string; diagnosis?: string; doctor?: string; notes?: string; date: string; source?: string; createdByName?: string }>;
  prescriptions: Array<{ _id: string; medication: string; dosage: string; frequency?: string; duration?: string; instructions?: string; prescribedBy?: string; date: string; source?: string; createdByName?: string; doctorName?: string }>;
  documents: Array<{ _id: string; fileName: string; fileUrl: string; type: string; uploadDate: string; source?: string; createdByName?: string }>;
  vitalSigns?: Array<{ _id: string; recordedAt: string; bloodPressureSystolic?: number; bloodPressureDiastolic?: number; heartRateBpm?: number; temperatureC?: number; oxygenSaturation?: number; respiratoryRate?: number; bmi?: number; heightCm?: number; weightKg?: number; bloodGlucose?: number; notes?: string; recordedBy?: string }>;
  vaccinations?: Array<{ _id: string; name: string; dose?: string; administeredAt?: string; administeredBy?: string; batchNumber?: string; nextDueDate?: string; notes?: string }>;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending:   { bg: '#fff7ed', text: '#ea580c' },
  confirmed: { bg: '#f0fdf4', text: '#16a34a' },
  completed: { bg: '#f0f9ff', text: '#0369a1' },
  cancelled: { bg: '#fef2f2', text: '#dc2626' },
  rejected:  { bg: '#fef2f2', text: '#dc2626' },
};

const TABS = ['All', 'Pending', 'Confirmed', 'Completed', 'Cancelled'];

export default function DoctorAppointments() {
  const { user, isLoading } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showRecordsModal, setShowRecordsModal] = useState(false);
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'doctor') loadAppointments();
  }, [user]);

  const loadAppointments = async () => {
    setLoading(true);
    try {
      const data = await appointmentApi.getDoctorAppointments(user!.id);
      setAppointments(Array.isArray(data) ? data.sort((a: any, b: any) => new Date(b.slotDate).getTime() - new Date(a.slotDate).getTime()) : []);
    } catch (err) {
      showToast('Failed to load appointments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStatus = async (id: string, status: string, notes?: string) => {
    try {
      if (status === 'rejected' || status === 'cancelled') {
        await appointmentApi.cancelAppointment(id, { cancelledBy: 'doctor', cancellationReason: notes });
      } else {
        await appointmentApi.updateStatus(id, { status, notes });
      }
      showToast(`Appointment ${status}`, 'success');
      loadAppointments();
    } catch {
      showToast('Failed to update appointment status', 'error');
    }
  };

  const handleOpenPrescription = async (appt: Appointment) => {
    setSelectedAppointment(appt);
    setShowPrescriptionModal(true);
    if (!record || record.profile.id !== appt.patientId) {
      try {
        const data = await patientApi.getPatientFull(appt.patientId);
        setRecord(data);
      } catch {
        // Allergies unavailable — non-blocking
      }
    }
  };

  const handleViewRecords = async (appt: Appointment) => {
    setSelectedAppointment(appt);
    setShowRecordsModal(true);
    setRecord(null);
    setRecordLoading(true);
    try {
      const data = await patientApi.getPatientFull(appt.patientId);
      setRecord(data);
    } catch (err: any) {
      showToast(err.message || 'Failed to load patient record', 'error');
    } finally {
      setRecordLoading(false);
    }
  };

  const onPrescriptionSuccess = () => {
    if (selectedAppointment?.status === 'confirmed') {
      handleStatus(selectedAppointment._id, 'completed', 'Prescription issued');
    }
    setShowPrescriptionModal(false);
  };

  // ── Derived data ──────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: appointments.length,
    pending: appointments.filter(a => a.status === 'pending').length,
    confirmed: appointments.filter(a => a.status === 'confirmed').length,
    completed: appointments.filter(a => a.status === 'completed').length,
    unpaid: appointments.filter(a => a.paymentStatus === 'unpaid' && ['pending', 'confirmed'].includes(a.status)).length,
  }), [appointments]);

  const filtered = useMemo(() => {
    let list = appointments;
    if (activeTab === 1) list = list.filter(a => a.status === 'pending');
    else if (activeTab === 2) list = list.filter(a => a.status === 'confirmed');
    else if (activeTab === 3) list = list.filter(a => a.status === 'completed');
    else if (activeTab === 4) list = list.filter(a => ['cancelled', 'rejected'].includes(a.status));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a =>
        a.patientName?.toLowerCase().includes(q) ||
        a.reason?.toLowerCase().includes(q) ||
        a.slotDate?.includes(q)
      );
    }
    return list;
  }, [appointments, activeTab, searchQuery]);

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (isLoading) return <div className="animate-in" style={{ padding: '20px' }}>Loading...</div>;

  if (user?.role !== 'doctor') {
    return (
      <div className="empty-state">
        <div className="empty-icon"><ShieldBan size={48} /></div>
        <h3>Access Denied</h3>
      </div>
    );
  }

  return (
    <div className="animate-in">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">My Appointments</h1>
          <p className="page-subtitle">Review patient requests, accept, issue prescriptions, and join video consultations.</p>
        </div>
        <button
          className="med-button secondary"
          onClick={loadAppointments}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <RefreshCcw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {/* ── Stats bar ─────────────────────────────────────────────────── */}
      <div className="stats-bar" style={{ marginBottom: '24px' }}>
        {[
          { label: 'Total', value: stats.total, color: 'var(--primary)' },
          { label: 'Pending', value: stats.pending, color: '#ea580c' },
          { label: 'Confirmed', value: stats.confirmed, color: '#16a34a' },
          { label: 'Completed', value: stats.completed, color: '#0369a1' },
          { label: 'Unpaid', value: stats.unpaid, color: '#dc2626' },
        ].map(s => (
          <div key={s.label} className="stat-item">
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px', background: '#f1f5f9', borderRadius: '999px', padding: '4px' }}>
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              style={{
                border: 'none',
                borderRadius: '999px',
                padding: '8px 16px',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: activeTab === i ? 'white' : 'transparent',
                color: activeTab === i ? 'var(--primary)' : 'var(--text-secondary)',
                boxShadow: activeTab === i ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {tab}{i === 1 && stats.pending > 0 ? ` (${stats.pending})` : ''}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="med-input"
            style={{ paddingLeft: '36px', marginBottom: 0, height: '40px' }}
            placeholder="Search patient name, reason, date…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ── Appointment list ──────────────────────────────────────────── */}
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading appointments…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state med-card" style={{ padding: '60px' }}>
          <div className="empty-icon"><Calendar size={40} /></div>
          <h3>No appointments found</h3>
          <p>{searchQuery ? 'Try different search terms.' : 'Bookings from patients will appear here.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {filtered.map(a => {
            const sc = STATUS_COLORS[a.status] || STATUS_COLORS.cancelled;
            const isPaid = a.paymentStatus === 'paid';
            const isUpcoming = ['pending', 'confirmed'].includes(a.status);
            const isConfirmed = a.status === 'confirmed';
            const isPending = a.status === 'pending';
            return (
              <div
                key={a._id}
                className="med-card"
                style={{ padding: '20px 24px', borderLeft: `4px solid ${sc.text}` }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                  {/* Patient info */}
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary), #7c3aed)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0
                      }}>
                        {a.patientName?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{a.patientName}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{a.patientEmail}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={13} /> {new Date(a.slotDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={13} /> {a.slotTime}
                      </span>
                      {a.consultationFee !== undefined && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CreditCard size={13} /> LKR {(a.consultationFee || 0).toLocaleString()}
                        </span>
                      )}
                    </div>

                    {a.reason && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                        <strong>Reason:</strong> {a.reason}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ padding: '4px 10px', borderRadius: '999px', fontWeight: 700, fontSize: '0.75rem', background: sc.bg, color: sc.text }}>
                        {a.status.toUpperCase()}
                      </span>
                      <span style={{
                        padding: '4px 10px', borderRadius: '999px', fontWeight: 700, fontSize: '0.75rem',
                        background: isPaid ? '#f0fdf4' : '#fef2f2',
                        color: isPaid ? '#16a34a' : '#dc2626',
                      }}>
                        {(a.paymentStatus || 'UNPAID').toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignSelf: 'center' }}>
                    <button
                      className="med-button secondary sm"
                      onClick={() => handleViewRecords(a)}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <FileText size={14} /> Records
                    </button>

                    {isConfirmed && (
                      <Link
                        href={`/telemedicine/${a._id}`}
                        className="med-button secondary sm"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                      >
                        <Video size={14} /> Join Video
                      </Link>
                    )}

                    {isPending && (
                      <>
                        <button
                          className="med-button primary sm"
                          onClick={() => handleStatus(a._id, 'confirmed')}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <CheckCircle size={14} /> Accept
                        </button>
                        <button
                          className="med-button danger sm"
                          onClick={() => handleStatus(a._id, 'rejected')}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <XCircle size={14} /> Reject
                        </button>
                      </>
                    )}

                    {isConfirmed && (
                      <>
                        <button
                          className="med-button primary sm"
                          onClick={() => handleOpenPrescription(a)}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Pill size={14} /> Prescribe
                        </button>
                        <button
                          className="med-button secondary sm"
                          onClick={() => handleStatus(a._id, 'completed', 'Consultation finished')}
                        >
                          Mark Done
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Prescription Modal ─────────────────────────────────────── */}
      <Modal
        isOpen={showPrescriptionModal}
        onClose={() => setShowPrescriptionModal(false)}
        title="Issue Clinical Treatment Plan"
        width="800px"
      >
        <PrescriptionEditor
          appointmentId={selectedAppointment?._id || ''}
          patientId={selectedAppointment?.patientId || ''}
          patientName={selectedAppointment?.patientName || ''}
          patientAllergies={record?.profile?.allergies ? (typeof record.profile.allergies === 'string' ? [record.profile.allergies] : record.profile.allergies as any) : []}
          doctorName={user?.name}
          onSuccess={onPrescriptionSuccess}
          onCancel={() => setShowPrescriptionModal(false)}
        />
      </Modal>

      {/* ── Patient Records Modal ──────────────────────────────────── */}
      <Modal
        isOpen={showRecordsModal}
        onClose={() => setShowRecordsModal(false)}
        title={`Records — ${selectedAppointment?.patientName || ''}`}
      >
        {recordLoading ? (
          <div style={{ padding: '24px', textAlign: 'center' }}>Loading patient record…</div>
        ) : !record ? (
          <div style={{ padding: '16px', color: 'var(--text-muted)' }}>No record available.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <section>
              <h4 style={{ marginBottom: '8px', color: 'var(--primary-dark)' }}>Patient Profile</h4>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.8, background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
                <div>Email: {record.profile.email}</div>
                <div>Phone: {record.profile.phone || '—'}</div>
                <div>Gender: {record.profile.gender || '—'}</div>
                <div>DOB: {record.profile.dateOfBirth ? new Date(record.profile.dateOfBirth).toLocaleDateString() : '—'}</div>
                <div>Blood Type: {record.profile.bloodType || '—'}</div>
                <div>Allergies: <strong style={{ color: record.profile.allergies ? '#dc2626' : 'inherit' }}>{record.profile.allergies || '—'}</strong></div>
              </div>
            </section>

            <section>
              <h4 style={{ marginBottom: '8px', color: 'var(--primary-dark)' }}>Medical History ({record.medicalHistory.length})</h4>
              {record.medicalHistory.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No history recorded.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {record.medicalHistory.map(h => (
                    <div key={h._id} style={{ padding: '10px 12px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem', borderLeft: h.source === 'self' ? '3px solid #f59e0b' : '3px solid transparent' }}>
                      <div>
                        <strong>{h.description}</strong>
                        <SourceBadge source={h.source} by={h.createdByName} />
                      </div>
                      {h.diagnosis && <div>Diagnosis: {h.diagnosis}</div>}
                      <div style={{ color: 'var(--text-secondary)' }}>{h.doctor ? `${h.doctor} · ` : ''}{new Date(h.date).toLocaleDateString()}</div>
                      {h.notes && <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>{h.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h4 style={{ marginBottom: '8px', color: 'var(--primary-dark)' }}>Prescriptions ({record.prescriptions.length})</h4>
              {record.prescriptions.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No prescriptions recorded.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {record.prescriptions.map(p => (
                    <div key={p._id} style={{ padding: '10px 12px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem', borderLeft: p.source === 'self' ? '3px solid #f59e0b' : '3px solid transparent' }}>
                      <div>
                        <strong>{p.medication}</strong> — {p.dosage}
                        <SourceBadge source={p.source} by={p.createdByName || p.doctorName} />
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>{p.frequency || '—'} · {p.duration || '—'}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{p.prescribedBy || '—'} · {new Date(p.date).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h4 style={{ marginBottom: '8px', color: 'var(--primary-dark)' }}>Documents ({record.documents.length})</h4>
              {record.documents.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No documents uploaded.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {record.documents.map(d => (
                    <div key={d._id} style={{ padding: '10px 12px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between', borderLeft: d.source === 'self' ? '3px solid #f59e0b' : '3px solid transparent' }}>
                      <div>
                        <strong>{d.fileName}</strong>
                        <SourceBadge source={d.source} by={d.createdByName} />
                        <div style={{ color: 'var(--text-secondary)' }}>{d.type} · {new Date(d.uploadDate).toLocaleDateString()}</div>
                      </div>
                      {d.fileUrl && (
                        <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="med-button secondary sm">View</a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h4 style={{ marginBottom: '8px', color: 'var(--primary-dark)' }}>Vitals ({(record.vitalSigns || []).length})</h4>
              {(record.vitalSigns || []).length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No vitals recorded.</p>
              ) : (
                <div style={{ overflowX: 'auto', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--card-border)' }}>
                        <th style={{ padding: '8px 10px' }}>Recorded</th>
                        <th style={{ padding: '8px 10px' }}>BP</th>
                        <th style={{ padding: '8px 10px' }}>HR</th>
                        <th style={{ padding: '8px 10px' }}>Temp</th>
                        <th style={{ padding: '8px 10px' }}>SpO₂</th>
                        <th style={{ padding: '8px 10px' }}>BMI</th>
                        <th style={{ padding: '8px 10px' }}>Glucose</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...(record.vitalSigns || [])].sort((a, b) => +new Date(b.recordedAt) - +new Date(a.recordedAt)).map(v => (
                        <tr key={v._id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                          <td style={{ padding: '8px 10px' }}>{new Date(v.recordedAt).toLocaleString()}</td>
                          <td style={{ padding: '8px 10px' }}>{v.bloodPressureSystolic ? `${v.bloodPressureSystolic}/${v.bloodPressureDiastolic ?? '—'}` : '—'}</td>
                          <td style={{ padding: '8px 10px' }}>{v.heartRateBpm ?? '—'}</td>
                          <td style={{ padding: '8px 10px' }}>{v.temperatureC ? `${v.temperatureC}°C` : '—'}</td>
                          <td style={{ padding: '8px 10px' }}>{v.oxygenSaturation ? `${v.oxygenSaturation}%` : '—'}</td>
                          <td style={{ padding: '8px 10px' }}>{v.bmi ?? '—'}</td>
                          <td style={{ padding: '8px 10px' }}>{v.bloodGlucose ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section>
              <h4 style={{ marginBottom: '8px', color: 'var(--primary-dark)' }}>Vaccinations ({(record.vaccinations || []).length})</h4>
              {(record.vaccinations || []).length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No vaccinations on file.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(record.vaccinations || []).map(vac => {
                    const overdue = vac.nextDueDate && new Date(vac.nextDueDate) < new Date();
                    return (
                      <div key={vac._id} style={{ padding: '10px 12px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem' }}>
                        <div>
                          <strong>{vac.name}</strong>{vac.dose ? ` · ${vac.dose}` : ''}
                          {overdue && <span style={{ marginLeft: 8, fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#fee2e2', color: '#991b1b', textTransform: 'uppercase', letterSpacing: 0.3 }}>OVERDUE</span>}
                        </div>
                        <div style={{ color: 'var(--text-secondary)' }}>
                          {vac.administeredAt ? `Given ${new Date(vac.administeredAt).toLocaleDateString()}` : 'Date unknown'}
                          {vac.administeredBy ? ` · ${vac.administeredBy}` : ''}
                          {vac.batchNumber ? ` · batch ${vac.batchNumber}` : ''}
                        </div>
                        {vac.nextDueDate && (
                          <div style={{ color: overdue ? '#991b1b' : 'var(--text-muted)', fontSize: '0.82rem' }}>
                            Next due: {new Date(vac.nextDueDate).toLocaleDateString()}
                          </div>
                        )}
                        {vac.notes && <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>{vac.notes}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </Modal>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
