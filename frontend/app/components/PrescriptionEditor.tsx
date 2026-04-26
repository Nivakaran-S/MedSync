'use client';

import React, { useState, useRef, useEffect } from 'react';
import { doctorApi } from '../services/api';
import { AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { MedButton as Button, MedInput as Input, showToast } from './UI';
import SignatureCanvas from 'react-signature-canvas';

interface PrescriptionItem {
  id: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  warning?: string;
}

interface PrescriptionEditorProps {
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientAllergies?: any[]; 
  doctorName?: string;
  onSuccess?: (result: any) => void;
  onCancel?: () => void;
}

export default function PrescriptionEditor({
  appointmentId,
  patientId,
  patientName,
  patientAllergies,
  doctorName,
  onSuccess,
  onCancel
}: PrescriptionEditorProps) {
  const [medications, setMedications] = useState<PrescriptionItem[]>([
    { id: '1', medication: '', dosage: '', frequency: '', duration: '' }
  ]);
  const [instructions, setInstructions] = useState('');
  const [isIssuing, setIsIssuing] = useState(false);
  const [issuedResult, setIssuedResult] = useState<any>(null);
  const sigCanvas = useRef<any>(null);

  // A7: structured warnings returned by the backend allergy precheck.
  // When set, an override modal is shown.
  const [allergyConflict, setAllergyConflict] = useState<{
    warnings: Array<{
      allergen: string;
      severity: string;
      matchedDrug: string;
      patientReportedSubstance: string;
      message: string;
      medicationName?: string;
    }>;
    pendingPayload: any;
  } | null>(null);

  const addMedication = () => {
    setMedications([...medications, { id: Date.now().toString(), medication: '', dosage: '', frequency: '', duration: '' }]);
  };

  const updateMedication = (id: string, field: keyof PrescriptionItem, value: string) => {
    try {
      const newMeds = medications.map(m => {
        if (m.id === id) {
          const updated = { ...m, [field]: value };
          // Allergy Check - Hardened
          if (field === 'medication' && value && Array.isArray(patientAllergies)) {
             const match = patientAllergies.find((a: any) => {
               if (!a) return false;
               const substance = typeof a === 'string' ? a : (a.substance || a.name || '');
               return substance && typeof substance === 'string' && value.toLowerCase().includes(substance.toLowerCase());
             });
             
             if (match) {
               const substanceName = typeof match === 'string' ? match : (match.substance || match.name);
               updated.warning = `Safety Alert: Patient is allergic to ${substanceName}`;
             } else {
               updated.warning = undefined;
             }
          }
          return updated;
        }
        return m;
      });
      setMedications(newMeds);
    } catch (e) {
      console.error('Prescription logic error:', e);
    }
  };

  const removeMedication = (id: string) => {
    if (medications.length > 1) {
      setMedications(medications.filter(m => m.id !== id));
    }
  };

  const formatAllergies = () => {
    try {
      if (!patientAllergies || (Array.isArray(patientAllergies) && patientAllergies.length === 0)) return 'None Known';
      const list = Array.isArray(patientAllergies) ? patientAllergies : [patientAllergies];
      
      return list.map(a => {
        if (!a) return null;
        if (typeof a === 'string') return a;
        return a.substance || a.name || a.label || 'Unknown';
      }).filter(Boolean).join(', ');
    } catch (e) {
      return 'Check Records';
    }
  };

  const handleIssue = async () => {
    try {
      if (!medications || medications.some(m => !m.medication || !m.dosage)) {
        showToast('Please fill all medication fields', 'warning');
        return;
      }
      
      const canvasRef = sigCanvas?.current;
      
      // Verification logic remains robust
      if (!canvasRef || typeof canvasRef.isEmpty !== 'function') {
        showToast('Signature pad is not ready. Please wait...', 'error');
        return;
      }

      if (canvasRef.isEmpty()) {
        showToast('Physician signature is required', 'warning');
        return;
      }

      setIsIssuing(true);
      
      // CRITICAL FIX: Bypass getTrimmedCanvas() as it crashes internally in React 19 builds
      // Using the raw getCanvas() which is guaranteed to be stable.
      const canvas = typeof canvasRef.getCanvas === 'function' ? canvasRef.getCanvas() : canvasRef.getTrimmedCanvas();

      if (!canvas || typeof canvas.toDataURL !== 'function') {
        showToast('Failed to capture signature', 'error');
        setIsIssuing(false);
        return;
      }
      
      const signatureBase64 = canvas.toDataURL('image/png');
      
      const payload = {
        patientId,
        patientName,
        doctorName: doctorName || 'Attending Physician',
        appointmentId,
        medications: (medications || []).map(m => ({ 
          medication: m.medication || 'N/A', 
          dosage: m.dosage || 'N/A', 
          frequency: m.frequency || 'N/A', 
          duration: m.duration || 'N/A' 
        })),
        instructions: instructions || 'No additional instructions.',
        signatureBase64
      };

      await submitPrescription(payload, false);
    } catch (err: any) {
      console.error('Prescription issuance failed:', err);
      showToast(err.message || 'Error connecting to issuance service.', 'error');
    } finally {
      setIsIssuing(false);
    }
  };

  // Shared submitter — used both for the initial attempt and the
  // override-confirm path. Encapsulates the 409 → modal flow.
  const submitPrescription = async (payload: any, withOverride: boolean) => {
    try {
      const finalPayload = withOverride ? { ...payload, acknowledgedAllergyOverride: true } : payload;
      const result = await doctorApi.issuePrescription(finalPayload);
      setIssuedResult(result);
      setAllergyConflict(null);
      showToast(
        withOverride
          ? 'Prescription issued (allergy override acknowledged).'
          : 'Prescription issued successfully!',
        'success'
      );
      if (typeof onSuccess === 'function') onSuccess(result);
    } catch (err: any) {
      if (err?.code === 'ALLERGY_CONFLICT' && Array.isArray(err.warnings)) {
        // Hold the modal open with the structured warnings.
        setAllergyConflict({ warnings: err.warnings, pendingPayload: payload });
        return;
      }
      throw err;
    }
  };

  if (issuedResult) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div style={{ 
          width: '80px', height: '80px', background: 'var(--success-light)', color: 'var(--success)', 
          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
          margin: '0 auto 24px' 
        }}>
          <CheckCircle size={40} />
        </div>
        <h3 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '8px' }}>Prescription Finalized</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>The patient has been notified and the record is secured.</p>
        
        <div style={{ 
          background: 'white', padding: '24px', borderRadius: '16px', display: 'inline-block', 
          border: '1px solid var(--card-border)', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' 
        }}>
          {issuedResult.qrCode && <img src={issuedResult.qrCode} alt="Security Signature" style={{ width: '180px', height: '180px' }} />}
        </div>
        <div style={{ marginTop: '32px' }}>
             <Button className="primary" onClick={onCancel}>Close and Return</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Patient Header */}
      <div style={{ 
        background: 'var(--bg-main)', padding: '16px', borderRadius: '12px', 
        border: '1px solid var(--card-border)', display: 'flex', 
        justifyContent: 'space-between', alignItems: 'center' 
      }}>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Patient Name</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{patientName}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--error)', textTransform: 'uppercase' }}>Allergy Alert</div>
          <div style={{ 
            fontSize: '0.9rem', fontWeight: 700, 
            color: (patientAllergies && patientAllergies.length > 0) ? 'var(--error)' : 'var(--text-muted)' 
          }}>
            {formatAllergies()}
          </div>
        </div>
      </div>

      {/* Regimen Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 800 }}>Treatment Regimen</h4>
          <Button className="primary sm" onClick={addMedication}>+ Add Another Medication</Button>
        </div>

        <div style={{ 
          display: 'flex', flexDirection: 'column', gap: '16px', 
          maxHeight: '350px', overflowY: 'auto', padding: '4px' 
        }} className="custom-scrollbar">
          {medications.map((med) => (
            <div 
              key={med.id} 
              className="med-card" 
              style={{ 
                padding: '16px', 
                border: med.warning ? '2px solid var(--error)' : '1px solid var(--card-border)', 
                background: med.warning ? 'rgba(239, 68, 68, 0.05)' : 'white',
              }}
            >
              {med.warning && (
                <div style={{ 
                  marginBottom: '12px', padding: '12px', background: 'var(--error)', 
                  color: 'white', borderRadius: '8px', fontSize: '0.8rem', 
                  fontWeight: 700, display: 'flex', alignItems: 'center', 
                  gap: '8px', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)' 
                }}>
                  <AlertCircle size={18} /> {med.warning}
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr 1fr 0.8fr 40px', gap: '12px' }}>
                <Input label="Medication" value={med.medication} onChange={(e) => updateMedication(med.id, 'medication', e.target.value)} placeholder="e.g. Amoxicillin" />
                <Input label="Dosage" value={med.dosage} onChange={(e) => updateMedication(med.id, 'dosage', e.target.value)} placeholder="e.g. 500mg" />
                <Input label="Freq" value={med.frequency} onChange={(e) => updateMedication(med.id, 'frequency', e.target.value)} placeholder="e.g. 3x Daily" />
                <Input label="Duration" value={med.duration} onChange={(e) => updateMedication(med.id, 'duration', e.target.value)} placeholder="e.g. 10 Days" />
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '8px' }}>
                  <button 
                    onClick={() => removeMedication(med.id)} 
                    style={{ 
                      color: 'var(--error)', background: 'transparent', 
                      border: 'none', cursor: 'pointer', padding: '8px' 
                    }}
                  >
                    <Trash2 size={20}/>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div>
        <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Clinical Instructions</div>
        <textarea 
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Special advice or precautions..."
          style={{ 
            width: '100%', height: '80px', padding: '12px', 
            borderRadius: '12px', border: '1px solid var(--card-border)', 
            background: 'var(--bg-main)', fontSize: '0.9rem', resize: 'none' 
          }}
        />
      </div>

      {/* Signature & Submit */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.50fr 1fr', gap: '20px', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Professional Authentication</div>
          <div style={{ border: '2px dashed var(--card-border)', borderRadius: '12px', background: 'white' }}>
            <SignatureCanvas 
               ref={sigCanvas} 
               penColor="#1e293b" 
               canvasProps={{ width: 450, height: 120, className: 'sigCanvas' }} 
            />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Button className="secondary sm" onClick={() => sigCanvas.current?.clear()}>Clear signature</Button>
          <Button className="primary" onClick={handleIssue} disabled={isIssuing} style={{ height: '56px', fontSize: '1rem', fontWeight: 700 }}>
             {isIssuing ? 'Issuing...' : 'Sign & Complete'}
          </Button>
        </div>
      </div>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>

      {/* A7: Allergy override modal */}
      {allergyConflict && (
        <AllergyOverrideModal
          warnings={allergyConflict.warnings}
          onCancel={() => setAllergyConflict(null)}
          onConfirm={async () => {
            setIsIssuing(true);
            try {
              await submitPrescription(allergyConflict.pendingPayload, true);
            } catch (err: any) {
              showToast(err?.message || 'Override failed', 'error');
            } finally {
              setIsIssuing(false);
            }
          }}
          submitting={isIssuing}
        />
      )}
    </div>
  );
}

// A7: Allergy override modal — surfaced when the backend returns a 409
// ALLERGY_CONFLICT. Doctor must explicitly confirm to proceed; the
// confirmation is then stored on the prescription as an audit note.
function AllergyOverrideModal({
  warnings, onCancel, onConfirm, submitting,
}: {
  warnings: Array<{
    allergen: string;
    severity: string;
    matchedDrug: string;
    patientReportedSubstance: string;
    message: string;
    medicationName?: string;
  }>;
  onCancel: () => void;
  onConfirm: () => void;
  submitting: boolean;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  const hasLifeThreatening = warnings.some(
    (w) => w.severity === 'life-threatening' || w.severity === 'severe'
  );
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(15, 23, 42, 0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, zIndex: 1000,
    }}>
      <div style={{
        background: 'white', borderRadius: 16, maxWidth: 560, width: '100%',
        padding: 24, boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, color: 'var(--error)' }}>
          <AlertCircle size={22} />
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
            Allergy conflict detected
          </h3>
        </div>
        <p style={{ marginTop: 0, color: 'var(--text-secondary)' }}>
          The patient has a recorded allergy that conflicts with one or more medications you are about to prescribe.
        </p>
        <ul style={{ marginTop: 12, paddingLeft: 18 }}>
          {warnings.map((w, i) => (
            <li key={i} style={{ fontSize: '0.9rem', marginBottom: 8, color: 'var(--text-primary)' }}>
              <strong>{w.medicationName || w.matchedDrug}</strong>: {w.message}
            </li>
          ))}
        </ul>
        {hasLifeThreatening && (
          <div style={{
            marginTop: 12, padding: 12,
            background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #fecaca',
            borderRadius: 8, color: 'var(--error)', fontWeight: 700,
          }}>
            ⚠️ Patient reports a SEVERE / LIFE-THREATENING allergy. Re-confirm only if clinically justified.
          </div>
        )}
        <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 16, fontSize: '0.9rem' }}>
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            style={{ marginTop: 4 }}
          />
          <span>
            I have discussed this allergy risk with the patient and want to proceed.
            A note will be added to the prescription record.
          </span>
        </label>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
          <Button className="secondary" onClick={onCancel}>Cancel</Button>
          <Button className="primary" onClick={onConfirm} disabled={!acknowledged || submitting}>
            {submitting ? 'Issuing…' : 'Proceed despite allergy'}
          </Button>
        </div>
      </div>
    </div>
  );
}
