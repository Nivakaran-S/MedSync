'use client';

import React, { useState, useEffect } from 'react';
import { patientApi } from '../../services/api';
import { Card, Button, Input, Skeleton, showToast } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>({
    firstName: '', lastName: '', phone: '',
    dateOfBirth: '', gender: 'Other', address: '',
    bloodType: '', allergies: [], emergencyContact: { name: '', relationship: '', phone: '' }
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const fetchProfile = async () => {
    try {
      const data = await patientApi.getProfile();
      setProfile({
        ...data,
        dateOfBirth: data.dateOfBirth ? data.dateOfBirth.split('T')[0] : '',
        allergies: data.allergies || [],
        emergencyContact: data.emergencyContact || { name: '', relationship: '', phone: '' }
      });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setPhotoFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      // Skip allergies — managed via /patient/health using the structured shape.
      // Posting it from this form would overwrite the schema-correct array
      // with a flattened FormData string.
      Object.keys(profile).forEach(key => {
        if (key === 'allergies') return;
        if (profile[key] !== undefined && profile[key] !== null) {
          formData.append(key, profile[key]);
        }
      });
      if (photoFile) {
        formData.append('photo', photoFile);
      }
      await patientApi.updateProfile(formData);
      showToast('Profile updated successfully!', 'success');
      setPhotoFile(null);
    } catch (error) {
      showToast('Error updating profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-in">
        <Skeleton type="title" />
        <Skeleton type="card" />
        <Skeleton type="card" />
      </div>
    );
  }

  return (
    <div className="animate-in">
      {/* Profile Header */}
      <div className="profile-header">
        <div className="avatar lg">
          {profile.photoUrl ? (
            <img src={profile.photoUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          ) : (
            `${profile.firstName?.[0]?.toUpperCase() || '?'}${profile.lastName?.[0]?.toUpperCase() || '?'}`
          )}
        </div>
        <div className="profile-info">
          <h2>{profile.firstName} {profile.lastName}</h2>
          <p>{user?.email || 'Patient'}</p>
          {profile.bloodType && <p>Blood Type: {profile.bloodType}</p>}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Photo Upload */}
        <Card title="Profile Photo" icon="📷">
          <div className="med-input-group">
            <label className="med-label">Upload Profile Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="med-input"
            />
            {photoFile && <p>Selected: {photoFile.name}</p>}
          </div>
        </Card>

        {/* Personal Information */}
        <Card title="Personal Information" icon="👤">
          <div className="grid-2">
            <Input
              label="First Name"
              value={profile.firstName}
              onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
              required
            />
            <Input
              label="Last Name"
              value={profile.lastName}
              onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
              required
            />
          </div>
          <div className="grid-2">
            <Input
              label="Phone"
              value={profile.phone || ''}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              placeholder="+94 77 123 4567"
            />
            <Input
              label="Date of Birth"
              type="date"
              value={profile.dateOfBirth}
              onChange={(e) => setProfile({ ...profile, dateOfBirth: e.target.value })}
            />
          </div>
          <div className="grid-2">
            <div className="med-input-group">
              <label className="med-label">Gender</label>
              <select
                className="med-input"
                value={profile.gender}
                onChange={(e) => setProfile({ ...profile, gender: e.target.value })}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="med-input-group">
              <label className="med-label">Blood Type</label>
              <select
                className="med-input"
                value={profile.bloodType || ''}
                onChange={(e) => setProfile({ ...profile, bloodType: e.target.value })}
              >
                <option value="">Not specified</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
          </div>
          <Input
            label="Address"
            value={profile.address || ''}
            onChange={(e) => setProfile({ ...profile, address: e.target.value })}
            placeholder="Your residential address"
          />
        </Card>

        {/* Allergies — managed in Health Profile so each entry has substance + severity */}
        <Card title="Allergies" icon="⚠️">
          {profile.allergies.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No allergies on file.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {profile.allergies.map((a: any, i: number) => (
                <div key={a._id || i} style={{ fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <strong>{a.substance || (typeof a === 'string' ? a : '—')}</strong>
                  {a.severity && (
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                      background: ['severe', 'life-threatening'].includes(a.severity) ? '#fee2e2' : '#fef3c7',
                      color: ['severe', 'life-threatening'].includes(a.severity) ? '#991b1b' : '#92400e',
                      textTransform: 'uppercase', letterSpacing: 0.3,
                    }}>
                      {a.severity}
                    </span>
                  )}
                  {a.reaction && <span style={{ color: 'var(--text-secondary)' }}>· {a.reaction}</span>}
                </div>
              ))}
            </div>
          )}
          <p style={{ marginTop: 14, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Allergies are managed in your <a href="/patient/health" style={{ color: '#0ea5e9', fontWeight: 600 }}>Health Profile</a>,
            where you can record substance, severity, and reaction.
          </p>
        </Card>

        {/* Emergency Contact */}
        <Card title="Emergency Contact" icon="🆘">
          <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Input
              label="Contact Name"
              value={profile.emergencyContact?.name || ''}
              onChange={(e) => setProfile({ ...profile, emergencyContact: { ...profile.emergencyContact, name: e.target.value } })}
              placeholder="Full name"
            />
            <Input
              label="Relationship"
              value={profile.emergencyContact?.relationship || ''}
              onChange={(e) => setProfile({ ...profile, emergencyContact: { ...profile.emergencyContact, relationship: e.target.value } })}
              placeholder="e.g., Spouse, Parent"
            />
          </div>
          <Input
            label="Contact Phone"
            value={profile.emergencyContact?.phone || ''}
            onChange={(e) => setProfile({ ...profile, emergencyContact: { ...profile.emergencyContact, phone: e.target.value } })}
            placeholder="+94 77 123 4567"
          />
        </Card>

        <Button type="submit" disabled={saving} icon={saving ? '⏳' : '💾'}>
          {saving ? 'Saving...' : 'Save Profile'}
        </Button>
      </form>
    </div>
  );
}
