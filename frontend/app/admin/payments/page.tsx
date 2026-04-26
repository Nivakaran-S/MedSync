'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { paymentApi } from '../../services/api';
import { ShieldBan, CreditCard, DollarSign, TrendingUp, RefreshCcw, Search, ExternalLink, Filter, Mail, Download, Undo2 } from 'lucide-react';
import { Badge, Skeleton, showToast, Modal } from '../../components/UI';

export default function AdminPaymentsPage() {
    const { user, isLoading: authLoading } = useAuth();
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
    const [emailing, setEmailing] = useState(false);
    const [downloading, setDownloading] = useState(false);

    useEffect(() => {
        if (user?.role === 'admin') {
            loadPayments();
        }
    }, [user]);

    const loadPayments = async () => {
        try {
            setLoading(true);
            const data = await paymentApi.adminGetAllPayments();
            setPayments(Array.isArray(data) ? data : []);
        } catch (err) {
            showToast('Failed to load system payments', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (authLoading) return <Skeleton type="card" />;

    if (user?.role !== 'admin') {
        return (
            <div className="empty-state">
                <div className="empty-icon"><ShieldBan size={48} /></div>
                <h3>Access Denied</h3>
                <p>You do not have permission to view financial records.</p>
            </div>
        );
    }

    const filteredPayments = payments.filter(p => {
        const matchesSearch = 
            p.doctorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p._id?.includes(searchTerm) ||
            p.appointmentId?.includes(searchTerm) ||
            p.stripeSessionId?.includes(searchTerm);
        
        const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });

    const totalRevenue = payments.reduce((acc, p) => p.status === 'paid' ? acc + p.amount : acc, 0);
    const successRate = payments.length > 0 ? (payments.filter(p => p.status === 'paid').length / payments.length) * 100 : 0;

    const openDetails = (payment: any) => setSelectedPayment(payment);

    const handleDownloadReceipt = async (appointmentId: string) => {
        try {
            setDownloading(true);
            await paymentApi.downloadReceiptPdf(appointmentId);
            showToast('Receipt PDF downloaded', 'success');
        } catch (err: any) {
            showToast(err.message || 'Failed to download receipt', 'error');
        } finally {
            setDownloading(false);
        }
    };

    const handleEmailReceipt = async (appointmentId: string) => {
        try {
            setEmailing(true);
            await paymentApi.resendReceiptEmail(appointmentId);
            showToast('Receipt email sent', 'success');
        } catch (err: any) {
            showToast(err.message || 'Failed to send receipt email', 'error');
        } finally {
            setEmailing(false);
        }
    };

    return (
        <div className="animate-in" style={{ display: 'grid', gap: '22px' }}>
            <section style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)', color: 'white', borderRadius: '24px', padding: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                    <div>
                        <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.12em', opacity: 0.72, marginBottom: '8px' }}>Admin finance</div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>Financial overlook</h1>
                        <p style={{ color: 'rgba(255,255,255,0.82)', lineHeight: 1.7, maxWidth: '760px', margin: 0 }}>Track payments, review reconciliation, and inspect consultation transactions with a clean operational view.</p>
                    </div>
                    <button className="med-button secondary" onClick={loadPayments}>
                        <RefreshCcw size={16} /> Refresh
                    </button>
                </div>
            </section>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '4px' }}>Transaction board</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Search by transaction, appointment, or doctor name.</p>
                </div>
            </div>

            <div className="stats-bar" style={{ marginBottom: '32px' }}>
                <div className="stat-item shadow-sm">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div className="stat-value" style={{ color: 'var(--turquoise)' }}>{totalRevenue.toLocaleString()}</div>
                            <div className="stat-label">Total Revenue (LKR)</div>
                        </div>
                        <div className="avatar sm" style={{ background: 'var(--success-light)', color: 'var(--success)', width: '32px', height: '32px' }}>
                            <TrendingUp size={16} />
                        </div>
                    </div>
                </div>
                <div className="stat-item shadow-sm">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div className="stat-value">{successRate.toFixed(1)}%</div>
                            <div className="stat-label">Transaction Success</div>
                        </div>
                        <div className="avatar sm" style={{ background: 'var(--primary-light)', color: 'var(--primary)', width: '32px', height: '32px' }}>
                            <CheckCircle size={16} />
                        </div>
                    </div>
                </div>
                <div className="stat-item shadow-sm">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <div className="stat-value">{payments.length}</div>
                            <div className="stat-label">Total Sessions</div>
                        </div>
                        <div className="avatar sm" style={{ background: 'var(--accent-light)', color: 'var(--accent)', width: '32px', height: '32px' }}>
                            <DollarSign size={16} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: '1fr 300px', gap: '20px', marginBottom: '24px' }}>
                <div className="med-card" style={{ marginBottom: 0, padding: '12px 16px' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input 
                            type="text" 
                            placeholder="Find by doctor, transaction ID or session..." 
                            className="med-input"
                            style={{ paddingLeft: '40px', marginBottom: 0, border: 'none' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="med-card" style={{ marginBottom: 0, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Filter size={18} color="var(--text-secondary)" />
                    <select 
                        className="med-input" 
                        style={{ border: 'none', marginBottom: 0, cursor: 'pointer' }}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">Every Account Status</option>
                        <option value="paid">Paid</option>
                        <option value="pending">Pending</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </div>

            <div className="med-card" style={{ padding: 0, overflowX: 'auto' }}>
                {loading ? (
                    <div style={{ padding: '60px' }}><Skeleton type="card" /></div>
                ) : filteredPayments.length === 0 ? (
                    <div className="empty-state" style={{ padding: '80px' }}>
                        <div className="empty-icon"><CreditCard size={48} /></div>
                        <h3>No financial records found</h3>
                        <p>No transactions match your search or filter criteria.</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'var(--bg-main)' }}>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--card-border)' }}>
                                <th style={{ padding: '16px', fontWeight: 600, fontSize: '0.85rem' }}>Transaction ID / Date</th>
                                <th style={{ padding: '16px', fontWeight: 600, fontSize: '0.85rem' }}>Reference Context</th>
                                <th style={{ padding: '16px', fontWeight: 600, fontSize: '0.85rem' }}>Full Amount</th>
                                <th style={{ padding: '16px', fontWeight: 600, fontSize: '0.85rem' }}>Financial Status</th>
                                <th style={{ padding: '16px', fontWeight: 600, fontSize: '0.85rem', textAlign: 'right' }}>Log Details</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPayments.map((p) => (
                                <tr key={p._id} style={{ borderBottom: '1px solid var(--card-border)', transition: 'background 0.2s' }}>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p._id.substring(0, 10)}...</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                            {new Date(p.createdAt).toLocaleDateString()} {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Doctor:</span> {p.doctorName}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Appt: {p.appointmentId}</div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontWeight: 600, color: p.status === 'paid' ? 'var(--success)' : 'inherit' }}>
                                            {p.currency?.toUpperCase() || 'LKR'} {p.amount.toLocaleString()}
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <Badge 
                                            text={p.status.toUpperCase()} 
                                            variant={p.status === 'paid' ? 'low' : p.status === 'pending' ? 'medium' : 'high'} 
                                        />
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right' }}>
                                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                                            {p.status === 'paid' && (
                                                <button
                                                    className="med-button sm danger"
                                                    onClick={async () => {
                                                        const reason = prompt('Refund reason (optional):') ?? undefined;
                                                        if (!confirm(`Refund ${p.currency?.toUpperCase() || 'LKR'} ${p.amount.toLocaleString()} for ${p.doctorName}?`)) return;
                                                        try {
                                                            await paymentApi.refund(p.appointmentId, reason || undefined);
                                                            showToast('Refund issued successfully', 'success');
                                                            loadPayments();
                                                        } catch (err) {
                                                            showToast(err instanceof Error ? err.message : 'Refund failed', 'error');
                                                        }
                                                    }}
                                                >
                                                    <Undo2 size={14} /> Refund
                                                </button>
                                            )}
                                            <button className="med-button sm secondary" onClick={() => openDetails(p)}>
                                                <ExternalLink size={14} /> Details
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <Modal isOpen={Boolean(selectedPayment)} onClose={() => setSelectedPayment(null)} title="Payment Details" width="720px">
                {selectedPayment && (
                    <div style={{ display: 'grid', gap: '18px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                            <div className="med-card" style={{ marginBottom: 0, padding: '14px' }}>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Amount</div>
                                <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>
                                    {(selectedPayment.currency || 'LKR').toUpperCase()} {Number(selectedPayment.amount || 0).toLocaleString()}
                                </div>
                            </div>
                            <div className="med-card" style={{ marginBottom: 0, padding: '14px' }}>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Status</div>
                                <Badge text={String(selectedPayment.status || 'unknown').toUpperCase()} variant={selectedPayment.status === 'paid' ? 'low' : selectedPayment.status === 'pending' ? 'medium' : 'high'} />
                            </div>
                            <div className="med-card" style={{ marginBottom: 0, padding: '14px' }}>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Receipt</div>
                                <div style={{ fontWeight: 700 }}>{selectedPayment.receiptNumber || 'Not generated'}</div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                            <div style={{ background: 'var(--bg-light)', borderRadius: '14px', padding: '14px' }}>
                                <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Reference</div>
                                <div style={{ marginTop: '8px', lineHeight: 1.7 }}>
                                    <div><strong>Appointment:</strong> {selectedPayment.appointmentId}</div>
                                    <div><strong>Doctor:</strong> {selectedPayment.doctorName || '—'}</div>
                                    <div><strong>Patient:</strong> {selectedPayment.patientId || '—'}</div>
                                    <div><strong>Stripe Session:</strong> {selectedPayment.stripeSessionId || '—'}</div>
                                </div>
                            </div>
                            <div style={{ background: 'var(--bg-light)', borderRadius: '14px', padding: '14px' }}>
                                <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Audit</div>
                                <div style={{ marginTop: '8px', lineHeight: 1.7 }}>
                                    <div><strong>Payment Intent:</strong> {selectedPayment.stripePaymentIntentId || '—'}</div>
                                    <div><strong>Created:</strong> {new Date(selectedPayment.createdAt).toLocaleString()}</div>
                                    <div><strong>Updated:</strong> {new Date(selectedPayment.updatedAt || selectedPayment.createdAt).toLocaleString()}</div>
                                    <div><strong>Receipt Email:</strong> {selectedPayment.lastReceiptEmail || '—'}</div>
                                </div>
                            </div>
                        </div>

                        {selectedPayment.auditInsights && (
                            <div style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(15,23,42,0.04))', borderRadius: '14px', padding: '14px', border: '1px solid var(--card-border)' }}>
                                <div style={{ fontWeight: 800, marginBottom: '8px' }}>Audit intelligence</div>
                                <div style={{ display: 'grid', gap: '6px', color: 'var(--text-secondary)' }}>
                                    <div><strong>Risk score:</strong> {selectedPayment.auditInsights.riskScore}/100</div>
                                    <div><strong>Risk level:</strong> {String(selectedPayment.auditInsights.riskLevel || 'low').toUpperCase()}</div>
                                    <div><strong>Flags:</strong> {(selectedPayment.auditInsights.flags || []).join(', ') || 'None'}</div>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button
                                className="med-button secondary"
                                onClick={() => handleDownloadReceipt(selectedPayment.appointmentId)}
                                disabled={downloading || selectedPayment.status !== 'paid'}
                            >
                                <Download size={14} /> {downloading ? 'Downloading...' : 'Download PDF'}
                            </button>
                            <button
                                className="med-button primary"
                                onClick={() => handleEmailReceipt(selectedPayment.appointmentId)}
                                disabled={emailing || selectedPayment.status !== 'paid'}
                            >
                                <Mail size={14} /> {emailing ? 'Sending...' : 'Email Receipt'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}

const CheckCircle = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
);
