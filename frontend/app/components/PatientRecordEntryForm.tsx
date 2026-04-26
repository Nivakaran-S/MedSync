'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MedCard as Card, MedInput as Input, MedButton as Button, Tabs, showToast } from './UI';
import { patientApi } from '../services/api';
import { Search, FileText, Pill, Upload, User, AlertTriangle, Activity, Syringe } from 'lucide-react';

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

  // ── Patient context (allergies/vitals/vaccinations/conditions/recent records) ──
  const [contextData, setContextData] = useState<any | null>(null);
  const [contextLoading, setContextLoading] = useState(false);

  const loadContext = async (id: string) => {
    if (!id) {
      setContextData(null);
      return;
    }
    setContextLoading(true);
    try {
      const full = await patientApi.getPatientFull(id);
      setContextData(full);
    } catch (e: any) {
      console.warn('[PatientRecordEntryForm] context load failed:', e?.message || e);
      setContextData(null);
    } finally {
      setContextLoading(false);
    }
  };

  useEffect(() => {
    if (selectedId) loadContext(selectedId);
  }, [selectedId]);

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
      loadContext(selectedId);
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
      loadContext(selectedId);
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
      loadContext(selectedId);
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
            {/* ── Existing record context ── */}
            <PatientContextPanel data={contextData} loading={contextLoading} />

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

// ── Read-only summary of the selected patient's existing record. Critical
// allergies surface as a red banner so providers see them before prescribing.
function PatientContextPanel({ data, loading }: { data: any | null; loading: boolean }) {
  if (loading) {
    return (
      <div style={{ padding: 12, marginBottom: 14, background: '#f8fafc', borderRadius: 10, color: '#64748b', fontSize: '0.85rem' }}>
        Loading patient record…
      </div>
    );
  }
  if (!data) {
    return (
      <div style={{ padding: 12, marginBottom: 14, background: '#f8fafc', borderRadius: 10, color: '#64748b', fontSize: '0.85rem' }}>
        Could not load patient context. Continuing without it — safety checks may be limited.
      </div>
    );
  }

  const allergies: any[] = data.profile?.allergies || [];
  const conditions: any[] = data.profile?.chronicConditions || [];
  const vitals: any[] = data.vitalSigns || [];
  const vaccinations: any[] = data.vaccinations || [];
  const recentRx: any[] = (data.prescriptions || []).slice(0, 3);
  const latestVital = vitals.length ? [...vitals].sort((a: any, b: any) => +new Date(b.recordedAt) - +new Date(a.recordedAt))[0] : null;
  const overdueVaccines = vaccinations.filter(v => v.nextDueDate && new Date(v.nextDueDate) < new Date());
  const criticalAllergies = allergies.filter(a => ['severe', 'life-threatening'].includes(a.severity));

  const sevColors: Record<string, { bg: string; fg: string }> = {
    'mild':              { bg: '#dcfce7', fg: '#166534' },
    'moderate':          { bg: '#fef3c7', fg: '#92400e' },
    'severe':            { bg: '#fee2e2', fg: '#991b1b' },
    'life-threatening':  { bg: '#7f1d1d', fg: '#fff' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
      {/* Critical allergy banner */}
      {criticalAllergies.length > 0 && (
        <div style={{
          padding: '12px 14px', borderRadius: 10,
          background: '#fef2f2', border: '1px solid #fecaca',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <AlertTriangle size={20} color="#991b1b" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: '0.88rem', color: '#7f1d1d' }}>
            <strong>Critical allergies on file:</strong>{' '}
            {criticalAllergies.map((a, i) => (
              <span key={a._id || i}>
                {i > 0 && ', '}
                {a.substance} ({a.severity})
              </span>
            ))}
            . Verify before prescribing.
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
        {/* Allergies */}
        <div style={{ padding: 12, borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <AlertTriangle size={14} color="#92400e" />
            <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>Allergies ({allergies.length})</strong>
          </div>
          {allergies.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>None on file.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {allergies.map(a => {
                const c = sevColors[a.severity || 'mild'] || sevColors.mild;
                return (
                  <div key={a._id} style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <strong>{a.substance}</strong>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                      background: c.bg, color: c.fg, textTransform: 'uppercase', letterSpacing: 0.3,
                    }}>{a.severity || 'mild'}</span>
                    {a.reaction && <span style={{ color: '#64748b' }}>· {a.reaction}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active chronic conditions */}
        <div style={{ padding: 12, borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Activity size={14} color="#0369a1" />
            <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>Conditions ({conditions.length})</strong>
          </div>
          {conditions.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>None on file.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {conditions.map(c => (
                <div key={c._id} style={{ fontSize: '0.82rem' }}>
                  <strong>{c.name}</strong>
                  {c.status && <span style={{ color: c.status === 'active' ? '#991b1b' : '#64748b' }}> · {c.status}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latest vitals */}
        <div style={{ padding: 12, borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Activity size={14} color="#16a34a" />
            <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>Latest vitals</strong>
          </div>
          {!latestVital ? (
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>No vitals on file.</p>
          ) : (
            <div style={{ fontSize: '0.82rem', lineHeight: 1.6 }}>
              {latestVital.bloodPressureSystolic && <div>BP {latestVital.bloodPressureSystolic}/{latestVital.bloodPressureDiastolic ?? '—'}</div>}
              {latestVital.heartRateBpm && <div>HR {latestVital.heartRateBpm} bpm</div>}
              {latestVital.temperatureC && <div>Temp {latestVital.temperatureC}°C</div>}
              {latestVital.oxygenSaturation && <div>SpO₂ {latestVital.oxygenSaturation}%</div>}
              {latestVital.bmi && <div>BMI {latestVital.bmi}</div>}
              <div style={{ color: '#94a3b8', fontSize: '0.74rem', marginTop: 2 }}>
                {new Date(latestVital.recordedAt).toLocaleString()}
              </div>
            </div>
          )}
        </div>

        {/* Vaccinations */}
        <div style={{ padding: 12, borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Syringe size={14} color="#7c3aed" />
            <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>Vaccinations ({vaccinations.length})</strong>
            {overdueVaccines.length > 0 && (
              <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 999, background: '#fee2e2', color: '#991b1b', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                {overdueVaccines.length} overdue
              </span>
            )}
          </div>
          {vaccinations.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>None on file.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {vaccinations.slice(0, 4).map(v => {
                const overdue = v.nextDueDate && new Date(v.nextDueDate) < new Date();
                return (
                  <div key={v._id} style={{ fontSize: '0.82rem' }}>
                    <strong>{v.name}</strong>
                    {v.administeredAt && <span style={{ color: '#64748b' }}> · {new Date(v.administeredAt).toLocaleDateString()}</span>}
                    {overdue && <span style={{ color: '#991b1b', fontWeight: 700 }}> · OVERDUE</span>}
                  </div>
                );
              })}
              {vaccinations.length > 4 && (
                <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>+{vaccinations.length - 4} more</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent prescriptions inline (for drug-interaction awareness) */}
      {recentRx.length > 0 && (
        <div style={{ padding: 12, borderRadius: 10, background: '#fff', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Pill size={14} color="#0ea5e9" />
            <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>Recent prescriptions</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recentRx.map((p: any) => {
              const m = Array.isArray(p.medications) && p.medications.length ? p.medications[0] : null;
              const med = m?.medication || p.medication || '—';
              const dose = m?.dosage || p.dosage;
              return (
                <div key={p._id} style={{ fontSize: '0.82rem' }}>
                  <strong>{med}</strong>{dose ? ` — ${dose}` : ''}
                  {p.issuedAt && <span style={{ color: '#94a3b8' }}> · {new Date(p.issuedAt).toLocaleDateString()}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
