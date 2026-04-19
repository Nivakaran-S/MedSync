'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { Bot, ClipboardList, User, FileText, Video } from 'lucide-react';
import { appointmentApi } from '../services/api';

export default function PatientDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [activeAppointments, setActiveAppointments] = useState<any[]>([]);
  const [loadingAppts, setLoadingAppts] = useState(true);

  // Protect the route
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'patient')) {
      router.push('/login');
    } else if (user?.id) {
       loadActiveAppointments();
    }
  }, [user, isLoading, router]);

  const loadActiveAppointments = async () => {
     try {
        const data = await appointmentApi.getPatientAppointments(user!.id);
        // Only show confirmed appointments
        const active = data.filter((a: any) => a.status === 'confirmed');
        setActiveAppointments(active);
     } catch (err) {
        console.error('Failed to load appointments', err);
     } finally {
        setLoadingAppts(false);
     }
  };

  if (isLoading || !user) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading your dashboard...</div>;
  }

  return (
    <div className="animate-in">
      {/* Active Consultation Alert */}
      {activeAppointments.length > 0 && (
         <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '20px', borderRadius: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
               <div className="animate-pulse" style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#0ea5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                  <Video size={20} />
               </div>
               <div>
                  <div style={{ fontWeight: 700, color: '#0369a1' }}>Active Consultation Ready</div>
                  <div style={{ fontSize: '0.85rem', color: '#0ea5e9' }}>You have a session with Dr. {activeAppointments[0].doctorName}</div>
               </div>
            </div>
            <Link 
               href={`/telemedicine/${activeAppointments[0]._id}`}
               className="med-button" 
               style={{ background: '#0ea5e9', color: 'white', padding: '10px 20px', borderRadius: '10px', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem' }}
            >
               Join Virtual Clinic
            </Link>
         </div>
      )}

      {/* Hero */}
      <div className="hero" style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)', color: 'white', padding: '40px', borderRadius: '24px', marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '16px' }}>
          Welcome back, {user.name}
        </h1>
        <p style={{ fontSize: '1.1rem', opacity: 0.9, maxWidth: '800px', marginBottom: '24px' }}>
          Your integrated platform for personal medical management and AI-powered health diagnostics.
          Manage your profile, track your records, and get instant health assessments.
        </p>
        <div className="hero-actions" style={{ display: 'flex', gap: '16px' }}>
          <Link href="/symptom-checker" className="med-button" style={{ background: 'white', color: '#0ea5e9', fontWeight: 700, padding: '12px 24px', borderRadius: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bot size={20} /> AI Health Check
          </Link>
          <Link href="/patient/records" className="med-button" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', fontWeight: 600, padding: '12px 24px', borderRadius: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ClipboardList size={20} /> View Records
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        <div className="stat-item" style={{ background: 'white', padding: '24px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0ea5e9' }}>24/7</div>
          <div className="stat-label" style={{ color: '#64748b', fontSize: '0.9rem' }}>AI Diagnostics</div>
        </div>
        <div className="stat-item" style={{ background: 'white', padding: '24px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0ea5e9' }}>13+</div>
          <div className="stat-label" style={{ color: '#64748b', fontSize: '0.9rem' }}>Medical Specialties</div>
        </div>
        <div className="stat-item" style={{ background: 'white', padding: '24px', borderRadius: '16px', textAlign: 'center', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0ea5e9' }}>100%</div>
          <div className="stat-label" style={{ color: '#64748b', fontSize: '0.9rem' }}>Secure & Encrypted</div>
        </div>
      </div>

      {/* Feature Cards */}
      <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '20px', color: '#1e293b' }}>
        Quick Access
      </h2>
      <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
        <Link href="/patient/profile" className="feature-card" style={{ background: 'white', padding: '24px', borderRadius: '20px', textDecoration: 'none', color: 'inherit', border: '1px solid #f1f5f9', transition: 'all 0.2s' }}>
          <div className="feature-icon" style={{ background: '#e0f2fe', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: '16px', color: '#0ea5e9' }}><User size={24} /></div>
          <h3 style={{ fontWeight: 700, marginBottom: '8px' }}>My Profile</h3>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Access patient profiles, medical history, and integrated healthcare coordination.</p>
        </Link>

        <Link href="/patient/records" className="feature-card" style={{ background: 'white', padding: '24px', borderRadius: '20px', textDecoration: 'none', color: 'inherit', border: '1px solid #f1f5f9', transition: 'all 0.2s' }}>
          <div className="feature-icon" style={{ background: '#f0f9ff', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: '16px', color: '#0284c7' }}><FileText size={24} /></div>
          <h3 style={{ fontWeight: 700, marginBottom: '8px' }}>Medical Records</h3>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>View your treatment history, prescriptions, and securely upload important medical documents.</p>
        </Link>

        <Link href="/symptom-checker" className="feature-card" style={{ background: 'white', padding: '24px', borderRadius: '20px', textDecoration: 'none', color: 'inherit', border: '1px solid #f1f5f9', transition: 'all 0.2s' }}>
          <div className="feature-icon" style={{ background: '#dcfce7', width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: '16px', color: '#16a34a' }}><Bot size={24} /></div>
          <h3 style={{ fontWeight: 700, marginBottom: '8px' }}>AI Symptom Checker</h3>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Describe your symptoms and receive AI-powered specialist recommendations with urgency assessment.</p>
        </Link>
      </div>

      <footer style={{ marginTop: '60px', textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.85rem' }}>
        © 2026 MedSync Health Systems. All rights reserved.
      </footer>
    </div>
  );
}
