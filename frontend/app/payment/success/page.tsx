'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import { MedCard as Card, MedButton as Button } from '../../components/UI';
import Link from 'next/link';
import { paymentApi } from '../../services/api';
import { useSearchParams } from 'next/navigation';

function PaymentSuccessInner() {
    const searchParams = useSearchParams();
    const sessionId = useMemo(() => searchParams.get('session_id') || '', [searchParams]);
    const [confirming, setConfirming] = useState(Boolean(sessionId));
    const [confirmed, setConfirmed] = useState(false);
    const [message, setMessage] = useState('Finalizing your payment and updating the appointment status...');

    useEffect(() => {
        let mounted = true;

        const finalizePayment = async () => {
            if (!sessionId) {
                if (!mounted) return;
                setConfirming(false);
                setConfirmed(true);
                setMessage('Payment completed. Your appointment status will be synced shortly.');
                return;
            }

            try {
                await paymentApi.confirmCheckoutSession(sessionId);
                if (!mounted) return;
                setConfirmed(true);
                setMessage('Payment confirmed and appointment status updated successfully.');
            } catch (error: any) {
                if (!mounted) return;
                setConfirmed(false);
                setMessage(error?.message || 'Payment was captured, but status sync is still in progress.');
            } finally {
                if (mounted) setConfirming(false);
            }
        };

        finalizePayment();
        return () => {
            mounted = false;
        };
    }, [sessionId]);

    return (
        <div className="animate-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '24px' }}>
            <Card title="Payment confirmed" icon="✓" style={{ maxWidth: '560px', width: '100%', textAlign: 'center', background: 'white' }}>
                <div style={{ width: '88px', height: '88px', borderRadius: '28px', margin: '0 auto 20px', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, rgba(16,185,129,0.14), rgba(34,197,94,0.2))', color: 'var(--success)', fontSize: '2.1rem', fontWeight: 800 }}>
                    ✓
                </div>
                <h2 style={{ marginBottom: '10px', fontSize: '1.45rem', fontWeight: 800 }}>Payment received successfully</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.7 }}>
                    {confirming ? 'Please wait while we complete the final verification.' : message}
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link href="/appointment">
                        <Button className="navy" disabled={confirming}>Open appointments</Button>
                    </Link>
                    <Link href="/">
                        <Button variant="secondary">Back to dashboard</Button>
                    </Link>
                </div>
                {!confirming && !confirmed && (
                    <p style={{ marginTop: '14px', color: 'var(--warning)', fontSize: '0.9rem' }}>
                        If status still looks pending, open appointments and click refresh after a few seconds.
                    </p>
                )}
            </Card>
        </div>
    );
}

export default function PaymentSuccessPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '70vh' }} />}>
            <PaymentSuccessInner />
        </Suspense>
    );
}
