'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { appointmentApi, patientApi } from '../../services/api';
import { Modal, MedInput as Input, MedButton as Button, showToast } from '../../components/UI';
import PrescriptionEditor from '../../components/PrescriptionEditor';
import { User, FileText, Pill, Calendar, ShieldBan, Video } from 'lucide-react';

interface Appointment {
  _id: string;
  patientId: string;
  patientName: string;
  patientEmail?: string;
  slotDate: string;
  slotTime: string;
  reason?: string;
  paymentStatus: string;
  status: string;
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
  medicalHistory: Array<{ _id: string; description: string; diagnosis?: string; doctor?: string; notes?: string; date: string }>;
  prescriptions: Array<{ _id: string; medication: string; dosage: string; frequency?: string; duration?: string; instructions?: string; prescribedBy?: string; date: string }>;
  documents: Array<{ _id: string; fileName: string; fileUrl: string; type: string; uploadDate: string }>;
}

const statusBadgeClass = (status: string) => {
  if (status === 'confirmed') return 'low';
  if (status === 'pending') return 'medium';
  if (status === 'completed') return 'low';
  return 'high';
};

export default function DoctorAppointments() {
  const { user, isLoading } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showRecordsModal, setShowRecordsModal] = useState(false);
  const [record, setRecord] = useState<PatientRecord | null>(null);
  const [recordLoading, setRecordLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'doctor') loadAppointments();
  }, [user]);

  const loadAppointments = async () => {
    try {
      const data = await appointmentApi.getDoctorAppointments(user!.id);
      setAppointments(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStatus = async (id: string, status: string, notes?: string) => {
    try {
      if (status === 'rejected' || status === 'cancelled') {
        await appointmentApi.cancelAppointment(id, { cancelledBy: 'doctor', cancellationReason: notes });
      } else {
        await appointmentApi.updateStatus(id, { status, notes });
      }
      loadAppointments();
    } catch {
      showToast('Failed to update status', 'error');
    }
  };

  const handleOpenPrescription = async (appt: Appointment) => {
    setSelectedAppointment(appt);
    setShowPrescriptionModal(true);
    // Fetch full record to get allergies if not already loaded
    if (!record || record.profile.id !== appt.patientId) {
      try {
        const data = await patientApi.getPatientFull(appt.patientId);
        setRecord(data);
      } catch (err) {
        console.warn('Could not load patient profile for allergies', err);
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
    // If appointment is confirmed, mark it as completed automatically
    if (selectedAppointment?.status === 'confirmed') {
      handleStatus(selectedAppointment._id, 'completed', 'Prescription issued');
    }
  };

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
      <h1 className="page-title">Manage Appointments</h1>
      <p className="page-subtitle">Review patient records, accept requests, and issue prescriptions.</p>

      <div className="med-card">
        {appointments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><Calendar size={40} /></div>
            <h3>No appointments yet</h3>
            <p>Bookings from patients will appear here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {appointments.map(a => (
              <div key={a._id} className="history-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ minWidth: '240px' }}>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <User size={16} /> {a.patientName}
                  </h4>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {new Date(a.slotDate).toLocaleDateString()} · {a.slotTime}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Reason: {a.reason || 'N/A'} · Payment: {a.paymentStatus}
                  </div>
                  <span className={`badge ${statusBadgeClass(a.status)}`} style={{ marginTop: '6px', textTransform: 'uppercase' }}>
                    {a.status}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    className="med-button secondary sm"
                    onClick={() => handleViewRecords(a)}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <FileText size={14} /> View Records
                  </button>

                  {a.status === 'confirmed' && (
                    <Link
                      href={`/telemedicine/${a._id}`}
                      className="med-button secondary sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                    >
                      <Video size={14} /> Join Video
                    </Link>
                  )}

                  {a.status === 'pending' && (
                    <>
                      <button className="med-button primary sm" onClick={() => handleStatus(a._id, 'confirmed')}>Accept</button>
                      <button className="med-button danger sm" onClick={() => handleStatus(a._id, 'rejected')}>Reject</button>
                    </>
                  )}

                  {a.status === 'confirmed' && (
                    <>
                      <button
                        className="med-button primary sm"
                        onClick={() => handleOpenPrescription(a)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <Pill size={14} /> Issue Prescription
                      </button>
                      <button
                        className="med-button secondary sm"
                        onClick={() => handleStatus(a._id, 'completed', 'Consultation finished')}
                      >
                        Mark Completed
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prescription modal */}
      <Modal
        isOpen={showPrescriptionModal}
        onClose={() => setShowPrescriptionModal(false)}
        title="Issuing Clinical Treatment Plan"
        width="800px"
      >
        <PrescriptionEditor 
          appointmentId={selectedAppointment?._id || ''}
          patientId={selectedAppointment?.patientId || ''}
          patientName={selectedAppointment?.patientName || ''}
          patientAllergies={record?.profile?.allergies ? (typeof record.profile.allergies === 'string' ? [record.profile.allergies] : record.profile.allergies) : []}
          doctorName={user?.name}
          onSuccess={onPrescriptionSuccess}
          onCancel={() => setShowPrescriptionModal(false)}
        />
      </Modal>

      {/* Records modal */}
      <Modal
        isOpen={showRecordsModal}
        onClose={() => setShowRecordsModal(false)}
        title={`Records for ${selectedAppointment?.patientName || ''}`}
      >
        {recordLoading ? (
          <div style={{ padding: '16px' }}>Loading patient record…</div>
        ) : !record ? (
          <div style={{ padding: '16px' }}>No record available.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <section>
              <h4 style={{ marginBottom: '8px', color: 'var(--primary-dark)' }}>Profile</h4>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <div>Email: {record.profile.email}</div>
                <div>Phone: {record.profile.phone || '—'}</div>
                <div>Gender: {record.profile.gender || '—'}</div>
                <div>DOB: {record.profile.dateOfBirth ? new Date(record.profile.dateOfBirth).toLocaleDateString() : '—'}</div>
                <div>Blood type: {record.profile.bloodType || '—'}</div>
                <div>Allergies: {record.profile.allergies || '—'}</div>
              </div>
            </section>

            <section>
              <h4 style={{ marginBottom: '8px', color: 'var(--primary-dark)' }}>
                Medical History ({record.medicalHistory.length})
              </h4>
              {record.medicalHistory.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No history recorded.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {record.medicalHistory.map(h => (
                    <div key={h._id} style={{ padding: '10px 12px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem' }}>
                      <strong>{h.description}</strong>
                      {h.diagnosis && <div>Diagnosis: {h.diagnosis}</div>}
                      <div style={{ color: 'var(--text-secondary)' }}>
                        {h.doctor ? `${h.doctor} · ` : ''}{new Date(h.date).toLocaleDateString()}
                      </div>
                      {h.notes && <div style={{ fontStyle: 'italic', color: 'var(--text-secondary)' }}>{h.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h4 style={{ marginBottom: '8px', color: 'var(--primary-dark)' }}>
                Prescriptions ({record.prescriptions.length})
              </h4>
              {record.prescriptions.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No prescriptions recorded.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {record.prescriptions.map(p => (
                    <div key={p._id} style={{ padding: '10px 12px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem' }}>
                      <strong>{p.medication}</strong> — {p.dosage}
                      <div style={{ color: 'var(--text-secondary)' }}>
                        {p.frequency || '—'} · {p.duration || '—'}
                      </div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                        {p.prescribedBy || '—'} · {new Date(p.date).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h4 style={{ marginBottom: '8px', color: 'var(--primary-dark)' }}>
                Documents ({record.documents.length})
              </h4>
              {record.documents.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No documents uploaded.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {record.documents.map(d => (
                    <div key={d._id} style={{ padding: '10px 12px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <strong>{d.fileName}</strong>
                        <div style={{ color: 'var(--text-secondary)' }}>
                          {d.type} · {new Date(d.uploadDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </Modal>
    </div>
  );
}
