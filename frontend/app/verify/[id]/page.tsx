'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { doctorApi } from '../../services/api';
import { CheckCircle, AlertCircle, ShieldCheck, Stethoscope, Clock, Pill, QrCode } from 'lucide-react';

export default function VerifyPrescription() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [prescription, setPrescription] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) loadPrescription();
  }, [id]);

  const loadPrescription = async () => {
    try {
      setLoading(true);
      const data = await doctorApi.verifyPrescription(id as string);
      setPrescription(data);
    } catch (err: any) {
      setError(err.message || 'Prescription not found');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const handleShare = async () => {
    const shareData = {
      title: 'MedSync Digital Prescription',
      text: `Digital Prescription from ${prescription?.doctorName} for ${prescription?.patientName}`,
      url: window.location.href,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div style={styles.fullCenter}>
        <div style={styles.spinnerWrap}>
          <div style={styles.spinnerRing} />
          <div style={styles.spinnerInner} />
        </div>
        <p style={styles.loadTitle}>Verifying Prescription…</p>
        <p style={styles.loadSub}>Authenticating cryptographic signature</p>
        <style>{spinnerCss}</style>
      </div>
    );
  }

  /* ── Error ── */
  if (error || !prescription) {
    return (
      <div style={styles.fullCenter}>
        <div style={styles.errorCard}>
          <div style={styles.errorIcon}><AlertCircle size={32} color="#DC2626" /></div>
          <h1 style={styles.errorTitle}>Verification Failed</h1>
          <p style={styles.errorBody}>
            This verification ID does not match any valid record. The prescription may have been
            revoked, expired, or the document could be fraudulent.
          </p>
          <a href="/" style={styles.backBtn}>Return to Dashboard</a>
        </div>
      </div>
    );
  }

  const issuedDate = new Date(prescription.issuedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });

  /* ── Main ── */
  return (
    <div style={styles.page}>

      {/* Top Nav Bar */}
      <header style={styles.navbar}>
        <div style={styles.navInner}>
          <div style={styles.brandRow}>
            <div style={styles.brandIcon}><ShieldCheck size={18} color="#fff" /></div>
            <span style={styles.brandText}>Med<span style={styles.brandAccent}>Sync</span></span>
          </div>
          <div style={styles.verifiedBadge}>
            <span style={styles.verifiedDot} />
            Secure Verification Portal
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main style={styles.main}>

        {/* Status Banner */}
        <div style={styles.statusBanner}>
          <CheckCircle size={20} color="#059669" />
          <span style={styles.statusText}>Document Authenticated & Verified</span>
          <span style={styles.statusDate}>Issued: {issuedDate}</span>
        </div>

        {/* Certificate Card */}
        <div style={styles.card}>

          {/* Card Header */}
          <div style={styles.cardHeader}>
            <div style={styles.cardHeaderLeft}>
              <div style={styles.officialTag}>
                <ShieldCheck size={11} />
                &nbsp;Official Medical Record
              </div>
              <h1 style={styles.docTitle}>Digital Prescription Certificate</h1>
              <p style={styles.docSubtitle}>
                Cryptographically signed and verified document for pharmacy fulfillment.
              </p>
            </div>
            <div style={styles.cardHeaderRight}>
              <div style={styles.authBadge}>
                <CheckCircle size={16} color="#059669" />
                <span>AUTHENTICATED</span>
              </div>
            </div>
          </div>

          <div style={styles.divider} />

          {/* Parties Section */}
          <div style={styles.partiesGrid}>

            {/* Physician */}
            <div style={styles.partyBlock}>
              <p style={styles.sectionLabel}>Prescribing Physician</p>
              <div style={styles.physicianRow}>
                <div style={styles.physicianAvatar}>
                  <Stethoscope size={24} color="#0F52BA" />
                </div>
                <div>
                  <h3 style={styles.physicianName}>{prescription.doctorName}</h3>
                  <p style={styles.physicianRole}>MedSync Authorized Clinician</p>
                  <p style={styles.physicianId}>ID: MS-{prescription.doctorId?.slice(-6).toUpperCase()}</p>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={styles.verticalDivider} />

            {/* Patient */}
            <div style={styles.partyBlock}>
              <p style={styles.sectionLabel}>Authorized Patient</p>
              <h3 style={styles.patientName}>{prescription.patientName}</h3>
              <p style={styles.patientSub}>Verified Identity · Sequence Match</p>

              <div style={styles.metaRow}>
                <span style={styles.metaKey}>System VID</span>
                <span style={styles.metaValue}>{prescription.verificationId}</span>
              </div>
            </div>
          </div>

          <div style={styles.divider} />

          {/* Signature */}
          {prescription.signatureBase64 && (
            <>
              <div style={styles.sigSection}>
                <p style={styles.sectionLabel}>Digital Signature</p>
                <div style={styles.sigBox}>
                  <img
                    src={prescription.signatureBase64}
                    alt="Doctor Signature"
                    style={styles.sigImg}
                  />
                  <div style={styles.sigFooter}>
                    <span style={styles.sigDot} />
                    RSA-2048 Cryptographic Match Verified
                  </div>
                </div>
              </div>
              <div style={styles.divider} />
            </>
          )}

          {/* Medications */}
          <div style={styles.section}>
            <div style={styles.sectionHeader}>
              <Pill size={15} color="#0F52BA" />
              <p style={styles.sectionLabelInline}>Prescribed Medication List</p>
            </div>

            <div style={styles.medList}>
              {prescription.medications.map((m: any, idx: number) => (
                <div key={idx} style={styles.medCard}>
                  <div style={styles.medCardLeft}>
                    <div style={styles.medIndex}>{idx + 1}</div>
                    <div>
                      <h4 style={styles.medName}>{m.medication}</h4>
                      <div style={styles.medMeta}>
                        <span style={styles.medDosage}>{m.dosage}</span>
                        <span style={styles.medDivide}>·</span>
                        <Clock size={12} color="#94A3B8" />
                        <span style={styles.medFreq}>{m.frequency}</span>
                      </div>
                    </div>
                  </div>
                  {m.duration && (
                    <div style={styles.medDuration}>
                      <span style={styles.medDurationLabel}>Duration</span>
                      <span style={styles.medDurationValue}>{m.duration}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Instructions + QR */}
          {(prescription.instructions) && (
            <>
              <div style={styles.divider} />
              <div style={styles.bottomRow}>
                <div style={styles.instructionsBlock}>
                  <p style={styles.sectionLabel}>Clinical Instructions</p>
                  <blockquote style={styles.instructions}>
                    {prescription.instructions}
                  </blockquote>
                </div>

                <div style={styles.qrBlock}>
                  <div style={styles.qrFrame}>
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}`}
                      alt="QR Verification"
                      style={styles.qrImg}
                    />
                  </div>
                  <p style={styles.qrLabel}>Scan to Verify</p>
                  <p style={styles.qrId}>{prescription.verificationId?.slice(0, 12).toUpperCase()}…</p>
                </div>
              </div>
            </>
          )}

          {/* Card Footer */}
          <div style={styles.cardFooter}>
            <span style={styles.footerItem}>MedSync Secure Record</span>
            <span style={styles.footerDot}>·</span>
            <span style={styles.footerItem}>HIPAA Compliant</span>
            <span style={styles.footerDot}>·</span>
            <span style={styles.footerItem}>Verify at medsync.health/verify</span>
          </div>
        </div>

        {/* Action Bar */}
        <div style={styles.actionBar} className="print:hidden">
          <button onClick={handlePrint} style={styles.primaryBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
            </svg>
            Export PDF
          </button>
          <button onClick={handleShare} style={copied ? styles.sharesBtnActive : styles.shareBtn}>
            {copied
              ? <><CheckCircle size={16} color="#059669" /> Copied!</>
              : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg> Share</>
            }
          </button>
        </div>

      </main>

      <style>{printCss}</style>
    </div>
  );
}

/* ─────────────────────────── Styles ─────────────────────────── */
const C = {
  navy: '#0A2540',
  blue: '#0F52BA',
  blueLight: '#EEF4FF',
  green: '#059669',
  greenLight: '#ECFDF5',
  border: '#E2E8F0',
  muted: '#94A3B8',
  text: '#1E293B',
  textSec: '#475569',
  bg: '#F0F4F8',
  white: '#FFFFFF',
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: C.bg,
    fontFamily: "'DM Sans', 'Inter', -apple-system, sans-serif",
  },

  /* Nav */
  navbar: {
    background: C.navy,
    borderBottom: `1px solid rgba(255,255,255,0.06)`,
    position: 'sticky' as const,
    top: 0,
    zIndex: 50,
  },
  navInner: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '14px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandRow: { display: 'flex', alignItems: 'center', gap: 10 },
  brandIcon: {
    width: 34, height: 34,
    background: C.blue,
    borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  brandText: { fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px' },
  brandAccent: { color: '#38BDF8' },
  verifiedBadge: {
    display: 'flex', alignItems: 'center', gap: 7,
    fontSize: 11, fontWeight: 600, color: '#94A3B8',
    letterSpacing: '0.05em', textTransform: 'uppercase' as const,
  },
  verifiedDot: {
    width: 7, height: 7,
    background: '#34D399',
    borderRadius: '50%',
    boxShadow: '0 0 6px #34D399',
  },

  /* Main */
  main: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '40px 32px 80px',
  },

  /* Status Banner */
  statusBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: C.greenLight,
    border: `1px solid #A7F3D0`,
    borderRadius: 10,
    padding: '12px 20px',
    marginBottom: 28,
    fontSize: 13.5,
    fontWeight: 600,
    color: '#065F46',
  },
  statusText: { flex: 1 },
  statusDate: { fontSize: 12, color: '#34D399', fontWeight: 500 },

  /* Card */
  card: {
    background: C.white,
    borderRadius: 20,
    border: `1px solid ${C.border}`,
    boxShadow: '0 8px 40px rgba(15,23,42,0.08)',
    overflow: 'hidden',
  },

  /* Card Header */
  cardHeader: {
    padding: '40px 48px 36px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 24,
    background: 'linear-gradient(135deg, #F8FAFF 0%, #FFFFFF 100%)',
    borderBottom: `1px solid ${C.border}`,
  },
  cardHeaderLeft: { flex: 1 },
  cardHeaderRight: { flexShrink: 0, paddingTop: 4 },
  officialTag: {
    display: 'inline-flex', alignItems: 'center',
    padding: '5px 12px',
    background: C.blueLight,
    color: C.blue,
    borderRadius: 6,
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    marginBottom: 14,
  },
  docTitle: {
    fontSize: 32,
    fontWeight: 800,
    color: C.navy,
    lineHeight: 1.2,
    letterSpacing: '-0.5px',
    marginBottom: 10,
  },
  docSubtitle: {
    fontSize: 13.5,
    color: C.muted,
    lineHeight: 1.6,
    maxWidth: 420,
  },
  authBadge: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 18px',
    background: C.greenLight,
    border: '1px solid #A7F3D0',
    borderRadius: 10,
    color: '#065F46',
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap' as const,
  },

  /* Divider */
  divider: {
    height: 1,
    background: C.border,
    margin: '0',
  },

  /* Parties */
  partiesGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1px 1fr',
    gap: 0,
    padding: '36px 0',
  },
  partyBlock: {
    padding: '0 48px',
  },
  verticalDivider: {
    background: C.border,
    width: 1,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: C.muted,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    marginBottom: 16,
  },
  physicianRow: { display: 'flex', alignItems: 'center', gap: 16 },
  physicianAvatar: {
    width: 52, height: 52,
    background: C.blueLight,
    borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  physicianName: { fontSize: 18, fontWeight: 700, color: C.navy, marginBottom: 3 },
  physicianRole: { fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: 4 },
  physicianId: { fontSize: 11, fontFamily: 'monospace', color: '#CBD5E1' },
  patientName: { fontSize: 26, fontWeight: 800, color: C.navy, marginBottom: 4, letterSpacing: '-0.3px' },
  patientSub: { fontSize: 11, fontWeight: 600, color: C.muted, letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: 20 },
  metaRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px',
    background: '#F8FAFC',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
  },
  metaKey: { fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase' as const },
  metaValue: { fontSize: 12, fontFamily: 'monospace', fontWeight: 600, color: C.navy },

  /* Signature */
  sigSection: { padding: '32px 48px' },
  sigBox: {
    display: 'inline-block',
    padding: '20px 28px 14px',
    background: '#FAFAFA',
    border: `1px solid ${C.border}`,
    borderRadius: 12,
  },
  sigImg: { height: 52, display: 'block', opacity: 0.85 },
  sigFooter: {
    display: 'flex', alignItems: 'center', gap: 7,
    marginTop: 12,
    fontSize: 10, fontWeight: 700, color: C.muted,
    letterSpacing: '0.1em', textTransform: 'uppercase' as const,
  },
  sigDot: { width: 6, height: 6, background: C.blue, borderRadius: '50%' },

  /* Medications */
  section: { padding: '32px 48px' },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 },
  sectionLabelInline: {
    fontSize: 10, fontWeight: 700, color: C.muted,
    letterSpacing: '0.15em', textTransform: 'uppercase' as const,
  },
  medList: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  medCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 22px',
    border: `1px solid ${C.border}`,
    borderRadius: 12,
    background: '#FAFBFC',
    transition: 'border-color 0.15s',
  },
  medCardLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  medIndex: {
    width: 30, height: 30,
    background: C.blueLight,
    color: C.blue,
    borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontWeight: 700,
    flexShrink: 0,
  },
  medName: { fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 6 },
  medMeta: { display: 'flex', alignItems: 'center', gap: 8 },
  medDosage: {
    fontSize: 12, fontWeight: 700, color: C.blue,
    background: C.blueLight, padding: '3px 10px', borderRadius: 6,
  },
  medDivide: { color: C.muted, fontSize: 14 },
  medFreq: { fontSize: 12, color: C.textSec },
  medDuration: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 2,
  },
  medDurationLabel: { fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase' as const },
  medDurationValue: { fontSize: 12, fontWeight: 600, color: C.textSec },

  /* Instructions + QR */
  bottomRow: {
    display: 'flex',
    gap: 28,
    padding: '32px 48px',
    alignItems: 'flex-start',
  },
  instructionsBlock: { flex: 1 },
  instructions: {
    margin: '12px 0 0',
    padding: '18px 22px',
    background: C.navy,
    borderRadius: 12,
    color: 'rgba(255,255,255,0.90)',
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 1.7,
    borderLeft: `3px solid #38BDF8`,
  },
  qrBlock: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 8, flexShrink: 0 },
  qrFrame: {
    padding: 8, background: C.white, border: `1px solid ${C.border}`,
    borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  },
  qrImg: { width: 108, height: 108, display: 'block' },
  qrLabel: { fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: '0.1em', textTransform: 'uppercase' as const },
  qrId: { fontSize: 9, fontFamily: 'monospace', color: '#CBD5E1' },

  /* Card Footer */
  cardFooter: {
    borderTop: `1px solid ${C.border}`,
    padding: '16px 48px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#F8FAFC',
  },
  footerItem: { fontSize: 11, color: C.muted, fontWeight: 500 },
  footerDot: { color: C.border, fontSize: 14 },

  /* Action Bar */
  actionBar: {
    display: 'flex',
    justifyContent: 'center',
    gap: 12,
    marginTop: 32,
  },
  primaryBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '12px 28px',
    background: C.navy,
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 14, fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(10,37,64,0.3)',
    transition: 'background 0.2s',
  },
  shareBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '12px 24px',
    background: C.white,
    color: C.textSec,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  sharesBtnActive: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '12px 24px',
    background: C.greenLight,
    color: '#065F46',
    border: `1px solid #A7F3D0`,
    borderRadius: 10,
    fontSize: 14, fontWeight: 600,
    cursor: 'pointer',
  },

  /* Loading */
  fullCenter: {
    minHeight: '100vh',
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center',
    background: C.bg, gap: 16,
  },
  spinnerWrap: { position: 'relative' as const, width: 52, height: 52 },
  spinnerRing: {
    position: 'absolute' as const, inset: 0,
    border: '3px solid #E2E8F0', borderRadius: '50%',
  },
  spinnerInner: {
    position: 'absolute' as const, inset: 0,
    border: '3px solid transparent',
    borderTopColor: C.blue,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  loadTitle: { fontSize: 16, fontWeight: 700, color: C.navy },
  loadSub: { fontSize: 13, color: C.muted },

  /* Error */
  errorCard: {
    background: C.white, borderRadius: 20, padding: '48px 40px',
    maxWidth: 420, width: '100%', textAlign: 'center' as const,
    boxShadow: '0 8px 40px rgba(15,23,42,0.1)',
    border: `1px solid #FEE2E2`,
  },
  errorIcon: {
    width: 64, height: 64, background: '#FEF2F2', borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 20px',
  },
  errorTitle: { fontSize: 22, fontWeight: 800, color: C.navy, marginBottom: 12 },
  errorBody: { fontSize: 14, color: C.textSec, lineHeight: 1.6, marginBottom: 28 },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '11px 24px', background: C.navy, color: '#fff',
    borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none',
  },
};

const spinnerCss = `@keyframes spin { to { transform: rotate(360deg); } }`;

const printCss = `
  @media print {
    @page { size: A4; margin: 15mm; }
    body { background: white !important; }
    header, .print\\:hidden { display: none !important; }
  }
`;
