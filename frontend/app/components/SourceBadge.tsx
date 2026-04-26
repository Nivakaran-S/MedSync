'use client';

import React from 'react';

interface Props {
  source?: string;
  by?: string;
}

export default function SourceBadge({ source, by }: Props) {
  const s = (source || 'self').toLowerCase();
  const styles: Record<string, { bg: string; fg: string; label: string }> = {
    self:   { bg: '#fef3c7', fg: '#92400e', label: 'Self-reported' },
    doctor: { bg: '#dbeafe', fg: '#1e40af', label: 'Doctor' },
    admin:  { bg: '#ede9fe', fg: '#5b21b6', label: 'Admin' },
  };
  const c = styles[s] || styles.self;
  return (
    <span
      title={by ? `Entered by ${by}` : c.label}
      style={{
        display: 'inline-block',
        fontSize: '0.7rem',
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        marginLeft: 8,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
      }}
    >
      {c.label}
    </span>
  );
}
