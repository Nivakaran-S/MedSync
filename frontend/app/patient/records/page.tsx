'use client';

import React, { useState, useEffect, useRef } from 'react';
import { patientApi, PATIENT_API_BASE } from '../../services/api';

// Derive the patient-service origin from the API base so uploaded documents
// resolve relative to the service, not the frontend host.
const PATIENT_SERVICE_ORIGIN = (() => {
  try {
    return new URL(PATIENT_API_BASE).origin;
  } catch {
    return 'http://localhost:3001';
  }
})();
import { Card, Button, MedButton, Tabs, Badge, showToast, Modal } from '../../components/UI';
import SourceBadge from '../../components/SourceBadge';

export default function RecordsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [records, setRecords] = useState<any>({ medicalHistory: [], prescriptions: [] });
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('Report');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showAddRecord, setShowAddRecord] = useState(false);
  const [showAddPrescription, setShowAddPrescription] = useState(false);
  const [recordCategory, setRecordCategory] = useState<'medical' | 'surgical' | 'family'>('medical');
  const [newRecord, setNewRecord] = useState({
    description: '', diagnosis: '', doctor: '', notes: '', date: '',
    // surgical
    procedure: '', surgeon: '', hospital: '', outcome: '', complications: '',
    // family
    relation: '', condition: '', ageOfOnset: '', deceased: false,
  });
  const [newPrescription, setNewPrescription] = useState({ medication: '', dosage: '', frequency: '', duration: '', instructions: '', prescribedBy: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    try {
      const recs = await patientApi.getRecords();
      setRecords(recs);
      const docs = await patientApi.getDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // File upload handler
  const handleUpload = async (file?: File) => {
    const uploadFile = file || selectedFile;
    if (!uploadFile) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('type', docType);

    try {
      await patientApi.uploadDocument(formData);
      fetchData();
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      showToast('Document uploaded successfully!', 'success');
    } catch (error) {
      showToast('Error uploading document.', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Delete document
  const handleDeleteDoc = async (docId: string) => {
    if (!confirm('Delete this document?')) return;
    try {
      await patientApi.deleteDocument(docId);
      fetchData();
      showToast('Document deleted.', 'info');
    } catch (error) {
      showToast('Error deleting document.', 'error');
    }
  };

  const resetRecordForm = () => {
    setNewRecord({
      description: '', diagnosis: '', doctor: '', notes: '', date: '',
      procedure: '', surgeon: '', hospital: '', outcome: '', complications: '',
      relation: '', condition: '', ageOfOnset: '', deceased: false,
    });
    setRecordCategory('medical');
  };

  const handleAddRecord = async () => {
    try {
      if (recordCategory === 'family') {
        if (!newRecord.relation || !newRecord.condition) {
          return showToast('Relation and condition are required.', 'warning');
        }
        await patientApi.addFamilyHistory({
          relation: newRecord.relation,
          condition: newRecord.condition,
          ageOfOnset: newRecord.ageOfOnset ? Number(newRecord.ageOfOnset) : undefined,
          notes: [newRecord.deceased ? 'Deceased' : '', newRecord.notes].filter(Boolean).join('. '),
        });
        showToast('Family history recorded!', 'success');
      } else {
        const desc = recordCategory === 'surgical'
          ? `[Surgical] ${newRecord.procedure || newRecord.description}`
          : newRecord.description;
        if (!desc) return showToast('Description is required.', 'warning');

        await patientApi.addMedicalRecord({
          description: desc,
          diagnosis: recordCategory === 'surgical' ? newRecord.outcome : newRecord.diagnosis,
          doctor: recordCategory === 'surgical' ? newRecord.surgeon : newRecord.doctor,
          notes: [
            recordCategory === 'surgical' && newRecord.hospital ? `Hospital: ${newRecord.hospital}` : '',
            recordCategory === 'surgical' && newRecord.complications ? `Complications: ${newRecord.complications}` : '',
            newRecord.notes,
          ].filter(Boolean).join('\n'),
          date: newRecord.date || undefined,
        });
        showToast(recordCategory === 'surgical' ? 'Surgical history recorded!' : 'Medical record added!', 'success');
      }

      resetRecordForm();
      setShowAddRecord(false);
      fetchData();
    } catch (error) {
      showToast('Error saving record.', 'error');
    }
  };

  // Add prescription
  const handleAddPrescription = async () => {
    if (!newPrescription.medication || !newPrescription.dosage) return showToast('Medication and dosage are required.', 'warning');
    try {
      await patientApi.addPrescription(newPrescription);
      setNewPrescription({ medication: '', dosage: '', frequency: '', duration: '', instructions: '', prescribedBy: '' });
      setShowAddPrescription(false);
      fetchData();
      showToast('Prescription added!', 'success');
    } catch (error) {
      showToast('Error adding prescription.', 'error');
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
    }
  };

  const getDocTypeIcon = (type: string) => {
    switch (type) {
      case 'Report': return '📄';
      case 'Scan': return '🩻';
      case 'Prescription': return '💊';
      case 'Lab Result': return '🔬';
      default: return '📎';
    }
  };


  return (
    <div className="animate-in">
      <h1 className="page-title">Medical Records & Documents</h1>
      <p className="page-subtitle">View your treatment history, prescriptions, and manage uploaded documents</p>

      <Tabs
        tabs={['📋 Medical History', '💊 Prescriptions', '📁 Documents']}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <div className="tab-content">
        {/* ── Medical History Tab ── */}
        {activeTab === 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Treatment History</h2>
              <Button onClick={() => setShowAddRecord(true)} icon="+" variant="secondary" size="sm">
                Add Record
              </Button>
            </div>

            {records.medicalHistory.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No Medical History</h3>
                <p>Your treatment records will appear here once added by you or your doctor.</p>
              </div>
            ) : (
              records.medicalHistory.map((item: any, idx: number) => (
                <div key={idx} className="history-item" style={{ animationDelay: `${idx * 0.1}s` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ fontSize: '1rem' }}>{item.description}</strong>
                      <SourceBadge source={item.source} by={item.createdByName} />
                      {item.diagnosis && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>Diagnosis: {item.diagnosis}</p>}
                      {item.doctor && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Doctor: {item.doctor}</p>}
                      {item.notes && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>{item.notes}</p>}
                    </div>
                    <Badge text={new Date(item.date).toLocaleDateString()} variant="info" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Prescriptions Tab ── */}
        {activeTab === 1 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Prescriptions</h2>
            </div>

            {records.prescriptions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💊</div>
                <h3>No Prescriptions</h3>
                <p>Your prescriptions from doctors will appear here.</p>
              </div>
            ) : (
              records.prescriptions.map((item: any, idx: number) => (
                <div key={idx} className="history-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <strong style={{ fontSize: '1rem' }}>{item.medication || (item.medications && item.medications[0]?.medication)}</strong>
                      <SourceBadge source={item.source} by={item.createdByName || item.doctorName} />
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Dosage: {item.dosage || (item.medications && item.medications[0]?.dosage)}</p>
                      {item.frequency && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Frequency: {item.frequency}</p>}
                      {item.duration && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Duration: {item.duration}</p>}
                      {item.instructions && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>{item.instructions}</p>}
                      {item.prescribedBy && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>By: {item.prescribedBy}</p>}
                      
                      <a 
                        href={`/verify/${item.verificationId || 'missing'}`} 
                        target="_blank"
                        className={`med-link ${!item.verificationId ? 'disabled' : ''}`}
                        style={{ 
                          fontSize: '0.75rem', 
                          color: item.verificationId ? '#3b82f6' : '#94a3b8', 
                          fontWeight: 700, 
                          textDecoration: 'none',
                          marginTop: '10px',
                          display: 'inline-block',
                          pointerEvents: item.verificationId ? 'auto' : 'none'
                        }}
                      >
                        {item.verificationId ? 'VIEW DIGITAL COPY & QR →' : 'PAPER-ONLY RECORD'}
                      </a>
                    </div>
                    <Badge text={new Date(item.date).toLocaleDateString()} variant="info" />
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Documents Tab ── */}
        {activeTab === 2 && (
          <div>
            <Card title="Upload Medical Documents" icon="📤">
              {/* Document Type */}
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
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Drag & Drop Zone */}
              <div
                className={`upload-zone ${dragOver ? 'dragover' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="upload-icon">📎</div>
                {selectedFile ? (
                  <p><strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)</p>
                ) : (
                  <>
                    <p><strong>Click to browse</strong> or drag & drop your file here</p>
                    <p className="upload-hint">Supports PDF, JPG, PNG (max 5MB)</p>
                  </>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                style={{ display: 'none' }}
              />

              <div style={{ marginTop: '16px' }}>
                <Button
                  onClick={() => handleUpload()}
                  disabled={uploading || !selectedFile}
                  icon={uploading ? '⏳' : '📤'}
                >
                  {uploading ? 'Uploading...' : 'Upload Document'}
                </Button>
              </div>
            </Card>

            <Card title="Your Documents" icon="📁">
              {documents.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📁</div>
                  <h3>No Documents</h3>
                  <p>Upload your medical reports, scans, and prescriptions above.</p>
                </div>
              ) : (
                documents.map((doc: any, idx: number) => (
                  <div key={idx} className="doc-item">
                    <div className="doc-item-info">
                      <div className="doc-type-icon">{getDocTypeIcon(doc.type)}</div>
                      <div>
                        <strong style={{ fontSize: '0.95rem' }}>{doc.fileName}</strong>
                        <SourceBadge source={doc.source} by={doc.createdByName} />
                        <br />
                        <small style={{ color: 'var(--text-muted)' }}>
                          {doc.type} • {new Date(doc.uploadDate).toLocaleDateString()}
                        </small>
                      </div>
                    </div>
                    <div className="doc-item-actions">
                      <a
                        href={
                          doc.verificationId 
                            ? `/verify/${doc.verificationId}` 
                            : `${process.env.NEXT_PUBLIC_PATIENT_SERVICE_URL?.replace('/api/patients', '') || 'http://localhost:3001'}/${doc.fileUrl?.replace(/\\/g, '/')}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="med-button secondary sm"
                        style={{ textDecoration: 'none' }}
                      >
                        View
                      </a>
                      <Button variant="danger" size="sm" onClick={() => handleDeleteDoc(doc._id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </Card>
          </div>
        )}
      </div>

      {/* ── Add Medical Record — Full-screen Modal ── */}
      <Modal
        isOpen={showAddRecord}
        onClose={() => { setShowAddRecord(false); resetRecordForm(); }}
        title="Record Health History"
        fullscreen
      >
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          {/* Category selector */}
          <div style={{
            display: 'flex', gap: '8px', marginBottom: '32px',
            background: 'var(--primary-light)', padding: '6px', borderRadius: 'var(--radius-lg)',
          }}>
            {([
              { key: 'medical', label: 'Past Medical', icon: '🩺' },
              { key: 'surgical', label: 'Surgical History', icon: '🔬' },
              { key: 'family', label: 'Family History', icon: '👨‍👩‍👧‍👦' },
            ] as const).map(cat => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setRecordCategory(cat.key)}
                style={{
                  flex: 1, padding: '14px 16px', borderRadius: 'calc(var(--radius-lg) - 2px)',
                  border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: '0.95rem',
                  transition: 'all 0.2s ease',
                  background: recordCategory === cat.key ? 'var(--primary)' : 'transparent',
                  color: recordCategory === cat.key ? 'white' : 'var(--primary)',
                  boxShadow: recordCategory === cat.key ? 'var(--shadow-md)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                <span>{cat.icon}</span> {cat.label}
              </button>
            ))}
          </div>

          {/* ── Past Medical fields ── */}
          {recordCategory === 'medical' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ padding: '16px 20px', background: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '1.05rem' }}>Past Medical History</h4>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  Record a previous illness, chronic condition diagnosis, hospitalisation, or clinical visit.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="med-input-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                  <label className="med-label">Description <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input className="med-input" value={newRecord.description}
                    onChange={(e) => setNewRecord({ ...newRecord, description: e.target.value })}
                    placeholder="e.g., Diagnosed with Type 2 Diabetes" />
                </div>
                <div className="med-input-group" style={{ marginBottom: 0 }}>
                  <label className="med-label">Diagnosis</label>
                  <input className="med-input" value={newRecord.diagnosis}
                    onChange={(e) => setNewRecord({ ...newRecord, diagnosis: e.target.value })}
                    placeholder="e.g., E11 — Type 2 Diabetes Mellitus" />
                </div>
                <div className="med-input-group" style={{ marginBottom: 0 }}>
                  <label className="med-label">Treating Doctor</label>
                  <input className="med-input" value={newRecord.doctor}
                    onChange={(e) => setNewRecord({ ...newRecord, doctor: e.target.value })}
                    placeholder="e.g., Dr. Perera" />
                </div>
                <div className="med-input-group" style={{ marginBottom: 0 }}>
                  <label className="med-label">Date</label>
                  <input type="date" className="med-input" value={newRecord.date}
                    onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })} />
                </div>
                <div className="med-input-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                  <label className="med-label">Clinical Notes</label>
                  <textarea className="med-input" rows={4} value={newRecord.notes}
                    onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
                    placeholder="Treatment plan, follow-up schedule, observations..."
                    style={{ resize: 'vertical' }} />
                </div>
              </div>
            </div>
          )}

          {/* ── Surgical History fields ── */}
          {recordCategory === 'surgical' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ padding: '16px 20px', background: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '1.05rem' }}>Surgical History</h4>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  Record a past surgery, invasive procedure, or operative intervention.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="med-input-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                  <label className="med-label">Procedure Name <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input className="med-input" value={newRecord.procedure}
                    onChange={(e) => setNewRecord({ ...newRecord, procedure: e.target.value })}
                    placeholder="e.g., Laparoscopic Appendectomy" />
                </div>
                <div className="med-input-group" style={{ marginBottom: 0 }}>
                  <label className="med-label">Surgeon</label>
                  <input className="med-input" value={newRecord.surgeon}
                    onChange={(e) => setNewRecord({ ...newRecord, surgeon: e.target.value })}
                    placeholder="e.g., Dr. Fernando" />
                </div>
                <div className="med-input-group" style={{ marginBottom: 0 }}>
                  <label className="med-label">Hospital / Facility</label>
                  <input className="med-input" value={newRecord.hospital}
                    onChange={(e) => setNewRecord({ ...newRecord, hospital: e.target.value })}
                    placeholder="e.g., National Hospital Colombo" />
                </div>
                <div className="med-input-group" style={{ marginBottom: 0 }}>
                  <label className="med-label">Date of Surgery</label>
                  <input type="date" className="med-input" value={newRecord.date}
                    onChange={(e) => setNewRecord({ ...newRecord, date: e.target.value })} />
                </div>
                <div className="med-input-group" style={{ marginBottom: 0 }}>
                  <label className="med-label">Outcome</label>
                  <select className="med-input" value={newRecord.outcome}
                    onChange={(e) => setNewRecord({ ...newRecord, outcome: e.target.value })}>
                    <option value="">Select outcome</option>
                    <option value="Successful">Successful</option>
                    <option value="Successful with complications">Successful with complications</option>
                    <option value="Partially successful">Partially successful</option>
                    <option value="Ongoing recovery">Ongoing recovery</option>
                  </select>
                </div>
                <div className="med-input-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                  <label className="med-label">Complications (if any)</label>
                  <input className="med-input" value={newRecord.complications}
                    onChange={(e) => setNewRecord({ ...newRecord, complications: e.target.value })}
                    placeholder="e.g., Post-op infection managed with antibiotics" />
                </div>
                <div className="med-input-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                  <label className="med-label">Additional Notes</label>
                  <textarea className="med-input" rows={3} value={newRecord.notes}
                    onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
                    placeholder="Recovery timeline, post-operative instructions..."
                    style={{ resize: 'vertical' }} />
                </div>
              </div>
            </div>
          )}

          {/* ── Family History fields ── */}
          {recordCategory === 'family' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ padding: '16px 20px', background: 'white', borderRadius: 'var(--radius-md)', border: '1px solid var(--card-border)' }}>
                <h4 style={{ margin: '0 0 4px', fontSize: '1.05rem' }}>Family Medical History</h4>
                <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  Record hereditary conditions or diseases that run in your family. This helps doctors assess genetic risk factors.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="med-input-group" style={{ marginBottom: 0 }}>
                  <label className="med-label">Family Member <span style={{ color: 'var(--error)' }}>*</span></label>
                  <select className="med-input" value={newRecord.relation}
                    onChange={(e) => setNewRecord({ ...newRecord, relation: e.target.value })}>
                    <option value="">Select relation</option>
                    <option value="mother">Mother</option>
                    <option value="father">Father</option>
                    <option value="sibling">Sibling</option>
                    <option value="grandparent">Grandparent</option>
                    <option value="aunt">Aunt</option>
                    <option value="uncle">Uncle</option>
                    <option value="cousin">Cousin</option>
                    <option value="child">Child</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="med-input-group" style={{ marginBottom: 0 }}>
                  <label className="med-label">Condition <span style={{ color: 'var(--error)' }}>*</span></label>
                  <input className="med-input" value={newRecord.condition}
                    onChange={(e) => setNewRecord({ ...newRecord, condition: e.target.value })}
                    placeholder="e.g., Coronary artery disease" />
                </div>
                <div className="med-input-group" style={{ marginBottom: 0 }}>
                  <label className="med-label">Age of Onset</label>
                  <input type="number" className="med-input" value={newRecord.ageOfOnset}
                    onChange={(e) => setNewRecord({ ...newRecord, ageOfOnset: e.target.value })}
                    placeholder="e.g., 52" min="0" max="120" />
                </div>
                <div className="med-input-group" style={{ marginBottom: 0 }}>
                  <label className="med-label">Status</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input type="checkbox" checked={newRecord.deceased}
                        onChange={(e) => setNewRecord({ ...newRecord, deceased: e.target.checked })} />
                      Deceased from this condition
                    </label>
                  </div>
                </div>
                <div className="med-input-group" style={{ marginBottom: 0, gridColumn: '1 / -1' }}>
                  <label className="med-label">Additional Notes</label>
                  <textarea className="med-input" rows={3} value={newRecord.notes}
                    onChange={(e) => setNewRecord({ ...newRecord, notes: e.target.value })}
                    placeholder="e.g., Father had bypass surgery at age 58, managed with statins..."
                    style={{ resize: 'vertical' }} />
                </div>
              </div>
            </div>
          )}

          <MedButton
            onClick={handleAddRecord}
            style={{ width: '100%', marginTop: '28px', padding: '14px', fontSize: '1.05rem' }}
          >
            {recordCategory === 'medical' && 'Save Medical Record'}
            {recordCategory === 'surgical' && 'Save Surgical Record'}
            {recordCategory === 'family' && 'Save Family History'}
          </MedButton>
        </div>
      </Modal>

      {/* ── Add Prescription Modal ── */}
      <Modal isOpen={showAddPrescription} onClose={() => setShowAddPrescription(false)} title="Add Prescription">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            Add a medication entry to your prescription history for tracking.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="med-input-group" style={{ marginBottom: 0 }}>
              <label className="med-label">Medication <span style={{ color: 'var(--error)' }}>*</span></label>
              <input
                className="med-input"
                value={newPrescription.medication}
                onChange={(e) => setNewPrescription({ ...newPrescription, medication: e.target.value })}
                placeholder="e.g., Paracetamol"
              />
            </div>
            <div className="med-input-group" style={{ marginBottom: 0 }}>
              <label className="med-label">Dosage <span style={{ color: 'var(--error)' }}>*</span></label>
              <input
                className="med-input"
                value={newPrescription.dosage}
                onChange={(e) => setNewPrescription({ ...newPrescription, dosage: e.target.value })}
                placeholder="e.g., 500mg"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="med-input-group" style={{ marginBottom: 0 }}>
              <label className="med-label">Frequency</label>
              <input
                className="med-input"
                value={newPrescription.frequency}
                onChange={(e) => setNewPrescription({ ...newPrescription, frequency: e.target.value })}
                placeholder="e.g., Twice daily"
              />
            </div>
            <div className="med-input-group" style={{ marginBottom: 0 }}>
              <label className="med-label">Duration</label>
              <input
                className="med-input"
                value={newPrescription.duration}
                onChange={(e) => setNewPrescription({ ...newPrescription, duration: e.target.value })}
                placeholder="e.g., 7 days"
              />
            </div>
          </div>

          <div className="med-input-group" style={{ marginBottom: 0 }}>
            <label className="med-label">Instructions</label>
            <textarea
              className="med-input"
              value={newPrescription.instructions}
              onChange={(e) => setNewPrescription({ ...newPrescription, instructions: e.target.value })}
              placeholder="e.g., Take after meals, avoid alcohol..."
              rows={2}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="med-input-group" style={{ marginBottom: 0 }}>
            <label className="med-label">Prescribed By</label>
            <input
              className="med-input"
              value={newPrescription.prescribedBy}
              onChange={(e) => setNewPrescription({ ...newPrescription, prescribedBy: e.target.value })}
              placeholder="e.g., Dr. Silva"
            />
          </div>

          <MedButton
            onClick={handleAddPrescription}
            style={{ width: '100%', marginTop: '4px', padding: '12px' }}
          >
            Save Prescription
          </MedButton>
        </div>
      </Modal>
    </div>
  );
}
