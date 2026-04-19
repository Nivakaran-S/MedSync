'use client';

import React from 'react';
import { MedCard as Card, MedButton as Button } from '../../components/UI';
import Link from 'next/link';

export default function PaymentSuccessPage() {
    return (
        <div className="animate-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '24px' }}>
            <Card title="Payment confirmed" icon="✓" style={{ maxWidth: '560px', width: '100%', textAlign: 'center', background: 'white' }}>
                <div style={{ width: '88px', height: '88px', borderRadius: '28px', margin: '0 auto 20px', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, rgba(16,185,129,0.14), rgba(34,197,94,0.2))', color: 'var(--success)', fontSize: '2.1rem', fontWeight: 800 }}>
                    ✓
                </div>
                <h2 style={{ marginBottom: '10px', fontSize: '1.45rem', fontWeight: 800 }}>Payment received successfully</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.7 }}>
                    Your consultation has been paid for and the appointment record has been updated. You can now review the booking details or return to your dashboard.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link href="/appointment">
                        <Button className="navy">Open appointments</Button>
                    </Link>
                    <Link href="/">
                        <Button variant="secondary">Back to dashboard</Button>
                    </Link>
                </div>
            </Card>
        </div>
    );
}
