'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { appointmentApi } from '../../services/api';
import { ShieldBan, Calendar, User, Clock, Search, RefreshCcw, Filter } from 'lucide-react';
import { Badge, Skeleton, showToast, Modal } from '../../components/UI';

export default function AdminAppointmentsPage() {
    const { user, isLoading: authLoading } = useAuth();
    const [appointments, setAppointments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    useEffect(() => {
        if (user?.role === 'admin') {
            loadAppointments();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, statusFilter]);

    const loadAppointments = async () => {
        try {
            setLoading(true);
            const data = await appointmentApi.listAllAppointments(
                statusFilter === 'all' ? undefined : statusFilter
            );
            setAppointments(Array.isArray(data) ? data : []);
        } catch (err) {
            showToast('Failed to load system appointments', 'error');
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
                <p>You do not have permission to view system-wide appointments.</p>
            </div>
        );
    }

    const filteredAppointments = appointments.filter(appt => {
        const matchesSearch = 
            appt.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            appt.doctorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            appt._id?.includes(searchTerm);
        
        const matchesStatus = statusFilter === 'all' || appt.status === statusFilter;
        
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="animate-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 className="page-title">System Appointments</h1>
                    <p className="page-subtitle">Monitor and oversee all medical consultations across the MedSync platform.</p>
                </div>
                <button className="med-button secondary" onClick={loadAppointments}>
                    <RefreshCcw size={16} /> Refresh Data
                </button>
            </div>

            <div className="grid" style={{ gridTemplateColumns: '1fr 300px', gap: '20px', marginBottom: '24px' }}>
                <div className="med-card" style={{ marginBottom: 0, padding: '12px 16px' }}>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                        <input 
                            type="text" 
                            placeholder="Find by patient, doctor or ID..." 
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
                        style={{ border: 'none', marginBottom: 0, padding: '4px', cursor: 'pointer' }}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Statuses</option>
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </div>

            <div className="med-card" style={{ padding: 0, overflowX: 'auto' }}>
                {loading ? (
                    <div style={{ padding: '60px' }}><Skeleton type="text" /></div>
                ) : filteredAppointments.length === 0 ? (
                    <div className="empty-state" style={{ padding: '80px' }}>
                        <div className="empty-icon"><Calendar size={48} /></div>
                        <h3>No appointments matching criteria</h3>
                        <p>Adjust your filters or search terms to find specific records.</p>
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: 'var(--bg-main)' }}>
                            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--card-border)' }}>
                                <th style={{ padding: '16px', fontWeight: 600, fontSize: '0.85rem' }}>Appointment Details</th>
                                <th style={{ padding: '16px', fontWeight: 600, fontSize: '0.85rem' }}>Provider & Patient</th>
                                <th style={{ padding: '16px', fontWeight: 600, fontSize: '0.85rem' }}>Status</th>
                                <th style={{ padding: '16px', fontWeight: 600, fontSize: '0.85rem' }}>Payment</th>
                                <th style={{ padding: '16px', fontWeight: 600, fontSize: '0.85rem', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredAppointments.map((appt) => (
                                <tr key={appt._id} style={{ borderBottom: '1px solid var(--card-border)' }}>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                            {new Date(appt.slotDate).toLocaleDateString()}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                            <Clock size={12} /> {appt.slotTime}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>ID: {appt._id}</div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Dr.</span> {appt.doctorName}
                                            </div>
                                            <div style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                                                <User size={14} /> {appt.patientName}
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <Badge 
                                            text={appt.status.toUpperCase()} 
                                            variant={appt.status === 'confirmed' ? 'low' : appt.status === 'pending' ? 'info' : appt.status === 'completed' ? 'low' : 'high'} 
                                        />
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <Badge 
                                            text={appt.paymentStatus?.toUpperCase() || 'UNPAID'} 
                                            variant={appt.paymentStatus === 'paid' ? 'low' : 'high'} 
                                        />
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, marginTop: '4px' }}>LKR {appt.consultationFee}</div>
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right' }}>
                                        <button 
                                            className="med-button sm secondary"
                                            onClick={() => {
                                                setSelectedAppointment(appt);
                                                setShowDetailsModal(true);
                                            }}
                                        >
                                            View Details
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <Modal isOpen={showDetailsModal} onClose={() => setShowDetailsModal(false)} title="Appointment Details">
                {selectedAppointment && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div style={{ background: 'var(--bg-light)', padding: '16px', borderRadius: '12px' }}>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Patient Information</h4>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{selectedAppointment.patientName}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{selectedAppointment.patientEmail}</div>
                                {selectedAppointment.patientPhone && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{selectedAppointment.patientPhone}</div>}
                            </div>
                            <div style={{ background: 'var(--bg-light)', padding: '16px', borderRadius: '12px' }}>
                                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Provider Information</h4>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>Dr. {selectedAppointment.doctorName}</div>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{selectedAppointment.specialty || 'General'}</div>
                            </div>
                        </div>

                        <div style={{ border: '1px solid var(--card-border)', padding: '16px', borderRadius: '12px' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Scheduling</h4>
                            <div style={{ display: 'flex', gap: '24px' }}>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Date</div>
                                    <div style={{ fontWeight: 600 }}>{new Date(selectedAppointment.slotDate).toLocaleDateString()}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Time</div>
                                    <div style={{ fontWeight: 600 }}>{selectedAppointment.slotTime}</div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Status & Financials</h4>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <div>
                                    <Badge 
                                        text={selectedAppointment.status.toUpperCase()} 
                                        variant={selectedAppointment.status === 'confirmed' ? 'low' : selectedAppointment.status === 'pending' ? 'info' : selectedAppointment.status === 'completed' ? 'low' : 'high'} 
                                    />
                                </div>
                                <div>
                                    <Badge 
                                        text={selectedAppointment.paymentStatus?.toUpperCase() || 'UNPAID'} 
                                        variant={selectedAppointment.paymentStatus === 'paid' ? 'low' : 'high'} 
                                    />
                                </div>
                                <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginLeft: 'auto' }}>
                                    LKR {selectedAppointment.consultationFee}
                                </div>
                            </div>
                        </div>

                        {selectedAppointment.reason && (
                            <div>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Reason for Visit</h4>
                                <div style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{selectedAppointment.reason}</div>
                            </div>
                        )}
                        
                        {selectedAppointment.notes && (
                            <div>
                                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Additional Notes / Cancellation Reason</h4>
                                <div style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{selectedAppointment.notes}</div>
                            </div>
                        )}
                        
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--card-border)' }}>
                            <strong>Appointment ID:</strong> {selectedAppointment._id} <br/>
                            <strong>Created At:</strong> {new Date(selectedAppointment.createdAt).toLocaleString()}
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}
