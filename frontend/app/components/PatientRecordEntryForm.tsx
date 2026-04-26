'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MedCard as Card, MedInput as Input, MedButton as Button, Tabs, showToast } from './UI';
import { patientApi } from '../services/api';
import { Search, FileText, Pill, Upload, User } from 'lucide-react';

export interface PatientPickerOption {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
}

interface Props {
  patients: PatientPickerOption[];
  loadingPatients?: boolean;
  emptyMessage?: string;
  onSaved?: () => void;
}

export default function PatientRecordEntryForm({ patients, loadingPatients, emptyMessage, onSaved }: Props) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [tab, setTab] = useState(0);

  const filtered = useMemo(() => {
    if (!search.trim()) return patients;
    const q = search.trim().toLowerCase();
    return patients.filter((p) => {
      const name = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
      return (
        name.includes(q) ||
        (p.email || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q)
      );
    });
  }, [patients, search]);

  useEffect(() => {
    if (!selectedId && patients.length > 0) setSelectedId(patients[0]._id);
  }, [patients, selectedId]);

  const selected = patients.find((p) => p._id === selectedId);

  // ── Medical record state ──
  const [recordForm, setRecordForm] = useState({
    description: '',
    diagnosis: '',
    doctor: '',
    notes: '',
    icd10Code: '',
    date: '',
  });
  const [savingRecord, setSavingRecord] = useState(false);

  // ── Prescription state ──
  const [rxForm, setRxForm] = useState({
    medication: '',
    dosage: '',
    frequency: '',
    duration: '',
    instructions: '',
    prescribedBy: '',
  });
  const [savingRx, setSavingRx] = useState(false);

  // ── Document state ──
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('Report');
  const [docDescription, setDocDescription] = useState('');
  const [uploading, setUploading] = useState(false);

  const requireSelection = () => {
    if (!selectedId) {
      showToast('Please select a patient first.', 'warning');
      return false;
    }
    return true;
  };

  const submitRecord = async () => {
    if (!requireSelection()) return;
    if (!recordForm.description.trim()) {
      showToast('Description is required.', 'warning');
      return;
    }
    setSavingRecord(true);
    try {
      await patientApi.doctorAddMedicalRecord(selectedId, recordForm);
      showToast('Medical record saved to patient.', 'success');
      setRecordForm({ description: '', diagnosis: '', doctor: '', notes: '', icd10Code: '', date: '' });
      onSaved?.();
    } catch (e: any) {
      showToast(e?.message || 'Failed to save record.', 'error');
    } finally {
      setSavingRecord(false);
    }
  };

  const submitRx = async () => {
    if (!requireSelection()) return;
    if (!rxForm.medication.trim() || !rxForm.dosage.trim()) {
      showToast('Medication and dosage are required.', 'warning');
      return;
    }
    setSavingRx(true);
    try {
      await patientApi.doctorIssuePrescription(selectedId, rxForm);
      showToast('Prescription issued.', 'success');
      setRxForm({ medication: '', dosage: '', frequency: '', duration: '', instructions: '', prescribedBy: '' });
      onSaved?.();
    } catch (e: any) {
      showToast(e?.message || 'Failed to issue prescription.', 'error');
    } finally {
      setSavingRx(false);
    }
  };

  const submitDoc = async () => {
    if (!requireSelection()) return;
    if (!file) {
      showToast('Choose a file to upload.', 'warning');
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('type', docType);
      if (docDescription) fd.append('description', docDescription);
      await patientApi.doctorUploadDocument(selectedId, fd);
      showToast('Document uploaded.', 'success');
      setFile(null);
      setDocDescription('');
      onSaved?.();
    } catch (e: any) {
      showToast(e?.message || 'Failed to upload document.', 'error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
      {/* ── Patient picker ── */}
      <Card title="Select Patient" icon={<User size={18} />}>
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 12, color: '#94a3b8' }} />
          <input
            className="med-input"
            placeholder="Search by name, email, phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>

        {loadingPatients ? (
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Loading patients…</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            {emptyMessage || 'No patients available.'}
          </p>
        ) : (
          <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filtered.map((p) => {
              const active = p._id === selectedId;
              return (
                <button
                  key={p._id}
                  type="button"
                  onClick={() => setSelectedId(p._id)}
                  style={{
                    textAlign: 'left',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: active ? '2px solid #0ea5e9' : '1px solid #e2e8f0',
                    background: active ? '#f0f9ff' : '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#0f172a' }}>
                    {p.firstName} {p.lastName}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.78rem' }}>
                    {p.email}
                  </div>
                  {p.phone && (
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{p.phone}</div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Entry form ── */}
      <Card
        title={selected ? `Add data for ${selected.firstName} ${selected.lastName}` : 'Add patient data'}
        icon={<FileText size={18} />}
      >
        {!selected ? (
          <p style={{ color: '#64748b' }}>Select a patient on the left to begin.</p>
        ) : (
          <>
            <Tabs
              tabs={['Medical History', 'Prescription', 'Document']}
              activeTab={tab}
              onChange={setTab}
            />

            {tab === 0 && (
              <div style={{ paddingTop: 12 }}>
                <Input
                  label="Description / Reason"
                  value={recordForm.description}
                  onChange={(e) => setRecordForm({ ...recordForm, description: e.target.value })}
                  required
                />
                <Input
                  label="Diagnosis"
                  value={recordForm.diagnosis}
                  onChange={(e) => setRecordForm({ ...recordForm, diagnosis: e.target.value })}
                />
                <Input
                  label="ICD-10 Code"
                  value={recordForm.icd10Code}
                  onChange={(e) => setRecordForm({ ...recordForm, icd10Code: e.target.value })}
                />
                <Input
                  label="Doctor"
                  value={recordForm.doctor}
                  onChange={(e) => setRecordForm({ ...recordForm, doctor: e.target.value })}
                />
                <div className="med-input-group">
                  <label className="med-label">Notes</label>
                  <textarea
                    className="med-input"
                    value={recordForm.notes}
                    onChange={(e) => setRecordForm({ ...recordForm, notes: e.target.value })}
                    rows={3}
                  />
                </div>
                <Input
                  label="Date"
                  type="date"
                  value={recordForm.date}
                  onChange={(e) => setRecordForm({ ...recordForm, date: e.target.value })}
                />
                <Button onClick={submitRecord} disabled={savingRecord} variant="primary">
                  {savingRecord ? 'Saving…' : 'Save Record'}
                </Button>
              </div>
            )}

            {tab === 1 && (
              <div style={{ paddingTop: 12 }}>
                <Input
                  label="Medication"
                  value={rxForm.medication}
                  onChange={(e) => setRxForm({ ...rxForm, medication: e.target.value })}
                  required
                />
                <Input
                  label="Dosage"
                  value={rxForm.dosage}
                  onChange={(e) => setRxForm({ ...rxForm, dosage: e.target.value })}
                  required
                />
                <Input
                  label="Frequency"
                  value={rxForm.frequency}
                  onChange={(e) => setRxForm({ ...rxForm, frequency: e.target.value })}
                />
                <Input
                  label="Duration"
                  value={rxForm.duration}
                  onChange={(e) => setRxForm({ ...rxForm, duration: e.target.value })}
                />
                <div className="med-input-group">
                  <label className="med-label">Instructions</label>
                  <textarea
                    className="med-input"
                    value={rxForm.instructions}
                    onChange={(e) => setRxForm({ ...rxForm, instructions: e.target.value })}
                    rows={3}
                  />
                </div>
                <Input
                  label="Prescribed By"
                  value={rxForm.prescribedBy}
                  onChange={(e) => setRxForm({ ...rxForm, prescribedBy: e.target.value })}
                />
                <Button onClick={submitRx} disabled={savingRx} variant="primary" icon={<Pill size={16} />}>
                  {savingRx ? 'Issuing…' : 'Issue Prescription'}
                </Button>
              </div>
            )}

            {tab === 2 && (
              <div style={{ paddingTop: 12 }}>
                <div className="med-input-group">
                  <label className="med-label">Document Type</label>
                  <select
                    className="med-input"
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                  >
                    <option value="Report">Report</option>
                    <option value="Scan">Scan</option>
                    <option value="Prescription">Prescription</option>
                    <option value="Lab Result">Lab Result</option>
                    <option value="Discharge Summary">Discharge Summary</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <Input
                  label="Description"
                  value={docDescription}
                  onChange={(e) => setDocDescription(e.target.value)}
                />
                <div className="med-input-group">
                  <label className="med-label">File</label>
                  <input
                    type="file"
                    className="med-input"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  {file && (
                    <small style={{ color: '#64748b' }}>
                      Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </small>
                  )}
                </div>
                <Button onClick={submitDoc} disabled={uploading} variant="primary" icon={<Upload size={16} />}>
                  {uploading ? 'Uploading…' : 'Upload Document'}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
