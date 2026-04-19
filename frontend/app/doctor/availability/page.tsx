'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { doctorApi } from '../../services/api';
import { MedCard as Card, MedInput as Input, MedButton as Button, showToast, Modal } from '../../components/UI';

export default function AvailabilityPage() {
  const { user, isLoading } = useAuth();
  const [availability, setAvailability] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [newSlot, setNewSlot] = useState({
    day: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
  });
  const [bulkDays, setBulkDays] = useState<string[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  const [bulkStart, setBulkStart] = useState('09:00');
  const [bulkEnd, setBulkEnd] = useState('17:00');
  const [bulkDuration, setBulkDuration] = useState(60);
  const [editSlot, setEditSlot] = useState({
    day: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
  });

  useEffect(() => {
    if (user?.role === 'doctor') {
      loadAvailability();
    }
  }, [user]);

  const loadAvailability = async () => {
    try {
      setLoading(true);
      const data = await doctorApi.getAvailability(user!.id);
      setAvailability(data || []);
    } catch (err) {
      console.error(err);
      showToast('Failed to load availability', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSlot = async () => {
    try {
      await doctorApi.addAvailability(user!.id, newSlot);
      showToast('Availability slot added!', 'success');
      setShowAddModal(false);
      loadAvailability();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add slot';
      showToast(message, 'error');
    }
  };

  const minutesToTime = (mins: number) => {
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const timeToMinutes = (time: string) => {
    const [hh, mm] = time.split(':').map(Number);
    return (hh * 60) + mm;
  };

  const toggleBulkDay = (day: string) => {
    setBulkDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  };

  const handleBulkCreate = async () => {
    if (bulkDays.length === 0) {
      showToast('Select at least one day', 'warning');
      return;
    }
    const start = timeToMinutes(bulkStart);
    const end = timeToMinutes(bulkEnd);
    if (start >= end) {
      showToast('Start time must be before end time', 'warning');
      return;
    }
    if (bulkDuration < 15) {
      showToast('Slot duration must be at least 15 minutes', 'warning');
      return;
    }

    const slots: Array<{ startTime: string; endTime: string }> = [];
    for (let t = start; t + bulkDuration <= end; t += bulkDuration) {
      slots.push({ startTime: minutesToTime(t), endTime: minutesToTime(t + bulkDuration) });
    }

    if (slots.length === 0) {
      showToast('No slots can be created with this time range', 'warning');
      return;
    }

    try {
      const result = await doctorApi.addAvailabilityBulk(user!.id, { days: bulkDays, slots });
      showToast(`Weekly plan saved. Created ${result.created}, skipped ${result.skipped}.`, 'success');
      loadAvailability();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create weekly slots';
      showToast(message, 'error');
    }
  };

  const openEdit = (slot: any) => {
    setEditingSlotId(slot._id);
    setEditSlot({ day: slot.day, startTime: slot.startTime, endTime: slot.endTime });
    setShowEditModal(true);
  };

  const handleUpdateSlot = async () => {
    if (!editingSlotId) return;
    try {
      await doctorApi.updateAvailability(user!.id, editingSlotId, editSlot);
      showToast('Slot updated', 'success');
      setShowEditModal(false);
      setEditingSlotId(null);
      loadAvailability();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update slot';
      showToast(message, 'error');
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Are you sure you want to delete this slot?')) return;
    try {
      await doctorApi.deleteAvailability(user!.id, slotId);
      showToast('Slot removed', 'info');
      loadAvailability();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove slot';
      showToast(message, 'error');
    }
  };

  if (isLoading || loading) return <div style={{ padding: '20px' }}>Loading...</div>;
  if (user?.role !== 'doctor') return <div style={{ padding: '20px' }}>Access Denied</div>;

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="animate-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title">My Schedule</h1>
          <p className="page-subtitle">One slot = one patient. Create a weekly pattern once, and it repeats every week.</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} icon="+" variant="primary">
          Add New Slot
        </Button>
      </div>

      <div className="med-card" style={{ marginBottom: '16px' }}>
        <h3 style={{ marginBottom: '8px' }}>Quick Weekly Slot Builder</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '14px' }}>
          Select weekdays and a time window. The system creates repeating weekly slots automatically.
        </p>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {days.map((day) => (
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
                padding: '8px 12px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>

        <div className="grid-2" style={{ gap: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <Input label="Window Start" type="time" value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} />
          <Input label="Window End" type="time" value={bulkEnd} onChange={(e) => setBulkEnd(e.target.value)} />
          <Input
            label="Slot Duration (minutes)"
            type="number"
            value={String(bulkDuration)}
            onChange={(e) => setBulkDuration(parseInt(e.target.value, 10) || 60)}
          />
        </div>

        <Button onClick={handleBulkCreate} style={{ marginTop: '12px' }}>
          Generate Weekly Slots
        </Button>
      </div>

      <div className="med-card">
        {availability.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <h3>No availability slots defined</h3>
            <p>Add your first weekly slot to start receiving appointments.</p>
            <Button onClick={() => setShowAddModal(true)} style={{ marginTop: '16px' }}>Define Availability</Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {days.map(day => {
              const daySlots = availability.filter(s => s.day === day);
              if (daySlots.length === 0) return null;
              
              return (
                <div key={day} style={{ marginBottom: '16px' }}>
                  <h4 style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '8px', marginBottom: '12px', color: 'var(--navy)' }}>
                    {day}
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                    {daySlots.map(slot => (
                      <div key={slot._id} className="history-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{slot.startTime} - {slot.endTime}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Capacity: 1 patient per slot
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="med-button secondary sm"
                            onClick={() => openEdit(slot)}
                            style={{ minWidth: 'auto', padding: '6px 10px' }}
                          >
                            Edit
                          </button>
                          <button
                            className="med-button danger sm"
                            onClick={() => handleDeleteSlot(slot._id)}
                            style={{ minWidth: 'auto', padding: '6px 10px' }}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Availability Slot">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="med-input-group">
            <label className="med-label">Day of Week</label>
            <select 
              className="med-input" 
              value={newSlot.day} 
              onChange={(e) => setNewSlot({ ...newSlot, day: e.target.value })}
            >
              {days.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          
          <div className="grid-2">
            <Input 
              label="Start Time" 
              type="time" 
              value={newSlot.startTime} 
              onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })} 
            />
            <Input 
              label="End Time" 
              type="time" 
              value={newSlot.endTime} 
              onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })} 
            />
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Each saved slot accepts one patient only.
          </div>

          <Button onClick={handleAddSlot} style={{ width: '100%', marginTop: '12px' }}>
            Save Availability Slot
          </Button>
        </div>
      </Modal>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Availability Slot">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="med-input-group">
            <label className="med-label">Day of Week</label>
            <select
              className="med-input"
              value={editSlot.day}
              onChange={(e) => setEditSlot({ ...editSlot, day: e.target.value })}
            >
              {days.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="grid-2">
            <Input
              label="Start Time"
              type="time"
              value={editSlot.startTime}
              onChange={(e) => setEditSlot({ ...editSlot, startTime: e.target.value })}
            />
            <Input
              label="End Time"
              type="time"
              value={editSlot.endTime}
              onChange={(e) => setEditSlot({ ...editSlot, endTime: e.target.value })}
            />
          </div>

          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Note: booked or confirmed slots are locked and cannot be changed.
          </div>

          <Button onClick={handleUpdateSlot} style={{ width: '100%', marginTop: '12px' }}>
            Update Slot
          </Button>
        </div>
      </Modal>
    </div>
  );
}
