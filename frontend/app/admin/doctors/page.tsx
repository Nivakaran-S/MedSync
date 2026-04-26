'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { doctorApi } from '../../services/api';
import { ShieldBan, CheckCircle, RefreshCcw, UserCheck, Search, UserX, UserCheck2, DollarSign, PencilLine } from 'lucide-react';
import { Modal, showToast } from '../../components/UI';

export default function AdminManageDoctors() {
  const { user, isLoading } = useAuth();
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feeSettingsLoading, setFeeSettingsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feeSettings, setFeeSettings] = useState({ defaultConsultationFee: 0 });
  const [feeInput, setFeeInput] = useState('0');
  const [savingSystemFee, setSavingSystemFee] = useState(false);
  const [feeModalDoctor, setFeeModalDoctor] = useState<any | null>(null);
  const [doctorFeeInput, setDoctorFeeInput] = useState('0');
  const [savingDoctorFee, setSavingDoctorFee] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadDoctors();
      loadFeeSettings();
    }
  }, [user]);

  const loadDoctors = async () => {
    try {
      setLoading(true);
      const data = await doctorApi.listDoctors();
      setDoctors(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadFeeSettings = async () => {
    try {
      setFeeSettingsLoading(true);
      const data = await doctorApi.getConsultationSettings();
      const defaultConsultationFee = Number(data?.defaultConsultationFee || 0);
      setFeeSettings({ defaultConsultationFee });
      setFeeInput(String(defaultConsultationFee));
    } catch (err) {
      showToast('Failed to load default system fee', 'error');
    } finally {
      setFeeSettingsLoading(false);
    }
  };

  const saveSystemFee = async () => {
    const nextFee = Number(feeInput);
    if (!Number.isFinite(nextFee) || nextFee < 0) {
      showToast('System fee must be a non-negative number', 'warning');
      return;
    }

    try {
      setSavingSystemFee(true);
      const data = await doctorApi.updateConsultationSettings({ defaultConsultationFee: nextFee });
      setFeeSettings({ defaultConsultationFee: Number(data?.defaultConsultationFee || 0) });
      showToast('Default system fee updated', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update system fee', 'error');
    } finally {
      setSavingSystemFee(false);
    }
  };

  const handleVerify = async (id: string, isVerified: boolean) => {
    setActionLoading(id + '-verify');
    try {
      await doctorApi.updateDoctor(id, { isVerified });
      loadDoctors();
    } catch {
      alert('Failed to update doctor verification status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspend = async (id: string, makeActive: boolean) => {
    const action = makeActive ? 'reactivate' : 'suspend';
    if (!confirm(`Are you sure you want to ${action} this doctor?${!makeActive ? ' All future appointments will be cancelled.' : ''}`)) return;
    setActionLoading(id + '-suspend');
    try {
      await doctorApi.updateDoctorStatus(id, makeActive);
      loadDoctors();
    } catch {
      alert(`Failed to ${action} doctor`);
    } finally {
      setActionLoading(null);
    }
  };

  const openFeeModal = (doctor: any) => {
    setFeeModalDoctor(doctor);
    setDoctorFeeInput(String(Number(doctor?.consultationFee || 0)));
  };

  const saveDoctorFee = async () => {
    if (!feeModalDoctor) return;

    const nextFee = Number(doctorFeeInput);
    if (!Number.isFinite(nextFee) || nextFee < 0) {
      showToast('Doctor fee must be a non-negative number', 'warning');
      return;
    }

    try {
      setSavingDoctorFee(true);
      await doctorApi.updateDoctor(feeModalDoctor._id, { consultationFee: nextFee });
      showToast('Doctor consultation fee updated', 'success');
      setFeeModalDoctor(null);
      loadDoctors();
    } catch (err: any) {
      showToast(err.message || 'Failed to update doctor fee', 'error');
    } finally {
      setSavingDoctorFee(false);
    }
  };

  if (isLoading) return <div className="animate-in" style={{ padding: '20px' }}>Loading...</div>;

  if (user?.role !== 'admin') {
    return (
      <div className="empty-state">
        <div className="empty-icon"><ShieldBan size={48} /></div>
        <h3>Access Denied</h3>
        <p>You do not have permission to view this page.</p>
      </div>
    );
  }

  const filteredDoctors = doctors.filter(doc =>
    doc.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.specialty?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.contact?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const effectiveSystemFee = feeSettings.defaultConsultationFee || 0;

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">Manage Doctors</h1>
          <p className="page-subtitle">Verify registrations, manage credentials, and control account access.</p>
        </div>
        <button className="med-button secondary" onClick={loadDoctors} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCcw size={16} /> Refresh
        </button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="med-card" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div className="avatar sm" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              <DollarSign size={18} />
            </div>
            <div>
              <h3 className="card-title" style={{ margin: 0 }}>Default System Fee</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Added on top of each doctor fee during booking.</p>
            </div>
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ fontWeight: 800, fontSize: '1.6rem' }}>LKR {effectiveSystemFee.toLocaleString()}</div>
            <input
              className="med-input"
              type="number"
              min={0}
              value={feeInput}
              onChange={(e) => setFeeInput(e.target.value)}
              placeholder="Default system fee"
              disabled={feeSettingsLoading}
              style={{ marginBottom: 0 }}
            />
            <button className="med-button primary" onClick={saveSystemFee} disabled={savingSystemFee || feeSettingsLoading}>
              {savingSystemFee ? 'Saving...' : 'Save system fee'}
            </button>
          </div>
        </div>

        <div className="med-card" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div className="avatar sm" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
              <PencilLine size={18} />
            </div>
            <div>
              <h3 className="card-title" style={{ margin: 0 }}>Doctor Fee Controls</h3>
              <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Edit a doctor's fee directly from admin.</p>
            </div>
          </div>
          <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Use the <strong>Edit Fee</strong> action in the doctor table to override individual consultation fees.
          </div>
        </div>
      </div>

      <div className="med-card" style={{ marginBottom: '24px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Search doctors by name, specialty or email..."
            className="med-input"
            style={{ paddingLeft: '40px', marginBottom: 0 }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="med-card" style={{ padding: 0, overflowX: 'auto' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading doctors...</div>
        ) : filteredDoctors.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px' }}>
            <div className="empty-icon"><UserCheck size={40} /></div>
            <h3>No doctors found</h3>
            <p>{searchTerm ? 'No matches found for your search criteria.' : 'No doctors have registered on the platform yet.'}</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f8fafc' }}>
              <tr style={{ borderBottom: '2px solid var(--card-border)', textAlign: 'left' }}>
                <th style={{ padding: '16px', fontWeight: 600 }}>Name</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Credentials</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Email</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Verification</th>
                <th style={{ padding: '16px', fontWeight: 600 }}>Account</th>
                <th style={{ padding: '16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDoctors.map(doc => {
                const isSuspended = doc.isActive === false;
                const isVerifyLoading = actionLoading === doc._id + '-verify';
                const isSuspendLoading = actionLoading === doc._id + '-suspend';
                return (
                  <tr key={doc._id} style={{ borderBottom: '1px solid var(--card-border)', transition: 'background 0.2s', opacity: isSuspended ? 0.7 : 1 }}>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{doc.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ID: {doc._id.substring(0, 8)}...</div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div className="badge low" style={{ display: 'inline-block', marginBottom: '4px', background: 'var(--primary-light)', color: 'var(--primary)' }}>
                        {doc.specialty}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {Array.isArray(doc.qualifications) ? doc.qualifications.join(', ') : (doc.qualifications || 'No qualifications listed')}
                      </div>
                    </td>
                    <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                      {doc.contact?.email}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className={`badge ${doc.isVerified ? 'low' : 'high'}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}>
                        {doc.isVerified ? <CheckCircle size={14} /> : null}
                        {doc.isVerified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className={`badge ${isSuspended ? 'high' : 'low'}`} style={{ display: 'flex', alignItems: 'center', gap: '4px', width: 'fit-content' }}>
                        {isSuspended ? <UserX size={14} /> : <UserCheck2 size={14} />}
                        {isSuspended ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        <button
                          className="med-button secondary sm"
                          onClick={() => openFeeModal(doc)}
                        >
                          <DollarSign size={14} /> Edit Fee
                        </button>
                        {/* Verify / Revoke */}
                        {!doc.isVerified ? (
                          <button
                            className="med-button primary sm"
                            disabled={isVerifyLoading}
                            onClick={() => handleVerify(doc._id, true)}
                          >
                            {isVerifyLoading ? '...' : 'Verify'}
                          </button>
                        ) : (
                          <button
                            className="med-button secondary sm"
                            style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
                            disabled={isVerifyLoading}
                            onClick={() => handleVerify(doc._id, false)}
                          >
                            {isVerifyLoading ? '...' : 'Revoke'}
                          </button>
                        )}
                        {/* Suspend / Reactivate */}
                        {isSuspended ? (
                          <button
                            className="med-button primary sm"
                            disabled={isSuspendLoading}
                            onClick={() => handleSuspend(doc._id, true)}
                          >
                            {isSuspendLoading ? '...' : 'Reactivate'}
                          </button>
                        ) : (
                          <button
                            className="med-button secondary sm"
                            style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
                            disabled={isSuspendLoading}
                            onClick={() => handleSuspend(doc._id, false)}
                          >
                            {isSuspendLoading ? '...' : 'Suspend'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Modal isOpen={Boolean(feeModalDoctor)} onClose={() => setFeeModalDoctor(null)} title="Edit Doctor Consultation Fee" width="520px">
        {feeModalDoctor && (
          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ background: 'var(--bg-light)', borderRadius: '14px', padding: '14px' }}>
              <div style={{ fontWeight: 800, fontSize: '1rem' }}>{feeModalDoctor.name}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{feeModalDoctor.specialty}</div>
            </div>
            <div>
              <label className="med-label">Consultation Fee (LKR)</label>
              <input
                className="med-input"
                type="number"
                min={0}
                value={doctorFeeInput}
                onChange={(e) => setDoctorFeeInput(e.target.value)}
                placeholder="Enter fee"
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="med-button secondary" onClick={() => setFeeModalDoctor(null)}>
                Cancel
              </button>
              <button className="med-button primary" onClick={saveDoctorFee} disabled={savingDoctorFee}>
                {savingDoctorFee ? 'Saving...' : 'Save fee'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
