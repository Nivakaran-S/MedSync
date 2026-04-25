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
  const [allergyInput, setAllergyInput] = useState('');
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
      Object.keys(profile).forEach(key => {
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

  const addAllergy = () => {
    if (allergyInput.trim()) {
      setProfile({ ...profile, allergies: [...profile.allergies, allergyInput.trim()] });
      setAllergyInput('');
    }
  };

  const removeAllergy = (index: number) => {
    setProfile({ ...profile, allergies: profile.allergies.filter((_: any, i: number) => i !== index) });
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

        {/* Allergies */}
        <Card title="Allergies" icon="⚠️">
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <input
              className="med-input"
              value={allergyInput}
              onChange={(e) => setAllergyInput(e.target.value)}
              placeholder="Enter an allergy (e.g., Penicillin)"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAllergy(); } }}
            />
            <Button onClick={addAllergy} variant="secondary">Add</Button>
          </div>
          <div className="chips-container">
            {profile.allergies.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No allergies recorded</p>
            ) : (
              profile.allergies.map((allergy: string, i: number) => (
                <span
                  key={i}
                  className="symptom-chip selected"
                  onClick={() => removeAllergy(i)}
                  style={{ cursor: 'pointer' }}
                  title="Click to remove"
                >
                  {allergy} ✕
                </span>
              ))
            )}
          </div>
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
