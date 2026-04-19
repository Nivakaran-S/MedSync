'use client';

import React, { useState, useEffect } from 'react';
import { MedCard as Card, MedButton as Button, Badge, Skeleton, showToast } from '../components/UI';
import { paymentApi } from '@/app/services/api';
import { CreditCard, Receipt, Clock, CheckCircle, XCircle, Download, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function PaymentHistoryPage() {
    const { user } = useAuth();
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPayments = async () => {
            if (!user?.id) return;
            try {
                const data = await paymentApi.getPatientPayments(user.id);
                setPayments(Array.isArray(data) ? data : []);
            } catch (err) {
                showToast('Failed to load payment history', 'error');
            } finally {
                setLoading(false);
            }
        };
        fetchPayments();
    }, [user]);

    const handleDownloadReceipt = async (appointmentId: string) => {
        try {
            await paymentApi.downloadReceiptPdf(appointmentId);
            showToast('Receipt downloaded', 'success');
        } catch (err: any) {
            showToast(err.message || 'Failed to download receipt', 'error');
        }
    };

    const handleEmailReceipt = async (appointmentId: string) => {
        try {
            await paymentApi.resendReceiptEmail(appointmentId);
            showToast('Receipt sent to your email', 'success');
        } catch (err: any) {
            showToast(err.message || 'Failed to send receipt email', 'error');
        }
    };

    if (loading) return <Skeleton type="card" />;

    const totalSpent = payments.reduce((acc, p) => p.status === 'paid' ? acc + (p.amount || 0) : acc, 0);
    const successCount = payments.filter(p => p.status === 'paid').length;

    return (
        <div className="animate-in">
            <header style={{ marginBottom: '32px' }}>
                <h1 className="page-title text-navy">Billing &amp; Payments</h1>
                <p className="page-subtitle">View your transaction history and download receipts for your consultations.</p>
            </header>

            <div className="stats-bar">
                <div className="stat-item">
                    <div className="stat-value">{payments.length}</div>
                    <div className="stat-label">Total Transactions</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value">{successCount}</div>
                    <div className="stat-label">Successful</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value" style={{ color: 'var(--turquoise)' }}>
                        {totalSpent.toLocaleString()}
                    </div>
                    <div className="stat-label">Total Spent (LKR)</div>
                </div>
                <div className="stat-item">
                    <div className="stat-value" style={{ color: 'var(--warning)' }}>
                        {payments.filter(p => p.status === 'pending').length}
                    </div>
                    <div className="stat-label">Pending</div>
                </div>
            </div>

            <Card title="Payment Activity" icon={<Receipt size={20} />}>
                {payments.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon"><CreditCard size={48} /></div>
                        <h3>No payments yet</h3>
                        <p>Your transaction history will appear here once you book and pay for consultations.</p>
                    </div>
                ) : (
                    <div className="table-container" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--card-border)' }}>
                                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Date</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Doctor / Reference</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Amount</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Status</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Receipt #</th>
                                    <th style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map((payment) => (
                                    <tr key={payment._id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <Clock size={16} color="var(--text-muted)" />
                                                <span style={{ fontSize: '0.9rem' }}>{new Date(payment.createdAt).toLocaleDateString()}</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Dr. {payment.doctorName || 'Specialist'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                                {payment.appointmentId?.substring(0, 12)}…
                                            </div>
                                        </td>
                                        <td style={{ padding: '16px', fontWeight: 700 }}>
                                            {(payment.currency || 'LKR').toUpperCase()} {(payment.amount || 0).toLocaleString()}
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            <Badge
                                                text={payment.status.toUpperCase()}
                                                variant={payment.status === 'paid' ? 'low' : payment.status === 'pending' ? 'medium' : 'high'}
                                            />
                                        </td>
                                        <td style={{ padding: '16px', fontFamily: 'monospace', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {payment.receiptNumber || '—'}
                                        </td>
                                        <td style={{ padding: '16px' }}>
                                            {payment.status === 'paid' ? (
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        icon={<Download size={14} />}
                                                        onClick={() => handleDownloadReceipt(payment.appointmentId)}
                                                    >
                                                        PDF
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="secondary"
                                                        icon={<Mail size={14} />}
                                                        onClick={() => handleEmailReceipt(payment.appointmentId)}
                                                    >
                                                        Email
                                                    </Button>
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <XCircle size={14} />
                                                    {payment.status === 'refunded' ? 'Refunded' : 'Not available'}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </Card>
        </div>
    );
}
