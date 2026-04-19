'use client';

import React from 'react';
import { MedCard as Card, MedButton as Button } from '../../components/UI';
import Link from 'next/link';

export default function PaymentCancelPage() {
    return (
        <div className="animate-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '24px' }}>
            <Card title="Payment cancelled" icon="!" style={{ maxWidth: '560px', width: '100%', textAlign: 'center', background: 'white' }}>
                <div style={{ width: '88px', height: '88px', borderRadius: '28px', margin: '0 auto 20px', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, rgba(248,113,113,0.14), rgba(239,68,68,0.18))', color: 'var(--error)', fontSize: '2.1rem', fontWeight: 800 }}>
                    !
                </div>
                <h2 style={{ marginBottom: '10px', fontSize: '1.45rem', fontWeight: 800 }}>No charge was made</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.7 }}>
                    The payment step was interrupted. You can return to your appointments and continue whenever you're ready.
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link href="/appointment">
                        <Button className="navy">Return to appointments</Button>
                    </Link>
                    <Link href="/">
                        <Button variant="secondary">Back to dashboard</Button>
                    </Link>
                </div>
            </Card>
        </div>
    );
}
