'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { patientApi } from '../../services/api';
import PatientRecordEntryForm, { PatientPickerOption } from '../../components/PatientRecordEntryForm';
import { ShieldBan } from 'lucide-react';

export default function AdminPatientRecordsPage() {
  const { user, isLoading } = useAuth();
  const [patients, setPatients] = useState<PatientPickerOption[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPatients = async () => {
    setLoading(true);
    try {
      const result = await patientApi.listAllPatients({ page: 1, limit: 200 });
      setPatients(result?.items || result || []);
    } catch (e) {
      console.error('[admin/patient-records] load failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'admin') loadPatients();
  }, [user]);

  if (isLoading) return <div className="animate-in" style={{ padding: 20 }}>Loading…</div>;

  if (user?.role !== 'admin') {
    return (
      <div className="empty-state">
        <div className="empty-icon"><ShieldBan size={48} /></div>
        <h3>Access Denied</h3>
        <p>This page is for administrators only.</p>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <h1 className="page-title">Patient Records — Admin Entry</h1>
      <p className="page-subtitle">
        Search any patient and add medical history, prescriptions, or upload documents.
        Entries are tagged as <strong>Admin</strong> so the source remains traceable.
      </p>

      <PatientRecordEntryForm
        patients={patients}
        loadingPatients={loading}
        emptyMessage="No registered patients yet."
        onSaved={loadPatients}
      />
    </div>
  );
}
