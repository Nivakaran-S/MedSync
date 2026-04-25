'use client';

import React, { useState } from 'react';
import { MedCard as Card, MedInput as Input, MedButton as Button, showToast } from '../components/UI';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ClipboardEdit, ShieldCheck } from 'lucide-react';

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        firstName: '', lastName: '', email: '', password: '',
        phone: '', dateOfBirth: '', gender: 'Other', address: '',
        name: '', specialty: '', qualifications: '', bio: '', consultationFee: ''
    });
    const [licenseFile, setLicenseFile] = useState<File | null>(null);
    const [licensePreview, setLicensePreview] = useState<string | null>(null);
    const [role, setRole] = useState<'patient' | 'doctor'>('patient');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const router = useRouter();

    const uploadLicenseImage = async (file: File) => {
        const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
        const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
        if (!cloudName || !preset) {
            throw new Error('Cloudinary upload is not configured. Please set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET.');
        }

        const form = new FormData();
        form.append('file', file);
        form.append('upload_preset', preset);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/upload`, {
            method: 'POST',
            body: form,
        });

        if (!response.ok) {
            throw new Error('Failed to upload license image to Cloudinary.');
        }

        const data = await response.json();
        return data.secure_url as string;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let submitData: any = {};
            if (role === 'doctor') {
                if (!licenseFile) {
                    throw new Error('Please upload a copy of your medical license.');
                }

                const licenseImageUrl = await uploadLicenseImage(licenseFile);

                submitData = {
                    name: formData.name,
                    specialty: formData.specialty,
                    qualifications: formData.qualifications.split(',').map((q) => q.trim()).filter(Boolean),
                    bio: formData.bio,
                    consultationFee: Number(formData.consultationFee || 0),
                    contact: { email: formData.email, phone: formData.phone },
                    password: formData.password,
                    licenseImageUrl,
                };
            } else {
                submitData = formData;
            }

            await register({ ...submitData, role });
            showToast('Account created! Please sign in.', 'success');
            router.push('/login');
        } catch (err: any) {
            showToast(err.message || 'Registration failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: any) => setFormData({ ...formData, [e.target.name]: e.target.value });

    return (
        <div style={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: 'var(--bg-main)' }}>
            {/* Left Branding Panel (Hidden on very small screens) */}
            <div className="sidebar" style={{
                flex: 1, 
                background: 'linear-gradient(135deg, var(--primary-dark) 0%, var(--primary) 100%)', 
                color: 'white', 
                padding: '60px 40px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                position: 'sticky',
                top: 0,
                height: '100vh',
                overflow: 'hidden',
                maxWidth: '45%'
            }}>
                <div className="animate-in" style={{ position: 'relative', zIndex: 1, maxWidth: '440px', margin: '0 auto', textAlign: 'left' }}>
                    <h1 style={{ fontSize: '3.2rem', fontWeight: 800, marginBottom: '24px', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                        Join MedSync Today.
                    </h1>
                    <p style={{ fontSize: '1.15rem', opacity: 0.9, lineHeight: 1.6, marginBottom: '40px' }}>
                        Step into the future of healthcare. Experience seamless appointments, cutting-edge AI diagnostics, and a strictly unified medical ecosystem.
                    </p>
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.1)', borderRadius: 'var(--radius-lg)', backdropFilter: 'blur(10px)' }}>
                            <ClipboardEdit size={32} />
                        </div>
                        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.1)', borderRadius: 'var(--radius-lg)', backdropFilter: 'blur(10px)' }}>
                            <ShieldCheck size={32} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Form Panel */}
            <div style={{ 
                flex: 1, 
                display: 'flex', 
                flexDirection: 'column',
                padding: '60px 24px',
                minHeight: '100vh'
            }}>
                <div style={{ width: '100%', maxWidth: '540px', margin: '0 auto' }} className="animate-in">
                    
                    <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Create an Account</h2>
                        <p style={{ color: 'var(--text-secondary)' }}>Welcome to MedSync. Please enter your details below.</p>
                    </div>

                    <Card title="" className="glass-card" style={{ padding: '32px' }}>
                        
                        {/* Segmented Control */}
                        <div style={{ 
                            display: 'flex', 
                            background: 'var(--primary-light)', 
                            padding: '6px', 
                            borderRadius: 'calc(var(--radius-lg) + 4px)', 
                            marginBottom: '32px' 
                        }}>
                            <button 
                                type="button"
                                onClick={() => setRole('patient')}
                                style={{
                                    flex: 1, padding: '12px 0', borderRadius: 'var(--radius-lg)',
                                    border: 'none', cursor: 'pointer', fontWeight: 600, transition: 'all 0.3s ease',
                                    background: role === 'patient' ? 'var(--primary)' : 'transparent',
                                    color: role === 'patient' ? 'white' : 'var(--primary-hover)',
                                    boxShadow: role === 'patient' ? 'var(--shadow-md)' : 'none'
                                }}>
                                Patient Registration
                            </button>
                            <button 
                                type="button"
                                onClick={() => setRole('doctor')}
                                style={{
                                    flex: 1, padding: '12px 0', borderRadius: 'var(--radius-lg)',
                                    border: 'none', cursor: 'pointer', fontWeight: 600, transition: 'all 0.3s ease',
                                    background: role === 'doctor' ? 'var(--primary)' : 'transparent',
                                    color: role === 'doctor' ? 'white' : 'var(--primary-hover)',
                                    boxShadow: role === 'doctor' ? 'var(--shadow-md)' : 'none'
                                }}>
                                Doctor Registration
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {role === 'patient' ? (
                                <>
                                    <div className="grid-2" style={{ gap: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                                        <Input label="First Name" name="firstName" value={formData.firstName} onChange={handleChange} required />
                                        <Input label="Last Name" name="lastName" value={formData.lastName} onChange={handleChange} required />
                                    </div>
                                    <Input label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} required />
                                    <div className="grid-2" style={{ gap: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                                        <Input label="Password" name="password" type="password" value={formData.password} onChange={handleChange} required />
                                        <Input label="Phone Number" name="phone" value={formData.phone} onChange={handleChange} />
                                    </div>
                                    <div className="grid-2" style={{ gap: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                                        <Input label="Birth Date" name="dateOfBirth" type="date" value={formData.dateOfBirth} onChange={handleChange} required />
                                        <div className="med-input-group" style={{ marginBottom: 0 }}>
                                            <label className="med-label">Gender</label>
                                            <select name="gender" className="med-input" value={formData.gender} onChange={handleChange} style={{ height: '42px' }}>
                                                <option value="Male">Male</option>
                                                <option value="Female">Female</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                    </div>
                                    <Input label="Residential Address" name="address" value={formData.address} onChange={handleChange} />
                                </>
                            ) : (
                                <>
                                    <Input label="Full Name with Title" name="name" value={formData.name} onChange={handleChange} placeholder="Dr. John Doe" required />
                                    <div className="grid-2" style={{ gap: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                                        <Input label="Professional Email" name="email" type="email" value={formData.email} onChange={handleChange} required />
                                        <Input label="Contact Phone" name="phone" value={formData.phone} onChange={handleChange} />
                                    </div>
                                    <div className="grid-2" style={{ gap: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                                        <Input label="Password" name="password" type="password" value={formData.password} onChange={handleChange} required />
                                        <div className="med-input-group" style={{ marginBottom: 0 }}>
                                            <label className="med-label">Primary Specialty</label>
                                            <select
                                                name="specialty"
                                                className="med-input"
                                                value={formData.specialty}
                                                onChange={handleChange}
                                                required
                                                style={{ height: '42px' }}
                                            >
                                                <option value="">Select specialty</option>
                                                <option value="General Practice">General Practice</option>
                                                <option value="Cardiology">Cardiology</option>
                                                <option value="Dermatology">Dermatology</option>
                                                <option value="Neurology">Neurology</option>
                                                <option value="Pediatrics">Pediatrics</option>
                                                <option value="Psychiatry">Psychiatry</option>
                                                <option value="Orthopedics">Orthopedics</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </div>
                                    </div>
                                    <Input label="Qualifications (Comma separated)" name="qualifications" value={formData.qualifications} onChange={handleChange} placeholder="MBBS, MD, FACC" />
                                    <Input
                                        label="Consultation Fee (LKR)"
                                        name="consultationFee"
                                        type="number"
                                        min="0"
                                        value={formData.consultationFee}
                                        onChange={handleChange}
                                        placeholder="e.g. 2500"
                                    />
                                    <div className="med-input-group">
                                        <label className="med-label">Professional Biography</label>
                                        <textarea name="bio" className="med-input" rows={3} value={formData.bio} onChange={handleChange} placeholder="Brief summary of your clinical expertise and background..." />
                                    </div>
                                    <div className="med-input-group">
                                        <label className="med-label">Medical License Image</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="med-input"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0] || null;
                                                setLicenseFile(file);
                                                setLicensePreview(file ? URL.createObjectURL(file) : null);
                                            }}
                                            required
                                        />
                                        {licensePreview ? (
                                            <div style={{ marginTop: '12px' }}>
                                                <span style={{ display: 'block', marginBottom: '6px', color: 'var(--text-secondary)' }}>Preview</span>
                                                <img src={licensePreview} alt="License preview" style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '12px', border: '1px solid var(--card-border)' }} />
                                            </div>
                                        ) : (
                                            <p style={{ marginTop: '12px', color: 'var(--text-secondary)', fontSize: '0.92rem' }}>Upload a scanned copy or photo of your license so admin can verify your credentials.</p>
                                        )}
                                    </div>
                                </>
                            )}

                            <Button type="submit" className="primary" disabled={loading} style={{ width: '100%', marginTop: '24px', padding: '14px', fontSize: '1.05rem' }}>
                                {loading ? 'Creating Secure Account...' : 'Complete Registration'}
                            </Button>
                        </form>
                        
                        <div style={{ textAlign: 'center', marginTop: '32px', borderTop: '1px solid var(--card-border)', paddingTop: '24px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Already hold a MedSync account? </span>
                            <Link href="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Log In securely</Link>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
