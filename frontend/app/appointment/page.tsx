 'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { MedCard as Card, MedButton as Button, MedInput as Input, Badge, Skeleton, showToast, Tabs, Modal } from '../components/UI';
import { appointmentApi, paymentApi } from '@/app/services/api';
import { User, CalendarX, CalendarClock, CreditCard, ArrowRight, Clock3, CheckCircle2, Download, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface Appointment {
    _id: string;
    doctorId: string;
    doctorName: string;
    specialty: string;
    slotDate: string;
    slotTime: string;
    patientPhone?: string;
    consultationFee?: number;
    status: string;
    paymentStatus?: string;
}

export default function AppointmentListPage() {
    const { user, isLoading: authLoading } = useAuth();
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(0);

    const [showReschedule, setShowReschedule] = useState(false);
    const [rescheduleTarget, setRescheduleTarget] = useState<Appointment | null>(null);
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');
    const [rescheduling, setRescheduling] = useState(false);

    const patientId = useMemo(() => user?.id || '', [user]);

    const fetchAppointments = async () => {
        try {
            if (patientId) {
                const data = await appointmentApi.getPatientAppointments(patientId);
                setAppointments(Array.isArray(data) ? data : []);
            }
        } catch {
            showToast('Failed to load appointments', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && !user) {
            window.location.href = '/login';
            return;
        }
        if (patientId) fetchAppointments();
    }, [patientId, authLoading, user]);

    const handlePayment = async (appt: Appointment) => {
        const fee = Number(appt.consultationFee || 0);
        if (fee <= 0) {
            showToast('Doctor fee is not configured for this appointment.', 'warning');
            return;
        }
        try {
            const { url } = await paymentApi.createCheckoutSession({
                appointmentId: appt._id,
                patientId,
                doctorId: appt.doctorId,
                doctorName: appt.doctorName,
                // Pass through email so the webhook can dispatch the
                // confirmation email even if Stripe doesn't surface it.
                patientEmail: appt.patientEmail || user?.email || null,
                patientPhone: appt.patientPhone,
                amount: fee,
            });
            window.location.href = url;
        } catch (err: any) {
            showToast(err.message || 'Payment initiation failed', 'error');
        }
    };

    const handleCancel = async (id: string) => {
        if (!window.confirm('Cancel this appointment?')) return;
        try {
            await appointmentApi.cancelAppointment(id, { cancelledBy: 'patient' });
            showToast('Appointment cancelled', 'info');
            fetchAppointments();
        } catch {
            showToast('Cancellation failed', 'error');
        }
    };

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
            showToast('Receipt email sent', 'success');
        } catch (err: any) {
            showToast(err.message || 'Failed to send receipt email', 'error');
        }
    };

    const openReschedule = (appt: Appointment) => {
        setRescheduleTarget(appt);
        setNewDate(appt.slotDate);
        setNewTime(appt.slotTime);
        setShowReschedule(true);
    };

    const submitReschedule = async () => {
        if (!rescheduleTarget) return;
        if (!newDate || !newTime) {
            showToast('Pick a new date and time', 'warning');
            return;
        }
        setRescheduling(true);
        try {
            await appointmentApi.rescheduleAppointment(rescheduleTarget._id, {
                slotDate: newDate,
                slotTime: newTime,
            });
            showToast('Appointment rescheduled', 'success');
            setShowReschedule(false);
            fetchAppointments();
        } catch (err: any) {
            showToast(err.message || 'Reschedule failed', 'error');
        } finally {
            setRescheduling(false);
        }
    };

    const filtered = appointments.filter(a => {
        if (activeTab === 0) return ['pending', 'confirmed'].includes(a.status);
        if (activeTab === 1) return a.status === 'completed';
        return ['cancelled', 'rejected'].includes(a.status);
    });

    const summary = {
        upcoming: appointments.filter((item) => ['pending', 'confirmed'].includes(item.status)).length,
        completed: appointments.filter((item) => item.status === 'completed').length,
        unpaid: appointments.filter((item) => item.paymentStatus === 'unpaid').length,
    };

    if (authLoading || loading) {
        return <Skeleton type="card" />;
    }

    return (
        <div className="animate-in" style={{ display: 'grid', gap: '22px' }}>
            <section style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 100%)', color: 'white', borderRadius: '24px', padding: '30px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '8px' }}>My appointments</h1>
                        <p style={{ color: 'rgba(255,255,255,0.8)', maxWidth: '720px', lineHeight: 1.7, margin: 0 }}>Review upcoming consultations, pay securely, reschedule when needed, and keep a clean history of completed visits.</p>
                    </div>
                    <Button className="secondary" icon={<ArrowRight size={16} />} onClick={() => window.location.href = '/appointment/search'}>
                        Find a doctor
                    </Button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginTop: '20px' }}>
                    {[
                        { label: 'Upcoming', value: summary.upcoming },
                        { label: 'Completed', value: summary.completed },
                        { label: 'Awaiting payment', value: summary.unpaid },
                    ].map((item) => (
                        <div key={item.label} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '18px', padding: '14px 16px' }}>
                            <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.72 }}>{item.label}</div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 800, marginTop: '6px' }}>{item.value}</div>
                        </div>
                    ))}
                </div>
            </section>

            <Tabs
                tabs={['Upcoming', 'History', 'Cancelled']}
                activeTab={activeTab}
                onChange={setActiveTab}
            />

            <div className="tab-content">
                {filtered.length > 0 ? (
                    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
                        {filtered.map((appt) => (
                            <Card key={appt._id} title={appt.doctorName} icon={<User size={20} />} className="doctor-card" style={{ background: 'white' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                    <Badge text={appt.slotDate} variant="info" />
                                    <Badge text={appt.slotTime} variant="info" />
                                </div>

                                <div style={{ display: 'grid', gap: '10px', marginBottom: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                    <div><strong>Specialty:</strong> {appt.specialty}</div>
                                    <div><strong>Consultation fee:</strong> LKR {(appt.consultationFee || 0).toLocaleString()}</div>
                                </div>

                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                                    <Badge text={appt.status?.toUpperCase()} variant={appt.status === 'confirmed' ? 'low' : appt.status === 'pending' ? 'info' : 'high'} />
                                    <Badge text={(appt.paymentStatus || 'unpaid').toUpperCase()} variant={appt.paymentStatus === 'paid' ? 'low' : 'high'} />
                                </div>

                                <div style={{ background: 'var(--bg-light)', borderRadius: '16px', padding: '14px', marginBottom: '16px', display: 'grid', gap: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                                        <Clock3 size={14} />
                                        {appt.slotDate} at {appt.slotTime}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                                        <CheckCircle2 size={14} />
                                        {appt.status === 'confirmed' ? 'Doctor confirmed' : appt.status === 'pending' ? 'Awaiting confirmation' : appt.status}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--card-border)', paddingTop: '16px', flexWrap: 'wrap', gap: '8px' }}>
                                    <div />
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {appt.paymentStatus === 'unpaid' && ['pending', 'confirmed'].includes(appt.status) && (
                                            <Button size="sm" icon={<CreditCard size={14} />} onClick={() => handlePayment(appt)}>Pay now</Button>
                                        )}
                                        {appt.paymentStatus === 'paid' && (
                                            <>
                                                <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={() => handleDownloadReceipt(appt._id)}>
                                                    Receipt PDF
                                                </Button>
                                                <Button size="sm" variant="secondary" icon={<Mail size={14} />} onClick={() => handleEmailReceipt(appt._id)}>
                                                    Email receipt
                                                </Button>
                                            </>
                                        )}
                                        {['pending', 'confirmed'].includes(appt.status) && (
                                            <>
                                                <Button size="sm" variant="secondary" onClick={() => openReschedule(appt)}>
                                                    Reschedule
                                                </Button>
                                                <Button size="sm" variant="danger" onClick={() => handleCancel(appt._id)}>
                                                    Cancel
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-icon"><CalendarX size={48} /></div>
                        <h3>No appointments found</h3>
                        <p>You have no records in this category at the moment.</p>
                    </div>
                )}
            </div>

            <Modal
                isOpen={showReschedule}
                onClose={() => setShowReschedule(false)}
                title={`Reschedule with Dr. ${rescheduleTarget?.doctorName || ''}`}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CalendarClock size={16} />
                        Current: {rescheduleTarget?.slotDate} at {rescheduleTarget?.slotTime}
                    </div>
                    <Input
                        label="New Date"
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                    />
                    <Input
                        label="New Time"
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                    />
                    <Button onClick={submitReschedule} disabled={rescheduling} style={{ width: '100%' }}>
                        {rescheduling ? 'Rescheduling…' : 'Confirm Reschedule'}
                    </Button>
                </div>
            </Modal>
        </div>
    );
}
