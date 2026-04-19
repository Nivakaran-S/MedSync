'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { doctorApi, appointmentApi } from '../services/api';
import { Clock, Video, User, List, CheckCircle, AlertCircle, BarChart2, TrendingUp, Calendar, ArrowRight, UserCheck } from 'lucide-react';
import { showToast } from '../components/UI';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

export default function DoctorDashboard() {
  const { user, isLoading } = useAuth();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctorDetails, setDoctorDetails] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (user?.role === 'doctor') {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoadingData(true);
      const [appts, docInfo] = await Promise.all([
        appointmentApi.getDoctorAppointments(user!.id),
        doctorApi.getDoctor(user!.id)
      ]);
      setAppointments(appts || []);
      setDoctorDetails(docInfo);
      
      try {
        const analyticsData = await doctorApi.getAnalytics(user!.id);
        setAnalytics(analyticsData);
      } catch (e) {
        console.warn('Analytics service unavailable');
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to load dashboard data', 'error');
    } finally {
      setLoadingData(false);
    }
  };

  // ── Name Normalization (Fix "Dr. Dr.") ──
  const getCleanName = (name: string) => {
    if (!name) return '';
    // Remove "Dr." or "Dr " or "Dr. " from the start (case-insensitive)
    const clean = name.replace(/^(dr\.?\s*)+/i, '').trim();
    return `Dr. ${clean}`;
  };

  /* ── Loading State ── */
  if (isLoading || loadingData) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', fontFamily: "'IBM Plex Sans', sans-serif" }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" style={{ borderTopColor: '#004A99', width: '40px', height: '40px', margin: '0 auto 16px' }}></div>
          <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Accessing Medical Records...</p>
        </div>
      </div>
    );
  }
  
  if (user?.role !== 'doctor') {
    return (
      <div style={{ padding: '40px', textAlign: 'center', fontFamily: "'IBM Plex Sans', sans-serif" }}>
        <div style={{ background: '#fff1f2', border: '1px solid #fecaca', padding: '24px', borderRadius: '12px', maxWidth: '500px', margin: '0 auto' }}>
          <AlertCircle size={40} color="#e11d48" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#9f1239', marginBottom: '8px' }}>Access Restricted</h3>
          <p style={{ color: '#be123c' }}>This dashboard is exclusively for verified medical practitioners.</p>
        </div>
      </div>
    );
  }

  const pending = appointments.filter(a => a.status === 'pending');
  const confirmed = appointments.filter(a => a.status === 'confirmed');
  const finished = appointments.filter(a => a.status === 'completed');

  /* ── Component Styles ── */
  const styles = {
    container: {
      fontFamily: "'IBM Plex Sans', sans-serif",
      color: '#1e293b',
      background: 'transparent',
      maxWidth: '1200px',
      margin: '0 auto',
      paddingBottom: '40px',
    },
    headerCard: {
      background: '#fff',
      borderRadius: '16px',
      overflow: 'hidden',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
      border: '1px solid #e2e8f0',
      marginBottom: '32px',
    },
    banner: {
      height: '160px',
      background: 'linear-gradient(135deg, #001A38 0%, #004A99 100%)',
    },
    profileSection: {
      padding: '0 32px 32px',
      marginTop: '-80px',
      display: 'flex',
      flexWrap: 'wrap' as const,
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: '24px',
    },
    avatar: {
      width: '120px',
      height: '120px',
      borderRadius: '24px',
      background: '#fff',
      padding: '4px',
      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '40px',
      fontWeight: 700,
      color: '#004A99',
      border: '1px solid #f1f5f9',
    },
    statCard: {
      background: '#fff',
      padding: '24px',
      borderRadius: '16px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
      display: 'flex',
      flexDirection: 'column' as const,
      justifyContent: 'space-between',
      minHeight: '120px',
    },
    sectionTitle: {
      fontSize: '1.25rem',
      fontWeight: 700,
      color: '#0f172a',
      marginBottom: '20px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
      gap: '24px',
      marginBottom: '32px',
    },
    analyticsBox: {
      background: '#fff',
      borderRadius: '20px',
      padding: '28px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 4px 10px rgba(0,0,0,0.03)',
      minHeight: '400px',
    },
    actionItem: {
      background: '#f8fafc',
      padding: '16px 20px',
      borderRadius: '12px',
      border: '1px solid #f1f5f9',
      marginBottom: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      transition: 'all 0.2s ease',
    }
  };

  return (
    <div style={styles.container}>
      {/* ── Header ── */}
      <div style={styles.headerCard}>
        <div style={styles.banner}></div>
        <div style={styles.profileSection}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '24px', flexWrap: 'wrap' }}>
            <div style={styles.avatar}>
              {user.name.charAt(0)}
            </div>
            <div style={{ paddingBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '2.25rem', fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em', textShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                  {getCleanName(user.name)}
                </h1>
                {doctorDetails?.isVerified && <CheckCircle size={22} color="#ffffff" />}
              </div>
              <p style={{ fontSize: '1.1rem', color: '#000000', fontWeight: 600, marginBottom: '0' }}>
                {doctorDetails?.specialty || 'Medical Practitioner'}
              </p>
            </div>
          </div>
          <div style={{ paddingBottom: '8px' }}>
            <Link href="/doctor/profile" style={{ textDecoration: 'none' }}>
              <button style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '10px 20px', borderRadius: '10px', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', transition: 'all 0.2s', fontSize: '0.9rem' }}>
                <User size={18} /> Master Profile
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div style={styles.grid}>
        <div style={{ ...styles.statCard, borderLeft: '4px solid #004A99' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Patients</span>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a' }}>{24 + finished.length}</div>
        </div>
        <div style={{ ...styles.statCard, borderLeft: '4px solid #f59e0b' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pending Reviews</span>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a' }}>{pending.length}</div>
        </div>
        <div style={{ ...styles.statCard, borderLeft: '4px solid #10b981' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Today</span>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a' }}>{confirmed.length}</div>
        </div>
        <div style={{ ...styles.statCard, borderLeft: '4px solid #6366f1' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Issued Prescriptions</span>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#0f172a' }}>{analytics?.totalPrescriptions || 0}</div>
        </div>
      </div>

      {/* ── Charts Section ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px', marginBottom: '40px' }}>
        <div style={styles.analyticsBox}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Performance Trend</h3>
              <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Statistical report for the past 7 days</p>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#004A99' }}></div> Appts
               </div>
               <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#818cf8' }}></div> Rx
               </div>
            </div>
          </div>
          
          <div style={{ height: '280px', width: '100%' }}>
            {analytics?.prescriptionTrend ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.prescriptionTrend}>
                  <defs>
                    <linearGradient id="dbColorApp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#004A99" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#004A99" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                    dy={10}
                    tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { weekday: 'short' })}
                  />
                  <YAxis hide />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', padding: '12px' }}
                    labelStyle={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px' }}
                  />
                  <Area type="monotone" dataKey="appointments" stroke="#004A99" strokeWidth={3} fill="url(#dbColorApp)" fillOpacity={1} />
                  <Area type="monotone" dataKey="prescriptions" stroke="#818cf8" strokeWidth={3} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '16px', color: '#94a3b8', fontSize: '0.9rem' }}>
                Collecting trend data...
              </div>
            )}
          </div>
        </div>

        <div style={styles.analyticsBox}>
          <div style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>Reach & Impact</h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Pharmacy engagement and prescription volume</p>
          </div>
          <div style={{ height: '280px', width: '100%' }}>
            {analytics?.prescriptionTrend ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.prescriptionTrend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 700}} 
                    dy={10}
                    tickFormatter={(str) => new Date(str).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  />
                  <Tooltip cursor={{fill: '#f1f5f9', radius: 8}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="prescriptions" radius={[6, 6, 0, 0]} barSize={20}>
                    {analytics.prescriptionTrend.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.prescriptions > 0 ? '#6366f1' : '#e2e8f0'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '16px', color: '#94a3b8', fontSize: '0.9rem' }}>
                Analyzing impact metrics...
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '32px' }}>
        {/* ── Main Panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {/* Action Center */}
          <div style={{ background: '#fff', padding: '32px', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={styles.sectionTitle}><AlertCircle color="#f59e0b" size={24} /> Clinical Tasks</h3>
              <Link href="/doctor/appointments" style={{ color: '#004A99', fontSize: '0.85rem', fontWeight: 700, textDecoration: 'none' }}>View All Registry</Link>
            </div>
            
            {pending.length === 0 ? (
              <div style={{ padding: '48px', textAlign: 'center', background: '#f8fafc', borderRadius: '16px', border: '1px dashed #e2e8f0' }}>
                <UserCheck size={40} color="#cbd5e1" style={{ marginBottom: '12px' }} />
                <p style={{ color: '#64748b', fontSize: '0.95rem' }}>No clinical tasks requiring immediate review.</p>
              </div>
            ) : (
              <div>
                {pending.slice(0, 4).map(a => (
                  <div key={a._id} style={styles.actionItem} onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'} onMouseLeave={(e) => e.currentTarget.style.background = '#f8fafc'}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#fff', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#004A99' }}>
                        {a.patientName.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem' }}>{a.patientName}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Calendar size={12} /> {new Date(a.slotDate).toLocaleDateString()} at {a.slotTime}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', background: '#fff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        {a.reason || 'Symptom Triage'}
                      </span>
                      <Link href="/doctor/appointments" style={{ textDecoration: 'none' }}>
                        <button style={{ height: '36px', width: '36px', borderRadius: '10px', background: '#004A99', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <ArrowRight size={18} />
                        </button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar Tools ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
           <div style={{ background: '#001A38', padding: '28px', borderRadius: '20px', color: '#fff', boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '24px', color: '#fff' }}>Medical Suite</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Link href="/doctor/availability" style={{ textDecoration: 'none' }}>
                  <div style={{ padding: '16px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '16px', color: '#fff' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
                       <Clock size={20} />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Schedule Hub</span>
                  </div>
                </Link>

                <Link href="/doctor/appointments" style={{ textDecoration: 'none' }}>
                  <div style={{ padding: '16px', borderRadius: '14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '16px', color: '#fff' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(129, 140, 248, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a5b4fc' }}>
                       <List size={20} />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Appointment Registry</span>
                  </div>
                </Link>

                <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', fontSize: '0.75rem', color: '#93c5fd', lineHeight: '1.5', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  <strong>Update:</strong> You can now view real-time patient symptom analysis before the consultation starts.
                </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

