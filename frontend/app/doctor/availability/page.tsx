'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { doctorApi, appointmentApi } from '../../services/api';
import { MedCard as Card, MedInput as Input, MedButton as Button, showToast, Modal } from '../../components/UI';
import { Plus, Trash2, Edit2, Lock, RefreshCcw, Info } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const minutesToTime = (mins: number) => {
  const hh = String(Math.floor(mins / 60)).padStart(2, '0');
  const mm = String(mins % 60).padStart(2, '0');
  return `${hh}:${mm}`;
};

const timeToMinutes = (t: string) => {
  const [hh, mm] = t.split(':').map(Number);
  return hh * 60 + mm;
};

// Build the next-7-dates day-of-week set so we can check if a slot has bookings
const getNextDaysForDow = (dowName: string, numWeeks = 8): string[] => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const targetDow = days.indexOf(dowName);
  if (targetDow === -1) return [];
  const dates: string[] = [];
  const now = new Date();
  for (let w = 0; w < numWeeks; w++) {
    const d = new Date(now);
    d.setDate(now.getDate() + ((targetDow - now.getDay() + 7) % 7) + w * 7);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

export default function AvailabilityPage() {
  const { user, isLoading } = useAuth();
  const [availability, setAvailability] = useState<any[]>([]);
  const [bookedSlotKeys, setBookedSlotKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Add-slot modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSlot, setNewSlot] = useState({ day: 'Monday', startTime: '09:00', endTime: '10:00' });

  // Edit-slot modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<any>(null);
  const [editSlot, setEditSlot] = useState({ day: 'Monday', startTime: '09:00', endTime: '10:00' });

  // Weekly builder
  const [bulkDays, setBulkDays] = useState<string[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [bulkStart, setBulkStart] = useState('09:00');
  const [bulkEnd, setBulkEnd] = useState('17:00');
  const [bulkDuration, setBulkDuration] = useState(60);

  useEffect(() => {
    if (user?.role === 'doctor') {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [avail] = await Promise.all([
        doctorApi.getAvailability(user!.id),
      ]);
      setAvailability(avail || []);
      // Load booked slots to lock them in UI
      await loadBookedSlots(avail || []);
    } catch (err) {
      showToast('Failed to load schedule', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadBookedSlots = async (slots: any[]) => {
    // For each unique (day, startTime-endTime), check if booked in the next 8 weeks
    const bookedKeys = new Set<string>();
    const uniqueDays = [...new Set(slots.map((s: any) => s.day))];
    await Promise.all(
      uniqueDays.map(async (day) => {
        const dates = getNextDaysForDow(day);
        await Promise.all(
          dates.map(async (date) => {
            try {
              const booked = await appointmentApi.getBookedSlots(user!.id, date);
              booked.forEach((b: any) => {
                // slotTime format: "09:00 - 10:00"
                bookedKeys.add(`${day}::${b.slotTime}`);
              });
            } catch {
              // Ignore errors per-date
            }
          })
        );
      })
    );
    setBookedSlotKeys(bookedKeys);
  };

  const isSlotBooked = (slot: any) => {
    const slotKey = `${slot.day}::${slot.startTime} - ${slot.endTime}`;
    return bookedSlotKeys.has(slotKey);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAddSlot = async () => {
    if (timeToMinutes(newSlot.startTime) >= timeToMinutes(newSlot.endTime)) {
      showToast('Start time must be before end time', 'warning');
      return;
    }
    try {
      await doctorApi.addAvailability(user!.id, newSlot);
      showToast('Slot added!', 'success');
      setShowAddModal(false);
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to add slot', 'error');
    }
  };

  const toggleBulkDay = (day: string) => {
    setBulkDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const handleBulkCreate = async () => {
    if (bulkDays.length === 0) { showToast('Select at least one day', 'warning'); return; }
    const start = timeToMinutes(bulkStart);
    const end = timeToMinutes(bulkEnd);
    if (start >= end) { showToast('Start must be before end', 'warning'); return; }
    if (bulkDuration < 15) { showToast('Duration must be at least 15 min', 'warning'); return; }

    const slots: Array<{ startTime: string; endTime: string }> = [];
    for (let t = start; t + bulkDuration <= end; t += bulkDuration) {
      slots.push({ startTime: minutesToTime(t), endTime: minutesToTime(t + bulkDuration) });
    }
    if (slots.length === 0) { showToast('No slots fit in that time range', 'warning'); return; }

    try {
      const result = await doctorApi.addAvailabilityBulk(user!.id, { days: bulkDays, slots });
      showToast(`Weekly schedule saved — ${result.created} new, ${result.skipped} skipped.`, 'success');
      loadData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create weekly slots', 'error');
    }
  };

  const openEdit = (slot: any) => {
    if (isSlotBooked(slot)) {
      showToast('This slot is already booked and cannot be edited.', 'warning');
      return;
    }
    setEditingSlot(slot);
    setEditSlot({ day: slot.day, startTime: slot.startTime, endTime: slot.endTime });
    setShowEditModal(true);
  };

  const handleUpdateSlot = async () => {
    if (!editingSlot) return;
    if (timeToMinutes(editSlot.startTime) >= timeToMinutes(editSlot.endTime)) {
      showToast('Start time must be before end time', 'warning');
      return;
    }
    try {
      await doctorApi.updateAvailability(user!.id, editingSlot._id, editSlot);
      showToast('Slot updated', 'success');
      setShowEditModal(false);
      setEditingSlot(null);
      loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update slot';
      showToast(msg.includes('booked') ? 'Cannot edit — this slot has active bookings.' : msg, 'error');
    }
  };

  const handleDeleteSlot = async (slot: any) => {
    if (isSlotBooked(slot)) {
      showToast('Cannot delete — this slot has active bookings.', 'error');
      return;
    }
    if (!confirm(`Delete ${slot.day} ${slot.startTime}–${slot.endTime}?`)) return;
    try {
      await doctorApi.deleteAvailability(user!.id, slot._id);
      showToast('Slot removed', 'info');
      loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to remove slot';
      showToast(msg.includes('booked') ? 'Cannot delete — this slot has active bookings.' : msg, 'error');
    }
  };

  // ── Preview of generated slots ────────────────────────────────────────────
  const bulkPreview = useMemo(() => {
    const start = timeToMinutes(bulkStart);
    const end = timeToMinutes(bulkEnd);
    if (start >= end || bulkDuration < 15) return [];
    const arr: string[] = [];
    for (let t = start; t + bulkDuration <= end; t += bulkDuration) {
      arr.push(`${minutesToTime(t)} – ${minutesToTime(t + bulkDuration)}`);
    }
    return arr;
  }, [bulkStart, bulkEnd, bulkDuration]);

  if (isLoading || loading) return <div style={{ padding: '20px' }}>Loading schedule…</div>;
  if (user?.role !== 'doctor') return <div style={{ padding: '20px' }}>Access Denied</div>;

  const slotsByDay = DAYS.map(day => ({
    day,
    slots: availability.filter((s: any) => s.day === day),
  }));

  const totalSlots = availability.length;
  const bookedCount = availability.filter(isSlotBooked).length;
  const freeCount = totalSlots - bookedCount;

  return (
    <div className="animate-in">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">My Weekly Schedule</h1>
          <p className="page-subtitle">Slots repeat every week. Each slot accepts exactly 1 patient. Booked slots are locked.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="med-button secondary" onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <RefreshCcw size={16} /> Refresh
          </button>
          <button className="med-button primary" onClick={() => setShowAddModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} /> Add Slot
          </button>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────── */}
      <div className="stats-bar" style={{ marginBottom: '24px' }}>
        <div className="stat-item">
          <div className="stat-value">{totalSlots}</div>
          <div className="stat-label">Total Slots</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ color: '#dc2626' }}>{bookedCount}</div>
          <div className="stat-label">Booked (Locked)</div>
        </div>
        <div className="stat-item">
          <div className="stat-value" style={{ color: '#16a34a' }}>{freeCount}</div>
          <div className="stat-label">Open</div>
        </div>
        <div className="stat-item">
          <div className="stat-value">{DAYS.filter(d => slotsByDay.find(sd => sd.day === d)!.slots.length > 0).length}</div>
          <div className="stat-label">Active Days</div>
        </div>
      </div>

      {/* ── Weekly Bulk Builder ────────────────────────────────────────── */}
      <div className="med-card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ margin: 0, fontWeight: 700 }}>Weekly Slot Builder</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Pick days + a time window + slot duration to auto-generate a repeating weekly schedule.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', background: '#f0f9ff', padding: '6px 12px', borderRadius: '999px' }}>
            <Info size={14} /> Existing duplicate slots are skipped automatically
          </div>
        </div>

        {/* Day picker */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {DAYS.map((day, i) => (
            <button
              key={day}
              type="button"
              onClick={() => toggleBulkDay(day)}
              style={{
                border: '1px solid',
                borderColor: bulkDays.includes(day) ? 'var(--primary)' : 'var(--card-border)',
                background: bulkDays.includes(day) ? 'var(--primary-light)' : 'white',
                color: bulkDays.includes(day) ? 'var(--primary)' : 'var(--text-secondary)',
                borderRadius: '999px',
                padding: '8px 16px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '0.85rem',
              }}
            >
              {DAY_SHORT[i]}
            </button>
          ))}
        </div>

        {/* Time config */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <Input label="Window Start" type="time" value={bulkStart} onChange={e => setBulkStart(e.target.value)} />
          <Input label="Window End" type="time" value={bulkEnd} onChange={e => setBulkEnd(e.target.value)} />
          <Input
            label="Slot Duration (min)"
            type="number"
            value={String(bulkDuration)}
            onChange={e => setBulkDuration(parseInt(e.target.value, 10) || 60)}
          />
        </div>

        {/* Preview */}
        {bulkPreview.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Preview — {bulkPreview.length} slots × {bulkDays.length} day{bulkDays.length !== 1 ? 's' : ''} = {bulkPreview.length * bulkDays.length} total (duplicates skipped)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {bulkPreview.map(s => (
                <span key={s} style={{ padding: '4px 10px', borderRadius: '999px', background: '#e0f2fe', color: '#0369a1', fontSize: '0.8rem', fontWeight: 600 }}>{s}</span>
              ))}
            </div>
          </div>
        )}

        <button className="med-button primary" onClick={handleBulkCreate} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} /> Generate Weekly Schedule
        </button>
      </div>

      {/* ── Slot Grid by Day ────────────────────────────────────────── */}
      {totalSlots === 0 ? (
        <div className="med-card empty-state" style={{ padding: '60px' }}>
          <div className="empty-icon">📅</div>
          <h3>No availability slots defined</h3>
          <p>Use the Weekly Builder above or click "Add Slot" to set up your first slot.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {slotsByDay.filter(sd => sd.slots.length > 0).map(({ day, slots }) => (
            <div key={day} className="med-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h4 style={{ margin: 0, fontWeight: 700, fontSize: '1rem', color: 'var(--navy)' }}>{day}</h4>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {slots.filter(isSlotBooked).length} booked / {slots.length} total
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
                {slots.map((slot: any) => {
                  const booked = isSlotBooked(slot);
                  return (
                    <div
                      key={slot._id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '14px 16px',
                        borderRadius: '14px',
                        border: `1px solid ${booked ? '#fecaca' : 'var(--card-border)'}`,
                        background: booked ? '#fff5f5' : 'white',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {booked && <Lock size={13} color="#dc2626" />}
                          {slot.startTime} – {slot.endTime}
                        </div>
                        <div style={{ fontSize: '0.78rem', marginTop: '3px', color: booked ? '#dc2626' : 'var(--text-muted)', fontWeight: booked ? 600 : 400 }}>
                          {booked ? 'Patient booked · cannot edit' : '1 patient · available'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => openEdit(slot)}
                          disabled={booked}
                          title={booked ? 'Slot is booked — cannot edit' : 'Edit slot'}
                          style={{
                            border: 'none', background: 'transparent', cursor: booked ? 'not-allowed' : 'pointer',
                            color: booked ? '#d1d5db' : 'var(--text-secondary)',
                            padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => { if (!booked) (e.currentTarget as any).style.background = '#f1f5f9'; }}
                          onMouseLeave={e => { (e.currentTarget as any).style.background = 'transparent'; }}
                        >
                          {booked ? <Lock size={15} /> : <Edit2 size={15} />}
                        </button>
                        <button
                          onClick={() => handleDeleteSlot(slot)}
                          disabled={booked}
                          title={booked ? 'Slot is booked — cannot delete' : 'Delete slot'}
                          style={{
                            border: 'none', background: 'transparent', cursor: booked ? 'not-allowed' : 'pointer',
                            color: booked ? '#d1d5db' : '#ef4444',
                            padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => { if (!booked) (e.currentTarget as any).style.background = '#fef2f2'; }}
                          onMouseLeave={e => { (e.currentTarget as any).style.background = 'transparent'; }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Slot Modal ─────────────────────────────────────────── */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Availability Slot">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="med-input-group">
            <label className="med-label">Day of Week</label>
            <select
              className="med-input"
              value={newSlot.day}
              onChange={e => setNewSlot({ ...newSlot, day: e.target.value })}
            >
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input label="Start Time" type="time" value={newSlot.startTime} onChange={e => setNewSlot({ ...newSlot, startTime: e.target.value })} />
            <Input label="End Time" type="time" value={newSlot.endTime} onChange={e => setNewSlot({ ...newSlot, endTime: e.target.value })} />
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', background: '#f0f9ff', padding: '10px 12px', borderRadius: '8px' }}>
            Each slot accepts 1 patient only. Patients see this as a bookable time slot every week.
          </div>
          <button className="med-button primary" onClick={handleAddSlot} style={{ width: '100%' }}>Save Slot</button>
        </div>
      </Modal>

      {/* ── Edit Slot Modal ────────────────────────────────────────── */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Availability Slot">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="med-input-group">
            <label className="med-label">Day of Week</label>
            <select
              className="med-input"
              value={editSlot.day}
              onChange={e => setEditSlot({ ...editSlot, day: e.target.value })}
            >
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input label="Start Time" type="time" value={editSlot.startTime} onChange={e => setEditSlot({ ...editSlot, startTime: e.target.value })} />
            <Input label="End Time" type="time" value={editSlot.endTime} onChange={e => setEditSlot({ ...editSlot, endTime: e.target.value })} />
          </div>
          <div style={{ fontSize: '0.85rem', color: '#ea580c', background: '#fff7ed', padding: '10px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={14} /> Booked slots are automatically locked. The server will reject edits for booked slots.
          </div>
          <button className="med-button primary" onClick={handleUpdateSlot} style={{ width: '100%' }}>Update Slot</button>
        </div>
      </Modal>
    </div>
  );
}
