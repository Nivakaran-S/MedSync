'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { doctorApi } from '../../../services/api';

export default function LicenseManagementPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  
  const [doctor, setDoctor] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadDoctor();
    }
  }, [id]);

  const loadDoctor = async () => {
    try {
      setLoading(true);
      const data = await doctorApi.getDoctor(id);
      setDoctor(data);
    } catch (err) {
      console.error(err);
      alert('Failed to load doctor details');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'approve' | 'reject') => {
    try {
      await doctorApi.updateLicenseStatus(id, action === 'approve');
      alert(`License ${action}d successfully`);
      router.push('/admin/doctors');
    } catch (err) {
      console.error(err);
      alert(`Failed to ${action} license`);
    }
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  if (!doctor) return <div style={{ padding: '40px', textAlign: 'center' }}>Doctor not found</div>;

  return (
    <div className="animate-in" style={{ padding: '24px' }}>
      <button className="med-button secondary" onClick={() => router.back()} style={{ marginBottom: '24px' }}>
        &larr; Back to Doctors
      </button>

      <h1 className="page-title">License Management</h1>
      <p className="page-subtitle">Review license for Dr. {doctor.name}</p>

      <div className="med-card" style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'flex-start' }}>
        <div>
          <h3>{doctor.name} - {doctor.specialty}</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Email: {doctor.contact?.email}</p>
          <p style={{ color: 'var(--text-secondary)' }}>Status: {doctor.isVerified ? 'Verified' : 'Pending Verification'}</p>
        </div>

        {doctor.licenseImageUrl ? (
          <div style={{ width: '100%' }}>
            <h4 style={{ marginBottom: '12px' }}>License Document</h4>
            <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid var(--card-border)', display: 'flex', justifyContent: 'center' }}>
              <img 
                src={doctor.licenseImageUrl} 
                alt="License" 
                style={{ maxWidth: '100%', maxHeight: '600px', objectFit: 'contain' }} 
              />
            </div>
          </div>
        ) : (
          <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '8px', width: '100%' }}>
            No license image uploaded.
          </div>
        )}

        <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
          <button 
            className="med-button primary" 
            onClick={() => handleAction('approve')}
            disabled={doctor.isVerified}
          >
            {doctor.isVerified ? 'Already Approved' : 'Approve License'}
          </button>
          <button 
            className="med-button secondary" 
            onClick={() => handleAction('reject')}
            style={{ borderColor: 'var(--error)', color: 'var(--error)' }}
          >
            Reject License
          </button>
        </div>
      </div>
    </div>
  );
}
