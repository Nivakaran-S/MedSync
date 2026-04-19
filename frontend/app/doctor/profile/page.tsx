'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { doctorApi } from '../../services/api';
import { showToast } from '../../components/UI';
import { User, Mail, Phone, BookOpen, Stethoscope, FileText, Save, ArrowLeft, GraduationCap, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function DoctorProfile() {
  const { user, isLoading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    specialty: '',
    consultationFee: 0,
    bio: '',
    contact: {
      email: '',
      phone: ''
    },
    qualifications: [] as string[]
  });

  const [qualInput, setQualInput] = useState('');

  useEffect(() => {
    if (user?.role === 'doctor') {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    try {
      const data = await doctorApi.getDoctor(user!.id);
      setProfile({
        name: data.name || '',
        specialty: data.specialty || '',
        consultationFee: Number(data.consultationFee || 0),
        bio: data.bio || '',
        contact: {
          email: data.contact?.email || '',
          phone: data.contact?.phone || ''
        },
        qualifications: data.qualifications || []
      });
    } catch (err) {
      showToast('Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await doctorApi.updateDoctor(user!.id, profile);
      showToast('Profile updated successfully!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const addQualification = () => {
    if (qualInput.trim()) {
      setProfile({
        ...profile,
        qualifications: [...profile.qualifications, qualInput.trim()]
      });
      setQualInput('');
    }
  };

  const removeQualification = (index: number) => {
    const updated = [...profile.qualifications];
    updated.splice(index, 1);
    setProfile({ ...profile, qualifications: updated });
  };

  /* ── Loading State ── */
  if (authLoading || loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', fontFamily: "'IBM Plex Sans', sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" style={{ borderTopColor: '#004A99', width: '40px', height: '40px', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Loading Professional Profile...</p>
        </div>
      </div>
    );
  }

  /* ── Styles ── */
  const styles = {
    container: {
      fontFamily: "'IBM Plex Sans', sans-serif",
      color: '#1e293b',
      maxWidth: '1000px',
      margin: '0 auto',
      padding: '40px 20px',
    },
    header: {
      marginBottom: '40px',
    },
    backLink: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      color: '#004A99',
      textDecoration: 'none',
      fontSize: '0.9rem',
      fontWeight: 600,
      marginBottom: '16px',
      transition: 'all 0.2s',
    },
    title: {
      fontSize: '2.25rem',
      fontWeight: 800,
      color: '#0f172a',
      letterSpacing: '-0.02em',
      marginBottom: '8px',
    },
    subtitle: {
      color: '#64748b',
      fontSize: '1rem',
    },
    card: {
      background: '#fff',
      borderRadius: '20px',
      border: '1px solid #e2e8f0',
      padding: '32px',
      marginBottom: '32px',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
    },
    cardTitle: {
      fontSize: '1.1rem',
      fontWeight: 700,
      color: '#0f172a',
      marginBottom: '24px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    },
    inputGroup: {
      marginBottom: '20px',
    },
    label: {
      display: 'block',
      fontSize: '0.85rem',
      fontWeight: 700,
      color: '#475569',
      marginBottom: '8px',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.025em',
    },
    input: {
      width: '100%',
      padding: '12px 16px',
      borderRadius: '10px',
      border: '1px solid #cbd5e1',
      fontSize: '1rem',
      color: '#1e293b',
      transition: 'all 0.2s',
      outline: 'none',
      background: '#fff',
    },
    textarea: {
      width: '100%',
      padding: '16px',
      borderRadius: '12px',
      border: '1px solid #cbd5e1',
      fontSize: '1rem',
      color: '#1e293b',
      minHeight: '140px',
      resize: 'vertical' as const,
      outline: 'none',
      lineHeight: '1.6',
    },
    qualItem: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      background: '#f8fafc',
      borderRadius: '10px',
      border: '1px solid #f1f5f9',
      marginBottom: '8px',
    },
    saveButton: {
      width: '100%',
      padding: '16px',
      borderRadius: '14px',
      background: '#004A99',
      color: '#fff',
      border: 'none',
      fontSize: '1.1rem',
      fontWeight: 700,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      boxShadow: '0 10px 15px -3px rgba(0, 74, 153, 0.2)',
      transition: 'all 0.2s',
    }
  };

  return (
    <div style={styles.container}>
      {/* ── Header ── */}
      <header style={styles.header}>
        <Link href="/doctor" style={styles.backLink}>
           <ArrowLeft size={18} /> Dashboard Overview
        </Link>
        <h1 style={styles.title}>Professional Profile</h1>
        <p style={styles.subtitle}>Institutional record management for verified medical practitioners.</p>
      </header>

      <form onSubmit={handleSave}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
          
          {/* ── Principal Details ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div style={styles.card}>
              <h3 style={styles.cardTitle}><User size={20} color="#004A99" /> Principal Information</h3>
              
              <div style={styles.inputGroup}>
                <label style={styles.label}>Full Legal Name</label>
                <input 
                  style={styles.input} 
                  value={profile.name} 
                  onChange={(e) => setProfile({...profile, name: e.target.value})}
                  placeholder="Clinical Name"
                  required
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Medical Specialty</label>
                <input 
                  style={styles.input} 
                  value={profile.specialty} 
                  onChange={(e) => setProfile({...profile, specialty: e.target.value})}
                  placeholder="e.g. Cardiology, Radiology"
                  required
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Consultation Fee (LKR)</label>
                <input
                  style={styles.input}
                  type="number"
                  min={0}
                  value={profile.consultationFee}
                  onChange={(e) => setProfile({ ...profile, consultationFee: Number(e.target.value || 0) })}
                  placeholder="e.g. 2500"
                />
              </div>

              <div style={styles.inputGroup}>
                <label style={styles.label}>Professional Biography</label>
                <textarea 
                  style={styles.textarea} 
                  value={profile.bio} 
                  onChange={(e) => setProfile({...profile, bio: e.target.value})}
                  placeholder="Expertise, background, and medical focus..."
                />
              </div>
            </div>

            <div style={styles.card}>
              <h3 style={styles.cardTitle}><Phone size={20} color="#004A99" /> Communication Registry</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Registered Email</label>
                  <input 
                    style={{ ...styles.input, background: '#f8fafc', color: '#64748b' }} 
                    value={profile.contact.email} 
                    disabled 
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.label}>Public Contact Number</label>
                  <input 
                    style={styles.input} 
                    value={profile.contact.phone} 
                    onChange={(e) => setProfile({...profile, contact: {...profile.contact, phone: e.target.value}})}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Qualifications & Save ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <div style={styles.card}>
              <h3 style={styles.cardTitle}><GraduationCap size={20} color="#004A99" /> Medical Qualifications</h3>
              
              <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                <input 
                  style={styles.input} 
                  placeholder="e.g. MBBS, FRCS" 
                  value={qualInput}
                  onChange={(e) => setQualInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addQualification())}
                />
                <button 
                  type="button" 
                  onClick={addQualification}
                  style={{ background: '#0f172a', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' }}
                >
                  Add
                </button>
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
                {profile.qualifications.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic' }}>
                    No qualifications recorded yet.
                  </div>
                ) : (
                  profile.qualifications.map((q, idx) => (
                    <div key={idx} style={styles.qualItem}>
                      <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.95rem' }}>{q}</span>
                      <button 
                        type="button" 
                        onClick={() => removeQualification(idx)}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ position: 'sticky', top: '24px' }}>
              <button 
                type="submit" 
                style={{ ...styles.saveButton, opacity: saving ? 0.7 : 1 }}
                disabled={saving}
              >
                {saving ? (
                   <div className="loading-spinner" style={{ width: '20px', height: '20px', borderTopColor: '#fff', margin: 0 }}></div>
                ) : (
                   <><Save size={20} /> Update Institutional Profile</>
                )}
              </button>
              
              <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '12px', background: '#f0f9ff', border: '1px solid #e0f2fe', padding: '16px', borderRadius: '12px' }}>
                <div style={{ color: '#0369a1' }}><Stethoscope size={20} /></div>
                <p style={{ fontSize: '0.75rem', color: '#0369a1', lineHeight: '1.5' }}>
                  <strong>Review Notice:</strong> Changes to your legal name or medical specialty may undergo internal administrative review.
                </p>
              </div>
            </div>
          </div>

        </div>
      </form>

      <style jsx>{`
        input:focus, textarea:focus {
           border-color: #004A99 !important;
           box-shadow: 0 0 0 4px rgba(0, 74, 153, 0.05);
        }
        .loading-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(0, 0, 0, 0.05);
          border-top-color: #004A99;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
