 'use client';

import React, { useState, useEffect, use, useMemo } from 'react';
import { MedCard as Card, MedButton as Button, showToast, Skeleton, Badge, MedInput as Input } from '../../../components/UI';
import { doctorApi, appointmentApi, patientApi } from '@/app/services/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { User, CalendarCheck, ShieldCheck, Clock3, CreditCard } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

export default function BookingPage({ params }: { params: Promise<{ doctorId: string }> }) {
    const { doctorId } = use(params);
    const { user, isLoading: authLoading } = useAuth();
    const [doctor, setDoctor] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);
    const [date, setDate] = useState('');
    const [slot, setSlot] = useState('');
    const searchParams = useSearchParams();
    // #9 Pre-fill from symptom-checker deep-link (?reason=...&fromCheckId=...)
    const initialReason = searchParams?.get('reason') || 'General consultation';
    const fromCheckId = searchParams?.get('fromCheckId') || null;
    const [reason, setReason] = useState(initialReason);
    const [availability, setAvailability] = useState<any[]>([]);
    const [slots, setSlots] = useState<string[]>([]);
    const [patientPhone, setPatientPhone] = useState<string | null>(null);
    const [systemFee, setSystemFee] = useState(0);
    const router = useRouter();

    useEffect(() => {
        if (!authLoading && !user) {
            router.replace('/login');
            return;
        }

        const fetchData = async () => {
            try {
                const [docData, availData, feeSettings] = await Promise.all([
                    doctorApi.getDoctor(doctorId),
                    doctorApi.getAvailability(doctorId),
                    doctorApi.getConsultationSettings().catch(() => ({ defaultConsultationFee: 0 })),
                ]);
                setDoctor(docData);
                setAvailability(availData);
                setSystemFee(Number(feeSettings?.defaultConsultationFee || 0));
                // Fetch patient phone for SMS notifications
                try {
                    const profile = await patientApi.getProfile();
                    // Phone can be at root level or inside contact
                    setPatientPhone(profile?.phone || profile?.contact?.phone || null);
                } catch {
                    // Phone is optional — don't block booking
                }
            } catch (err) {
                showToast('Failed to load consultation data', 'error');
                router.push('/appointment/search');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [doctorId, router, authLoading, user]);

    const selectedDoctorFee = useMemo(() => {
        const raw = doctor?.consultationFee;
        const parsed = Number(raw);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    }, [doctor]);

    const totalConsultationFee = useMemo(() => selectedDoctorFee + systemFee, [selectedDoctorFee, systemFee]);

    const normalizeSlotTime = (value: string) => String(value || '').replace(/\s+/g, '').trim();

    useEffect(() => {
        if (!date || availability.length === 0) {
            setSlots([]);
            return;
        }

        const fetchBooked = async () => {
            try {
                const booked = await appointmentApi.getBookedSlots(doctorId, date);

                // Filter slots by local day of week to prevent timezone shift bugs
                const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                const [year, month, day] = date.split('-');
                const localDate = new Date(Number(year), Number(month) - 1, Number(day));
                const selectedDay = days[localDate.getDay()];
                
                const daySlots = availability
                    .filter(a => a.day === selectedDay)
                    .map(a => `${a.startTime} - ${a.endTime}`);
                
                // Filter out already booked slots
                const bookedTimes = new Set(booked.map((b: any) => normalizeSlotTime(b.slotTime)));
                const filtered = daySlots.filter((s) => !bookedTimes.has(normalizeSlotTime(s)));
                
                setSlots(filtered);
            } catch (err) {
                console.error('Error fetching booked slots:', err);
                setSlots([]);
            }
        };
        fetchBooked();
    }, [date, availability, doctorId]);

    const handleBooking = async () => {
        if (!date || !slot) {
            showToast('Please select a date and time slot', 'warning');
            return;
        }

        if (!user?.id) {
            showToast('Please login to book an appointment', 'error');
            router.push('/login');
            return;
        }

        if (selectedDoctorFee <= 0) {
            showToast('Doctor consultation fee is not configured yet. Please try another doctor or contact support.', 'warning');
            return;
        }

        setBooking(true);
        try {
            await appointmentApi.createAppointment({
                patientId: user.id,
                patientName: user.name,
                patientEmail: user.email,
                patientPhone: patientPhone || undefined,
                doctorId: doctorId,
                doctorName: doctor.name,
                specialty: doctor.specialty,
                slotDate: date,
                slotTime: slot,
                reason,
                consultationFee: totalConsultationFee,
                doctorConsultationFee: selectedDoctorFee,
                systemFee,
                totalConsultationFee,
                // #9 — back-link to the symptom check that prompted this booking
                ...(fromCheckId ? { relatedSymptomCheckId: fromCheckId } : {}),
            });

            showToast('Appointment booked successfully!', 'success');
            router.push('/appointment');
        } catch (err: any) {
            showToast(err.message || 'Failed to book appointment', 'error');
        } finally {
            setBooking(false);
        }
    };

    if (loading || authLoading) return <Skeleton type="card" />;

    return (
        <div className="animate-in" style={{ maxWidth: '1080px', margin: '0 auto', display: 'grid', gap: '24px' }}>
            <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(320px, 0.95fr)', gap: '24px' }}>
                <Card title="Consultant" icon={<User size={20} />} className="glass-card-navy" style={{ background: 'white' }}>
                    <div style={{ display: 'grid', gap: '18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                            <div className="avatar lg" style={{ backgroundImage: 'linear-gradient(135deg, #0f172a, #2563eb)', color: 'white' }}>
                                {doctor?.name?.charAt(0)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                                <h1 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '6px' }}>{doctor?.name}</h1>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <Badge text={doctor?.specialty} variant="info" />
                                    {doctor?.isVerified ? <Badge text="Verified consultant" variant="low" /> : <Badge text="Verification pending" variant="medium" />}
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
                            <div style={{ background: 'var(--bg-light)', borderRadius: '16px', padding: '14px' }}>
                                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Consultation fee</div>
                                <div style={{ fontWeight: 800, marginTop: '4px' }}>
                                    {selectedDoctorFee > 0 ? `LKR ${selectedDoctorFee.toLocaleString()}` : 'Fee not set'}
                                </div>
                            </div>
                            <div style={{ background: 'var(--bg-light)', borderRadius: '16px', padding: '14px' }}>
                                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Rating</div>
                                <div style={{ fontWeight: 800, marginTop: '4px' }}>{(doctor?.analytics?.patientSatisfactionScore || 0).toFixed(1)} / 5</div>
                            </div>
                            <div style={{ background: 'var(--bg-light)', borderRadius: '16px', padding: '14px' }}>
                                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Days</div>
                                <div style={{ fontWeight: 800, marginTop: '4px' }}>{availability.length}</div>
                            </div>
                        </div>

                        <div style={{ background: 'linear-gradient(135deg, rgba(37,99,235,0.08), rgba(15,23,42,0.04))', borderRadius: '18px', padding: '16px', border: '1px solid var(--card-border)' }}>
                            <div style={{ fontWeight: 800, marginBottom: '10px' }}>Fee breakdown</div>
                            <div style={{ display: 'grid', gap: '8px', fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                                    <span>Doctor consultation fee</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>LKR {selectedDoctorFee.toLocaleString()}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                                    <span>Default system fee</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>LKR {systemFee.toLocaleString()}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', paddingTop: '8px', borderTop: '1px solid var(--card-border)' }}>
                                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total payable</span>
                                    <strong style={{ color: 'var(--primary)' }}>LKR {totalConsultationFee.toLocaleString()}</strong>
                                </div>
                            </div>
                        </div>

                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.94rem' }}>
                            <p style={{ marginBottom: '10px' }}><strong>Qualifications:</strong> {doctor?.qualifications?.join(', ') || 'MBBS, MD'}</p>
                            <p style={{ margin: 0 }}><strong>Bio:</strong> {doctor?.bio || 'Specialist with extensive clinical experience and patient-focused care.'}</p>
                        </div>

                        <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '16px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                            <ShieldCheck size={16} />
                            <span>Live slot checks run before the appointment is saved.</span>
                        </div>
                    </div>
                </Card>

                <Card title="Appointment details" icon={<CalendarCheck size={20} />} style={{ background: 'white' }}>
                    <div style={{ display: 'grid', gap: '14px' }}>
                        <Input
                            label="Preferred date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                        />

                        <Input
                            label="Reason for visit"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Briefly describe your concern"
                        />

                        <div className="med-input-group">
                            <label className="med-label">Available slots</label>
                            {slots.length > 0 ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                                    {slots.map((item) => (
                                        <button
                                            key={item}
                                            type="button"
                                            onClick={() => setSlot(item)}
                                            style={{
                                                padding: '12px 14px',
                                                borderRadius: '14px',
                                                border: '1px solid',
                                                borderColor: slot === item ? 'var(--primary)' : 'var(--card-border)',
                                                background: slot === item ? 'var(--primary-light)' : 'white',
                                                color: slot === item ? 'var(--primary)' : 'var(--text-secondary)',
                                                fontWeight: 700,
                                                cursor: 'pointer',
                                                transition: 'all 0.18s ease',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                                                <span>{item}</span>
                                                <Clock3 size={14} />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-slots-msg" style={{ padding: '16px', textAlign: 'center', background: 'var(--bg-light)', borderRadius: '14px', color: 'var(--text-secondary)', fontSize: '0.92rem', border: '1px dashed var(--card-border)' }}>
                                    {date ? 'No available slots for the selected date.' : 'Choose a date to load time slots.'}
                                </div>
                            )}
                        </div>

                        <div style={{ background: 'var(--bg-light)', borderRadius: '18px', padding: '16px', display: 'grid', gap: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                <span>Selected slot</span>
                                <strong>{slot || 'Not selected'}</strong>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                                <span>Estimated fee</span>
                                <strong>{selectedDoctorFee > 0 ? `LKR ${totalConsultationFee.toLocaleString()}` : 'Fee not set'}</strong>
                            </div>
                        </div>

                        <Button onClick={handleBooking} disabled={booking || selectedDoctorFee <= 0} className="navy" style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} icon={<CreditCard size={16} />}>
                            {booking ? 'Reserving...' : 'Confirm and continue'}
                        </Button>
                    </div>
                </Card>
            </section>
        </div>
    );
}
