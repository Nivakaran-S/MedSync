'use client';

import React, { useEffect, useState } from 'react';
import { patientApi } from '../../services/api';
import { Card, Button, Badge, Tabs, Modal, MedInput as Input, showToast } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import {
  Activity, AlertTriangle, Syringe, HeartPulse, Users as UsersIcon,
  ShieldCheck, Plus, Trash2, Award,
} from 'lucide-react';

const SEVERITY = ['mild', 'moderate', 'severe', 'life-threatening'];
const STATUS = ['active', 'managed', 'in remission', 'resolved'];
const RELATIONS = ['mother', 'father', 'sibling', 'grandparent', 'aunt', 'uncle', 'cousin', 'child', 'other'];

export default function PatientHealthPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);

  // Health summary
  const [score, setScore] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);

  // Sub-collections
  const [allergies, setAllergies] = useState<any[]>([]);
  const [vitalSigns, setVitalSigns] = useState<any[]>([]);
  const [vaccinations, setVaccinations] = useState<any[]>([]);
  const [conditions, setConditions] = useState<any[]>([]);
  const [familyHistory, setFamilyHistory] = useState<any[]>([]);
  const [insurance, setInsurance] = useState<any>({});

  // Modal state
  const [modal, setModal] = useState<null | 'allergy' | 'vital' | 'vaccination' | 'condition' | 'family' | 'insurance'>(null);
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (user?.role === 'patient') loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadAll = async () => {
    try {
      const [s, sum, all, vit, vac, con, fam, ins] = await Promise.all([
        patientApi.getHealthScore().catch(() => null),
        patientApi.getMedicalSummary().catch(() => null),
        patientApi.getAllergies().catch(() => []),
        patientApi.getVitalSigns().catch(() => []),
        patientApi.getVaccinations().catch(() => []),
        patientApi.getChronicConditions().catch(() => []),
        patientApi.getFamilyHistory().catch(() => []),
        patientApi.getInsurance().catch(() => ({})),
      ]);
      setScore(s);
      setSummary(sum);
      setAllergies(all || []);
      setVitalSigns(vit || []);
      setVaccinations(vac || []);
      setConditions(con || []);
      setFamilyHistory(fam || []);
      setInsurance(ins || {});
    } catch (err) {
      console.error(err);
    }
  };

  const open = (type: typeof modal, prefill: any = {}) => {
    setForm(prefill);
    setModal(type);
  };
  const close = () => { setModal(null); setForm({}); };

  // ── Submit handlers ──
  const submit = async () => {
    try {
      switch (modal) {
        case 'allergy':
          await patientApi.addAllergy(form);
          showToast('Allergy recorded', 'success'); break;
        case 'vital':
          await patientApi.addVitalSign({
            ...form,
            heightCm: form.heightCm ? Number(form.heightCm) : undefined,
            weightKg: form.weightKg ? Number(form.weightKg) : undefined,
            bloodPressureSystolic: form.bloodPressureSystolic ? Number(form.bloodPressureSystolic) : undefined,
            bloodPressureDiastolic: form.bloodPressureDiastolic ? Number(form.bloodPressureDiastolic) : undefined,
            heartRateBpm: form.heartRateBpm ? Number(form.heartRateBpm) : undefined,
            temperatureC: form.temperatureC ? Number(form.temperatureC) : undefined,
            oxygenSaturation: form.oxygenSaturation ? Number(form.oxygenSaturation) : undefined,
          });
          showToast('Vital signs saved', 'success'); break;
        case 'vaccination':
          await patientApi.addVaccination(form);
          showToast('Vaccination recorded', 'success'); break;
        case 'condition':
          await patientApi.addChronicCondition({
            ...form,
            medications: form.medications ? form.medications.split(',').map((m: string) => m.trim()).filter(Boolean) : [],
          });
          showToast('Condition recorded', 'success'); break;
        case 'family':
          await patientApi.addFamilyHistory(form);
          showToast('Family history recorded', 'success'); break;
        case 'insurance':
          await patientApi.updateInsurance(form);
          showToast('Insurance updated', 'success'); break;
      }
      close();
      loadAll();
    } catch (err: any) {
      showToast(err.message || 'Failed to save', 'error');
    }
  };

  const remove = async (kind: string, id: string) => {
    if (!confirm('Remove this entry?')) return;
    try {
      switch (kind) {
        case 'allergy': await patientApi.deleteAllergy(id); break;
        case 'vital': await patientApi.deleteVitalSign(id); break;
        case 'vaccination': await patientApi.deleteVaccination(id); break;
        case 'condition': await patientApi.deleteChronicCondition(id); break;
        case 'family': await patientApi.deleteFamilyHistory(id); break;
      }
      loadAll();
    } catch (err: any) {
      showToast(err.message || 'Delete failed', 'error');
    }
  };

  if (user?.role !== 'patient') {
    return (
      <div className="empty-state">
        <div className="empty-icon"><Activity size={48} /></div>
        <h3>Patients only</h3>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <h1 className="page-title">My Health Profile</h1>
      <p className="page-subtitle">A complete view of your medical record — vitals, allergies, vaccinations, conditions, insurance.</p>

      {/* ── Health Score Banner ── */}
      {score && (
        <div className="med-card" style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '20px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div style={{
            width: '90px', height: '90px', borderRadius: '50%',
            background: score.score >= 85 ? 'var(--success-light)' : score.score >= 70 ? 'var(--primary-light)' : score.score >= 50 ? 'var(--warning-light)' : 'var(--error-light)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: score.score >= 85 ? 'var(--success)' : score.score >= 70 ? 'var(--primary)' : score.score >= 50 ? 'var(--warning)' : 'var(--error)',
            fontSize: '2rem', fontWeight: 800,
          }}>
            {score.score}
          </div>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Health Score</div>
            <h2 style={{ fontSize: '1.4rem', textTransform: 'capitalize', margin: '4px 0' }}>{score.tier}</h2>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              {score.activeChronicConditions} active condition{score.activeChronicConditions !== 1 ? 's' : ''} ·{' '}
              {score.severeAllergies} severe allerg{score.severeAllergies !== 1 ? 'ies' : 'y'}
            </div>
          </div>
          {summary?.activePrescriptions?.length > 0 && (
            <div style={{ padding: '10px 16px', background: 'var(--bg-main)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
              <div style={{ color: 'var(--text-secondary)' }}>Active prescriptions</div>
              <div style={{ fontWeight: 700 }}>{summary.activePrescriptions.length}</div>
            </div>
          )}
        </div>
      )}

      <Tabs
        tabs={['Allergies', 'Vital Signs', 'Vaccinations', 'Chronic Conditions', 'Family History', 'Insurance']}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <div className="tab-content">
        {/* ─── Allergies ──────────────────────────────────── */}
        {activeTab === 0 && (
          <Card title="Allergies" icon={<AlertTriangle size={20} />}>
            <Button icon={<Plus size={16} />} onClick={() => open('allergy')}>Add allergy</Button>
            {allergies.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', marginTop: '16px' }}>No allergies recorded.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                {allergies.map((a) => (
                  <div key={a._id} className="history-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{a.substance}</strong>
                      <Badge text={a.severity} variant={['severe', 'life-threatening'].includes(a.severity) ? 'high' : 'medium'} />
                      {a.reaction && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{a.reaction}</div>}
                    </div>
                    <button className="med-button danger sm" onClick={() => remove('allergy', a._id)}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ─── Vital Signs ────────────────────────────────── */}
        {activeTab === 1 && (
          <Card title="Vital Signs" icon={<HeartPulse size={20} />}>
            <Button icon={<Plus size={16} />} onClick={() => open('vital')}>Record vitals</Button>
            {vitalSigns.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', marginTop: '16px' }}>No vital signs recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                {vitalSigns.map((v) => (
                  <div key={v._id} className="history-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong>{new Date(v.recordedAt || v.createdAt).toLocaleString()}</strong>
                      <button className="med-button danger sm" onClick={() => remove('vital', v._id)}><Trash2 size={14} /></button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {v.bloodPressureSystolic && <div><strong>BP:</strong> {v.bloodPressureSystolic}/{v.bloodPressureDiastolic}</div>}
                      {v.heartRateBpm && <div><strong>HR:</strong> {v.heartRateBpm} bpm</div>}
                      {v.temperatureC && <div><strong>Temp:</strong> {v.temperatureC}°C</div>}
                      {v.oxygenSaturation && <div><strong>SpO₂:</strong> {v.oxygenSaturation}%</div>}
                      {v.bmi && <div><strong>BMI:</strong> {v.bmi}</div>}
                      {v.heightCm && v.weightKg && <div><strong>H/W:</strong> {v.heightCm}cm / {v.weightKg}kg</div>}
                    </div>
                    {v.notes && <div style={{ marginTop: '6px', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{v.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ─── Vaccinations ──────────────────────────────── */}
        {activeTab === 2 && (
          <Card title="Vaccinations" icon={<Syringe size={20} />}>
            <Button icon={<Plus size={16} />} onClick={() => open('vaccination')}>Record vaccination</Button>
            {vaccinations.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', marginTop: '16px' }}>No vaccinations recorded.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                {vaccinations.map((v) => (
                  <div key={v._id} className="history-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{v.name}</strong> {v.dose && <span style={{ color: 'var(--text-secondary)' }}>· {v.dose}</span>}
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {new Date(v.administeredAt).toLocaleDateString()}
                        {v.administeredBy ? ` · ${v.administeredBy}` : ''}
                        {v.nextDueDate ? ` · next due ${new Date(v.nextDueDate).toLocaleDateString()}` : ''}
                      </div>
                    </div>
                    <button className="med-button danger sm" onClick={() => remove('vaccination', v._id)}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ─── Chronic Conditions ────────────────────────── */}
        {activeTab === 3 && (
          <Card title="Chronic Conditions" icon={<Activity size={20} />}>
            <Button icon={<Plus size={16} />} onClick={() => open('condition')}>Add condition</Button>
            {conditions.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', marginTop: '16px' }}>No chronic conditions recorded.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                {conditions.map((c) => (
                  <div key={c._id} className="history-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <div>
                        <strong>{c.name}</strong>
                        <Badge text={c.status} variant={c.status === 'active' ? 'high' : c.status === 'managed' ? 'medium' : 'low'} />
                      </div>
                      <button className="med-button danger sm" onClick={() => remove('condition', c._id)}><Trash2 size={14} /></button>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Severity: {c.severity}
                      {c.diagnosedDate ? ` · diagnosed ${new Date(c.diagnosedDate).toLocaleDateString()}` : ''}
                    </div>
                    {c.medications?.length > 0 && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Medications: {c.medications.join(', ')}
                      </div>
                    )}
                    {c.notes && <div style={{ marginTop: '4px', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{c.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ─── Family History ────────────────────────────── */}
        {activeTab === 4 && (
          <Card title="Family Medical History" icon={<UsersIcon size={20} />}>
            <Button icon={<Plus size={16} />} onClick={() => open('family')}>Add family history</Button>
            {familyHistory.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', marginTop: '16px' }}>No family history recorded.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                {familyHistory.map((f) => (
                  <div key={f._id} className="history-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ textTransform: 'capitalize' }}>{f.relation}</strong>: {f.condition}
                      {f.ageOfOnset && <span style={{ color: 'var(--text-secondary)' }}> · onset age {f.ageOfOnset}</span>}
                      {f.notes && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{f.notes}</div>}
                    </div>
                    <button className="med-button danger sm" onClick={() => remove('family', f._id)}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ─── Insurance ─────────────────────────────────── */}
        {activeTab === 5 && (
          <Card title="Insurance" icon={<ShieldCheck size={20} />}>
            <Button icon={<Award size={16} />} onClick={() => open('insurance', insurance)}>
              {insurance?.provider ? 'Update insurance' : 'Add insurance details'}
            </Button>
            {insurance?.provider ? (
              <div className="history-item" style={{ marginTop: '16px' }}>
                <div><strong>Provider:</strong> {insurance.provider}</div>
                {insurance.policyNumber && <div><strong>Policy:</strong> {insurance.policyNumber}</div>}
                {insurance.groupNumber && <div><strong>Group:</strong> {insurance.groupNumber}</div>}
                {insurance.coverage && <div><strong>Coverage:</strong> {insurance.coverage}</div>}
                {insurance.validUntil && <div><strong>Valid until:</strong> {new Date(insurance.validUntil).toLocaleDateString()}</div>}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', marginTop: '16px' }}>No insurance recorded.</p>
            )}
          </Card>
        )}
      </div>

      {/* ─── Modals ────────────────────────────────────────────── */}
      <Modal isOpen={modal === 'allergy'} onClose={close} title="New allergy">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Input label="Substance" value={form.substance || ''} onChange={(e) => setForm({ ...form, substance: e.target.value })} required />
          <div className="med-input-group">
            <label className="med-label">Severity</label>
            <select className="med-input" value={form.severity || 'mild'} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              {SEVERITY.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Input label="Reaction" value={form.reaction || ''} onChange={(e) => setForm({ ...form, reaction: e.target.value })} placeholder="e.g. hives, swelling" />
          <Button onClick={submit}>Save</Button>
        </div>
      </Modal>

      <Modal isOpen={modal === 'vital'} onClose={close} title="Record vital signs">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Input label="Height (cm)" type="number" value={form.heightCm || ''} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} />
          <Input label="Weight (kg)" type="number" value={form.weightKg || ''} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
          <Input label="BP Systolic" type="number" value={form.bloodPressureSystolic || ''} onChange={(e) => setForm({ ...form, bloodPressureSystolic: e.target.value })} />
          <Input label="BP Diastolic" type="number" value={form.bloodPressureDiastolic || ''} onChange={(e) => setForm({ ...form, bloodPressureDiastolic: e.target.value })} />
          <Input label="Heart rate (bpm)" type="number" value={form.heartRateBpm || ''} onChange={(e) => setForm({ ...form, heartRateBpm: e.target.value })} />
          <Input label="Temperature (°C)" type="number" value={form.temperatureC || ''} onChange={(e) => setForm({ ...form, temperatureC: e.target.value })} />
          <Input label="SpO₂ (%)" type="number" value={form.oxygenSaturation || ''} onChange={(e) => setForm({ ...form, oxygenSaturation: e.target.value })} />
          <Input label="Notes" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div style={{ gridColumn: '1 / -1' }}><Button onClick={submit}>Save</Button></div>
        </div>
      </Modal>

      <Modal isOpen={modal === 'vaccination'} onClose={close} title="Record vaccination">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Input label="Vaccine name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label="Dose" value={form.dose || ''} onChange={(e) => setForm({ ...form, dose: e.target.value })} placeholder="e.g. 2nd dose" />
          <Input label="Administered by" value={form.administeredBy || ''} onChange={(e) => setForm({ ...form, administeredBy: e.target.value })} />
          <Input label="Batch #" value={form.batchNumber || ''} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
          <Input label="Next due date" type="date" value={form.nextDueDate || ''} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} />
          <Button onClick={submit}>Save</Button>
        </div>
      </Modal>

      <Modal isOpen={modal === 'condition'} onClose={close} title="New chronic condition">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Input label="Condition name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <div className="med-input-group">
            <label className="med-label">Severity</label>
            <select className="med-input" value={form.severity || 'moderate'} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
              {['mild', 'moderate', 'severe'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="med-input-group">
            <label className="med-label">Status</label>
            <select className="med-input" value={form.status || 'active'} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Input label="Diagnosed date" type="date" value={form.diagnosedDate || ''} onChange={(e) => setForm({ ...form, diagnosedDate: e.target.value })} />
          <Input label="Medications (comma-separated)" value={form.medications || ''} onChange={(e) => setForm({ ...form, medications: e.target.value })} />
          <div className="med-input-group">
            <label className="med-label">Notes</label>
            <textarea className="med-input" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <Button onClick={submit}>Save</Button>
        </div>
      </Modal>

      <Modal isOpen={modal === 'family'} onClose={close} title="New family history entry">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="med-input-group">
            <label className="med-label">Relation</label>
            <select className="med-input" value={form.relation || ''} onChange={(e) => setForm({ ...form, relation: e.target.value })}>
              <option value="">Select…</option>
              {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <Input label="Condition" value={form.condition || ''} onChange={(e) => setForm({ ...form, condition: e.target.value })} required />
          <Input label="Age of onset" type="number" value={form.ageOfOnset || ''} onChange={(e) => setForm({ ...form, ageOfOnset: e.target.value })} />
          <Input label="Notes" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <Button onClick={submit}>Save</Button>
        </div>
      </Modal>

      <Modal isOpen={modal === 'insurance'} onClose={close} title="Insurance details">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Input label="Provider" value={form.provider || ''} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
          <Input label="Policy number" value={form.policyNumber || ''} onChange={(e) => setForm({ ...form, policyNumber: e.target.value })} />
          <Input label="Group number" value={form.groupNumber || ''} onChange={(e) => setForm({ ...form, groupNumber: e.target.value })} />
          <div className="med-input-group">
            <label className="med-label">Coverage tier</label>
            <select className="med-input" value={form.coverage || 'standard'} onChange={(e) => setForm({ ...form, coverage: e.target.value })}>
              {['basic', 'standard', 'premium', 'enterprise'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Input label="Valid until" type="date" value={form.validUntil ? form.validUntil.split('T')[0] : ''} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
          <Button onClick={submit}>Save</Button>
        </div>
      </Modal>
    </div>
  );
}
