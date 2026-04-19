'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { appointmentApi } from '../services/api';

export default function TelemedicineHubPage() {
  const { user, isLoading } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        setLoading(true);

        if (user.role === 'doctor') {
          const data = await appointmentApi.getDoctorAppointments(user.id);
          setAppointments(Array.isArray(data) ? data : []);
        } else if (user.role === 'patient') {
          const data = await appointmentApi.getPatientAppointments(user.id);
          setAppointments(Array.isArray(data) ? data : []);
        } else {
          setAppointments([]);
        }
      } catch (e) {
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    };

    if (!isLoading) load();
  }, [isLoading, user]);

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="animate-in">
      <header style={{ marginBottom: '28px' }}>
        <h1 className="page-title">Telemedicine</h1>
        <p className="page-subtitle">Join a virtual consultation for a confirmed appointment.</p>
      </header>

      <div className="med-card">
        {loading ? (
          <div>Loading appointments...</div>
        ) : appointments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎥</div>
            <h3>No sessions available</h3>
            <p>You don’t have any appointments available for telemedicine right now.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {appointments
              .filter((a) => a.status === 'confirmed')
              .map((a) => (
                <div key={a._id} className="history-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{user?.role === 'doctor' ? a.patientName : a.doctorName}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {new Date(a.slotDate).toLocaleDateString()} at {a.slotTime}
                    </div>
                  </div>
                  <Link className="med-button primary sm" href={`/telemedicine/${a._id}`}>
                    Join
                  </Link>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
