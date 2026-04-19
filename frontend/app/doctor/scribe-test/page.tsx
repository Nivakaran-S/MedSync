'use client';

import React from 'react';
import AIVoiceScribe from '../../components/AIVoiceScribe';
import { Bot, Shield, Mic } from 'lucide-react';

export default function ScribeTestPage() {
  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '10px', borderRadius: '50%' }}>
          <Bot size={28} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.8rem' }}>AI Scribe Diagnostic Tool</h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Test your voice recognition setup here independently.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
        <div className="med-card" style={{ padding: '20px' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Shield size={18} color="var(--success)" /> 1. Security Check
          </h4>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Voice recognition requires <strong>localhost</strong> or <strong>HTTPS</strong>. 
            If you see an error in the Scribe, ensure your URL starts with `https://`.
          </p>
        </div>
        <div className="med-card" style={{ padding: '20px' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Mic size={18} color="var(--primary)" /> 2. Hardware Check
          </h4>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Ensure no other apps (like Jitsi or Zoom) are "locking" your microphone while you test this.
          </p>
        </div>
      </div>

      <div style={{ height: '600px', border: '1px solid var(--card-border)', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-lg)' }}>
        <AIVoiceScribe />
      </div>

      <div style={{ marginTop: '24px', padding: '16px', background: '#f8fafc', borderRadius: '12px', fontSize: '0.85rem', color: '#64748b' }}>
        <strong>How to test:</strong> Click "Listen" in the scribe. Speak a few sentences. 
        If words appear instantly, your setup is correct. If the scribe stays "Listening..." but shows no text, 
        your browser is likely blocking the Web Speech Service or you are on an insecure IP.
      </div>
    </div>
  );
}
