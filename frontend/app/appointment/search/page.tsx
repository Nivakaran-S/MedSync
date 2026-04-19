'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { doctorApi } from '@/app/services/api';
import { MedButton as Button, MedInput as Input, showToast, Skeleton, Badge } from '../../components/UI';
import { Search, Stethoscope, ShieldCheck, Filter, RotateCcw, FolderOpen, ArrowRight, Clock3 } from 'lucide-react';

const getAvailabilityCount = (doctor: any) => Array.isArray(doctor?.availability) ? doctor.availability.length : 0;
const getRating = (doctor: any) => Number(doctor?.analytics?.patientSatisfactionScore || 0);

export default function AppointmentSearchPage() {
    const [doctors, setDoctors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [specialty, setSpecialty] = useState('all');
    const [verification, setVerification] = useState('all');
    const [availabilityOnly, setAvailabilityOnly] = useState(false);
    const [minRating, setMinRating] = useState('0');
    const [sortBy, setSortBy] = useState('recommended');

    const fetchDoctors = async () => {
        setLoading(true);
        try {
            const data = await doctorApi.listDoctors();
            setDoctors(Array.isArray(data) ? data : []);
        } catch {
            showToast('Failed to load doctors', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDoctors();
    }, []);

    const specialties = useMemo(() => {
        const values = doctors
            .map((doctor) => doctor?.specialty)
            .filter(Boolean)
            .map((value) => String(value).trim());
        return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
    }, [doctors]);

    const filteredDoctors = useMemo(() => {
        const search = query.trim().toLowerCase();
        const minimumRating = Number(minRating);

        const next = doctors.filter((doctor) => {
            const textMatch = !search || [
                doctor?.name,
                doctor?.specialty,
                doctor?.bio,
                doctor?.contact?.email,
                ...(Array.isArray(doctor?.qualifications) ? doctor.qualifications : []),
            ]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(search));

            const specialtyMatch = specialty === 'all' || String(doctor?.specialty || '').toLowerCase() === specialty.toLowerCase();
            const verificationMatch = verification === 'all' || (verification === 'verified' ? !!doctor?.isVerified : !doctor?.isVerified);
            const availabilityMatch = !availabilityOnly || getAvailabilityCount(doctor) > 0;
            const ratingMatch = getRating(doctor) >= minimumRating;

            return textMatch && specialtyMatch && verificationMatch && availabilityMatch && ratingMatch;
        });

        return next.sort((left, right) => {
            if (sortBy === 'fee-asc') return (left?.consultationFee || 0) - (right?.consultationFee || 0);
            if (sortBy === 'fee-desc') return (right?.consultationFee || 0) - (left?.consultationFee || 0);
            if (sortBy === 'rating') return getRating(right) - getRating(left);
            const scoreLeft = (left?.isVerified ? 2 : 0) + getRating(left) + getAvailabilityCount(left) * 0.15;
            const scoreRight = (right?.isVerified ? 2 : 0) + getRating(right) + getAvailabilityCount(right) * 0.15;
            return scoreRight - scoreLeft;
        });
    }, [doctors, query, specialty, verification, availabilityOnly, minRating, sortBy]);

    const verifiedCount = doctors.filter((doctor) => doctor?.isVerified).length;
    const availableCount = doctors.filter((doctor) => getAvailabilityCount(doctor) > 0).length;
    const averageFee = doctors.length
        ? Math.round(doctors.reduce((sum, doctor) => sum + Number(doctor?.consultationFee || 0), 0) / doctors.length)
        : 0;

    const clearFilters = () => {
        setQuery('');
        setSpecialty('all');
        setVerification('all');
        setAvailabilityOnly(false);
        setMinRating('0');
        setSortBy('recommended');
    };

    return (
        <div className="animate-in" style={{ display: 'grid', gap: '24px' }}>
            <section
                style={{
                    background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 60%, #0ea5e9 100%)',
                    color: 'white',
                    padding: '32px',
                    borderRadius: '24px',
                    boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
                }}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                    <div style={{ maxWidth: '760px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '999px', background: 'rgba(255,255,255,0.12)', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            <Stethoscope size={14} /> Specialist booking
                        </div>
                        <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.25rem)', lineHeight: 1.05, margin: '14px 0 12px', fontWeight: 800 }}>
                            Find the right doctor fast.
                        </h1>
                        <p style={{ fontSize: '1rem', lineHeight: 1.7, maxWidth: '700px', color: 'rgba(255,255,255,0.82)' }}>
                            Search by name, specialty, qualification, rating, verification status, and availability. Book a consultation with a cleaner, faster flow.
                        </p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
                        {[
                            { label: 'Doctors', value: doctors.length },
                            { label: 'Verified', value: verifiedCount },
                            { label: 'Available', value: availableCount },
                            { label: 'Avg. Fee', value: `LKR ${averageFee.toLocaleString()}` },
                        ].map((item) => (
                            <div key={item.label} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '18px', padding: '14px 16px' }}>
                                <div style={{ fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.72, marginBottom: '6px' }}>{item.label}</div>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>{item.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section style={{ background: 'white', borderRadius: '22px', border: '1px solid var(--card-border)', boxShadow: '0 18px 40px rgba(15, 23, 42, 0.06)', padding: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) repeat(5, minmax(0, 1fr)) auto', gap: '12px', alignItems: 'end' }}>
                    <div style={{ gridColumn: 'span 2' }}>
                        <Input
                            label="Search"
                            placeholder="Name, specialty, qualification, or email"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="med-label">Specialty</label>
                        <select className="med-input" value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
                            <option value="all">All specialties</option>
                            {specialties.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="med-label">Status</label>
                        <select className="med-input" value={verification} onChange={(e) => setVerification(e.target.value)}>
                            <option value="all">All doctors</option>
                            <option value="verified">Verified only</option>
                            <option value="unverified">Pending only</option>
                        </select>
                    </div>
                    <div>
                        <label className="med-label">Rating</label>
                        <select className="med-input" value={minRating} onChange={(e) => setMinRating(e.target.value)}>
                            <option value="0">Any</option>
                            <option value="3">3.0+</option>
                            <option value="4">4.0+</option>
                            <option value="4.5">4.5+</option>
                        </select>
                    </div>
                    <div>
                        <label className="med-label">Sort by</label>
                        <select className="med-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                            <option value="recommended">Recommended</option>
                            <option value="rating">Top rating</option>
                            <option value="fee-asc">Fee: low to high</option>
                            <option value="fee-desc">Fee: high to low</option>
                        </select>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <Button variant="secondary" onClick={clearFilters} icon={<RotateCcw size={16} />}>
                            Reset
                        </Button>
                    </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '16px' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)', background: 'var(--bg-light)', borderRadius: '999px', padding: '8px 12px' }}>
                        <input type="checkbox" checked={availabilityOnly} onChange={(e) => setAvailabilityOnly(e.target.checked)} />
                        Show only doctors with availability
                    </label>
                    {specialties.slice(0, 4).map((item) => (
                        <button
                            key={item}
                            type="button"
                            onClick={() => setSpecialty(item)}
                            style={{ border: '1px solid var(--card-border)', background: specialty === item ? 'var(--primary-light)' : 'white', color: specialty === item ? 'var(--primary)' : 'var(--text-secondary)', borderRadius: '999px', padding: '8px 12px', fontSize: '0.84rem', fontWeight: 600, cursor: 'pointer' }}
                        >
                            {item}
                        </button>
                    ))}
                </div>
            </section>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '4px' }}>Available specialists</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{filteredDoctors.length} result{filteredDoctors.length === 1 ? '' : 's'} match your filters.</p>
                </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                {loading ? (
                    [1, 2, 3, 4].map((item) => <Skeleton key={item} type="card" />)
                ) : filteredDoctors.length > 0 ? (
                    filteredDoctors.map((doctor) => {
                        const availability = Array.isArray(doctor?.availability) ? doctor.availability : [];
                        const nextAvailability = availability.slice(0, 2).map((slot: any) => `${slot.day} · ${slot.startTime}-${slot.endTime}`);

                        return (
                            <article key={doctor._id} style={{ background: 'white', border: '1px solid var(--card-border)', borderRadius: '22px', padding: '22px', boxShadow: '0 16px 32px rgba(15, 23, 42, 0.05)', display: 'grid', gap: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px' }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                            <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'linear-gradient(135deg, #0f172a, #2563eb)', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 800 }}>
                                                {String(doctor?.name || 'D').charAt(0)}
                                            </div>
                                            <div style={{ minWidth: 0 }}>
                                                <h3 style={{ fontSize: '1.08rem', fontWeight: 800, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doctor.name}</h3>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                                                    <Badge text={doctor.specialty} variant="info" />
                                                    {doctor.isVerified ? <Badge text="Verified" variant="low" /> : <Badge text="Pending" variant="medium" />}
                                                </div>
                                            </div>
                                        </div>

                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: 1.65, margin: 0 }}>
                                            {doctor.bio || 'Experienced specialist focused on patient-centered care and clear follow-up.'}
                                        </p>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
                                    <div style={{ background: 'var(--bg-light)', borderRadius: '14px', padding: '12px' }}>
                                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Fee</div>
                                        <div style={{ fontWeight: 800, marginTop: '4px' }}>LKR {(doctor.consultationFee || 0).toLocaleString()}</div>
                                    </div>
                                    <div style={{ background: 'var(--bg-light)', borderRadius: '14px', padding: '12px' }}>
                                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Rating</div>
                                        <div style={{ fontWeight: 800, marginTop: '4px' }}>{(doctor.analytics?.patientSatisfactionScore || 0).toFixed(1)} / 5</div>
                                    </div>
                                    <div style={{ background: 'var(--bg-light)', borderRadius: '14px', padding: '12px' }}>
                                        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>Slots</div>
                                        <div style={{ fontWeight: 800, marginTop: '4px' }}>{availability.length ? `${availability.length} available` : 'No slots listed'}</div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {nextAvailability.length > 0 ? nextAvailability.map((slot: string) => (
                                        <span key={slot} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'var(--bg-light)', borderRadius: '999px', padding: '8px 10px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                            <Clock3 size={14} /> {slot}
                                        </span>
                                    )) : (
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(148,163,184,0.12)', borderRadius: '999px', padding: '8px 10px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                            <Clock3 size={14} /> Availability not published
                                        </span>
                                    )}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderTop: '1px solid var(--card-border)', paddingTop: '16px', flexWrap: 'wrap' }}>
                                    <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <ShieldCheck size={14} /> {doctor.isVerified ? 'Clinically verified' : 'Verification pending'}
                                    </div>
                                    <Link href={`/appointment/book/${doctor._id}`}>
                                        <Button size="sm" className="turquoise" icon={<ArrowRight size={16} />}>
                                            Book consultation
                                        </Button>
                                    </Link>
                                </div>
                            </article>
                        );
                    })
                ) : (
                    <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                        <div className="empty-icon text-turquoise"><FolderOpen size={48} /></div>
                        <h3 className="text-navy">No doctors match these filters</h3>
                        <p>Try widening the specialty, lowering the rating threshold, or showing all doctors.</p>
                        <Button variant="secondary" onClick={clearFilters} style={{ marginTop: '16px' }}>
                            Clear filters
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
