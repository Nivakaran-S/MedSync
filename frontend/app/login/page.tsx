'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { MedCard as Card, MedInput as Input, MedButton as Button, showToast } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, Hourglass } from 'lucide-react';

function LoginPageInner() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pendingApproval = searchParams?.get('pendingApproval') === '1';

    // Redirect if already logged in
    useEffect(() => {
        if (user) {
            if (user.role === 'admin') router.push('/admin');
            else if (user.role === 'doctor') router.push('/doctor');
            else router.push('/patient');
        }
    }, [user, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const loggedInUser = await login(email, password);
            showToast(`Welcome back, ${loggedInUser.name}!`, 'success');
            
            // Redirection logic handled by useEffect above, but we can do it here for speed
            if (loggedInUser.role === 'admin') router.push('/admin');
            else if (loggedInUser.role === 'doctor') router.push('/doctor');
            else router.push('/patient');
            
        } catch (err: any) {
            showToast(err.message || 'Login failed. Please check your credentials.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-wrapper">
            <style jsx>{`
                .login-wrapper {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 90vh;
                    background: #f8fafc;
                }
                .login-container {
                    width: 100%;
                    max-width: 400px;
                    padding: 20px;
                }
                .login-header {
                    text-align: center;
                    margin-bottom: 32px;
                }
                .login-header h2 {
                    font-size: 1.8rem;
                    font-weight: 800;
                    color: #0f172a;
                    margin-bottom: 8px;
                }
                .login-header p {
                    color: #64748b;
                    font-size: 0.95rem;
                }
            `}</style>

            <div className="login-container">
                <div className="login-header">
                    <h2>Welcome Back</h2>
                    <p>Enter your credentials to access your dashboard</p>
                </div>

                {pendingApproval && (
                    <div style={{
                        marginBottom: 20, padding: '14px 16px',
                        background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 12,
                        color: '#78350f', display: 'flex', alignItems: 'flex-start', gap: 10,
                    }}>
                        <Hourglass size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                        <div>
                            <strong>Awaiting administrator approval</strong>
                            <p style={{ margin: '4px 0 0', fontSize: '0.9rem' }}>
                                Thanks for registering. We&apos;ve received your details and license.
                                An administrator will review and approve your account — you&apos;ll receive
                                an email once that happens. You won&apos;t be able to sign in until then.
                            </p>
                        </div>
                    </div>
                )}

                <Card title="Sign In" icon={<Lock size={20} />}>
                    <form onSubmit={handleSubmit} style={{ padding: '8px 4px' }}>
                        <Input 
                            label="Email Address" 
                            type="email" 
                            placeholder="name@company.com"
                            value={email} 
                            onChange={(e) => setEmail(e.target.value)} 
                            required 
                        />
                        <Input 
                            label="Password" 
                            type="password" 
                            placeholder="••••••••"
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                        />
                        
                        <Button 
                            type="submit" 
                            className="primary" 
                            disabled={loading} 
                            style={{ width: '100%', marginTop: '24px', padding: '12px', fontSize: '1rem' }}
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </Button>
                    </form>

                    <div style={{ textAlign: 'center', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
                        <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
                            New to MedSync? <Link href="/register" style={{ color: '#0ea5e9', fontWeight: 600, textDecoration: 'none' }}>Create an account</Link>
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '90vh' }} />}>
            <LoginPageInner />
        </Suspense>
    );
}
