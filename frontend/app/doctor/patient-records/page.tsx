'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { appointmentApi, patientApi } from '../../services/api';
import PatientRecordEntryForm, { PatientPickerOption } from '../../components/PatientRecordEntryForm';
import { ShieldBan } from 'lucide-react';

export default function DoctorPatientRecordsPage() {
  const { user, isLoading } = useAuth();
  const [patients, setPatients] = useState<PatientPickerOption[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPatients = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const appts = await appointmentApi.getDoctorAppointments(user.id);
      const list: any[] = Array.isArray(appts) ? appts : (appts?.items || appts?.appointments || []);

      // Deduplicate patients by id and enrich with profile data when possible.
      const seen = new Map<string, PatientPickerOption>();
      for (const a of list) {
        const id = a.patientId;
        if (!id || seen.has(id)) continue;
        const [first, ...rest] = (a.patientName || '').split(' ');
        seen.set(id, {
          _id: id,
          firstName: first || a.patientName || 'Patient',
          lastName: rest.join(' '),
          email: a.patientEmail,
          phone: a.patientPhone,
        });
      }

      // Best-effort: pull richer profile data for each unique patient (parallel, ignore failures).
      const enriched = await Promise.all(
        Array.from(seen.values()).map(async (p) => {
          try {
            const full = await patientApi.getPatientFull(p._id);
            const profile = full?.profile || full;
            return {
              ...p,
              firstName: profile.firstName || p.firstName,
              lastName: profile.lastName || p.lastName,
              email: profile.email || p.email,
              phone: profile.phone || p.phone,
              dateOfBirth: profile.dateOfBirth,
              gender: profile.gender,
            } as PatientPickerOption;
          } catch {
            return p;
          }
        })
      );

      setPatients(enriched);
    } catch (e) {
      console.error('[doctor/patient-records] load failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'doctor') loadPatients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (isLoading) return <div className="animate-in" style={{ padding: 20 }}>Loading…</div>;

  if (user?.role !== 'doctor') {
    return (
      <div className="empty-state">
        <div className="empty-icon"><ShieldBan size={48} /></div>
        <h3>Access Denied</h3>
        <p>This page is for clinicians only.</p>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <h1 className="page-title">Patient Records — Provider Entry</h1>
      <p className="page-subtitle">
        Choose a patient from your appointment list and add medical history, prescriptions, or
        upload documents on their behalf. Entries are tagged as <strong>Doctor</strong>.
      </p>

      <PatientRecordEntryForm
        patients={patients}
        loadingPatients={loading}
        emptyMessage="You don't have any patients with appointments yet."
        onSaved={loadPatients}
      />
    </div>
  );
}
