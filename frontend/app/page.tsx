'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from './context/AuthContext';
import { useRouter } from 'next/navigation';
import { Stethoscope, Bot, FileText } from 'lucide-react';

export default function LandingPage() {
  const { user } = useAuth();
  const router = useRouter();

  // If already logged in, redirect to respective dashboard
  React.useEffect(() => {
    if (user) {
      if (user.role === 'admin') router.push('/admin');
      else if (user.role === 'doctor') router.push('/doctor');
      else router.push('/patient');
    }
  }, [user, router]);

  return (
    <div className="landing-container">
      <style jsx>{`
        .landing-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          background: radial-gradient(circle at top right, #f0f9ff, #ffffff);
          color: #1e293b;
          font-family: 'Inter', sans-serif;
        }
        .hero-section {
          max-width: 1200px;
          padding: 80px 20px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .badge {
          background: #e0f2fe;
          color: #0369a1;
          padding: 6px 16px;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 24px;
          display: inline-block;
        }
        h1 {
          font-size: 4rem;
          font-weight: 800;
          line-height: 1.1;
          margin-bottom: 24px;
          background: linear-gradient(135deg, #0f172a 0%, #334155 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        h1 span {
          color: #0ea5e9;
          -webkit-text-fill-color: #0ea5e9;
        }
        .description {
          font-size: 1.25rem;
          color: #64748b;
          max-width: 700px;
          margin-bottom: 40px;
          line-height: 1.6;
        }
        .cta-group {
          display: flex;
          gap: 16px;
          margin-bottom: 60px;
        }
        .btn {
          padding: 14px 32px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 1.1rem;
          transition: all 0.2s ease;
          cursor: pointer;
          text-decoration: none;
        }
        .btn-primary {
          background: #0ea5e9;
          color: white;
          box-shadow: 0 10px 15px -3px rgba(14, 165, 233, 0.3);
        }
        .btn-primary:hover {
          background: #0284c7;
          transform: translateY(-2px);
        }
        .btn-secondary {
          background: white;
          color: #0f172a;
          border: 1px solid #e2e8f0;
        }
        .btn-secondary:hover {
          background: #f8fafc;
          transform: translateY(-2px);
        }
        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 32px;
          width: 100%;
          max-width: 1100px;
          margin-top: 40px;
        }
        .feature-item {
          background: white;
          padding: 32px;
          border-radius: 24px;
          border: 1px solid #f1f5f9;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          text-align: left;
          transition: all 0.3s ease;
        }
        .feature-item:hover {
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.05);
          transform: translateY(-5px);
        }
        .icon-box {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          margin-bottom: 20px;
        }
        .blue { background: #e0f2fe; color: #0ea5e9; }
        .green { background: #dcfce7; color: #22c55e; }
        .purple { background: #f3e8ff; color: #a855f7; }
        h3 { font-size: 1.25rem; font-weight: 700; margin-bottom: 12px; }
        p.feature-desc { color: #64748b; line-height: 1.5; font-size: 1rem; }
      `}</style>

      <section className="hero-section">
        <div className="badge">Next Generation Healthcare</div>
        <h1>Your Health, <span>Synchronized</span>.</h1>
        <p className="description">
          MedSync brings together patients, doctors, and advanced AI diagnostics into one seamless platform. 
          Manage your health journey with unparalleled precision and care.
        </p>

        {!user && (
          <div className="cta-group">
            <Link href="/login" className="btn btn-primary">Sign In to Dashboard</Link>
            <Link href="/register" className="btn btn-secondary">Create Account</Link>
          </div>
        )}

        <div className="features-grid">
          <div className="feature-item">
            <div className="icon-box blue"><Stethoscope size={24} /></div>
            <h3>Smart Consultations</h3>
            <p className="feature-desc">Connect with top-tier specialists through our integrated telemedicine suite.</p>
          </div>
          <div className="feature-item">
            <div className="icon-box green"><Bot size={24} /></div>
            <h3>AI Health Insights</h3>
            <p className="feature-desc">Leverage cutting-edge AI for symptom analysis and personalized health recommendations.</p>
          </div>
          <div className="feature-item">
            <div className="icon-box purple"><FileText size={24} /></div>
            <h3>Unified Lab Records</h3>
            <p className="feature-desc">Securely access and share your medical history and lab results in one encrypted vault.</p>
          </div>
        </div>
      </section>

      <footer style={{ marginTop: 'auto', padding: '40px', color: '#94a3b8', fontSize: '0.9rem' }}>
        © 2026 MedSync Health Systems. Built for the future of care.
      </footer>
    </div>
  );
}
