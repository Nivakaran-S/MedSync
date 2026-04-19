'use client';

import React, { useState, useEffect } from 'react';

/* ── Card ── */
interface CardProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Card = ({ title, icon, children, className }: CardProps) => (
  <div className={`med-card ${className || ''}`}>
    <h3 className="card-title">
      {icon && <span className="card-icon">{icon}</span>}
      {title}
    </h3>
    <div className="card-content">{children}</div>
  </div>
);

/* ── Button ── */
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md';
  disabled?: boolean;
  icon?: React.ReactNode;
}

export const Button = ({ children, onClick, type = 'button', variant = 'primary', size, disabled = false, icon }: ButtonProps) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`med-button ${variant} ${size || ''}`}
  >
    {icon && <span className="btn-icon">{icon}</span>}
    {children}
  </button>
);

/* ── Input ── */
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  label?: string;
  type?: string;
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export const Input = ({ label, type = 'text', value, onChange, placeholder, required = false, disabled = false, ...rest }: InputProps) => (
  <div className="med-input-group">
    {label && <label className="med-label">{label}</label>}
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      {...rest}
      className="med-input"
    />
  </div>
);

/* ── Tabs ── */
interface TabsProps {
  tabs: string[];
  activeTab: number;
  onChange: (index: number) => void;
}

export const Tabs = ({ tabs, activeTab, onChange }: TabsProps) => (
  <div className="tabs-container">
    <div className="tabs-header">
      {tabs.map((tab, i) => (
        <button
          key={i}
          className={`tab-button ${i === activeTab ? 'active' : ''}`}
          onClick={() => onChange(i)}
        >
          {tab}
        </button>
      ))}
    </div>
  </div>
);

/* ── Badge ── */
interface BadgeProps {
  text: string;
  variant?: 'low' | 'medium' | 'high' | 'emergency' | 'info';
}

export const Badge = ({ text, variant = 'info' }: BadgeProps) => (
  <span className={`badge ${variant}`}>{text}</span>
);

/* ── Skeleton ── */
export const Skeleton = ({ type = 'text' }: { type?: 'text' | 'title' | 'card' | 'avatar' }) => (
  <div className={`skeleton skeleton-${type}`} />
);

/* ── Toast System ── */
interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

let toastId = 0;
const toastListeners: Array<(toast: ToastMessage) => void> = [];

export const showToast = (text: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
  const toast: ToastMessage = { id: ++toastId, text, type };
  
  // Hardened loop: prevents potential crashes from invalid background listeners
  [...toastListeners].forEach(fn => {
    try {
      if (typeof fn === 'function') {
        fn(toast);
      }
    } catch (err) {
      console.error('MedSync Notification Error:', err);
    }
  });
};

export const ToastContainer = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (toast: ToastMessage) => {
      setToasts(prev => [...prev, toast]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== toast.id));
      }, 4000);
    };
    
    // Defensive push
    if (typeof handler === 'function') {
      toastListeners.push(handler);
    }

    return () => {
      const idx = toastListeners.indexOf(handler);
      if (idx > -1) toastListeners.splice(idx, 1);
    };
  }, []);

  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <div className="toast-content">{t.text}</div>
        </div>
      ))}
    </div>
  );
};

/* ── Modal ── */
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
  fullscreen?: boolean;
}

export const Modal = ({ isOpen, onClose, title, children, width, fullscreen }: ModalProps) => {
  if (!isOpen) return null;

  const panelStyle: React.CSSProperties = fullscreen
    ? {
        background: 'var(--bg-main)',
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }
    : {
        background: 'white',
        borderRadius: 'var(--radius-lg)',
        padding: '28px',
        maxWidth: width || '500px',
        width: '90%',
        boxShadow: 'var(--shadow-lg)',
        maxHeight: '80vh',
        overflow: 'auto',
      };

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: fullscreen ? 'var(--bg-main)' : 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9998,
      }}
      onClick={fullscreen ? undefined : onClose}
    >
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: fullscreen ? '20px 32px' : '0 0 20px 0',
          borderBottom: fullscreen ? '1px solid var(--card-border)' : 'none',
          background: fullscreen ? 'white' : 'transparent',
          flexShrink: 0,
        }}>
          <h3 style={{ fontSize: fullscreen ? '1.4rem' : '1.2rem', fontWeight: 700 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: fullscreen ? 'var(--bg-main)' : 'none',
              border: fullscreen ? '1px solid var(--card-border)' : 'none',
              borderRadius: fullscreen ? '8px' : '0',
              padding: fullscreen ? '6px 14px' : '0',
              fontSize: fullscreen ? '0.9rem' : '1.5rem',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontWeight: 600,
            }}
          >
            {fullscreen ? 'Close' : '\u00d7'}
          </button>
        </div>
        <div style={fullscreen ? { flex: 1, overflow: 'auto', padding: '28px 32px' } : {}}>
          {children}
        </div>
      </div>
    </div>
  );
};

// ── My Extensions (Strictly Additive) ──

interface MedCardProps extends CardProps {
  style?: React.CSSProperties;
}
export const MedCard = ({ title, children, icon, className, style }: MedCardProps) => (
  <div className={`med-card ${className || ''}`} style={style}>
    <h3 className="card-title">
      {icon && <span className="card-icon">{icon}</span>}
      {title}
    </h3>
    <div className="card-content">
      {children}
    </div>
  </div>
);

interface MedButtonProps extends ButtonProps {
  className?: string;
  style?: React.CSSProperties;
}
export const MedButton = ({ children, onClick, type = 'button', variant = 'primary', size, disabled = false, icon, className, style }: MedButtonProps) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`med-button ${variant} ${size || ''} ${className || ''}`}
    style={style}
  >
    {icon && <span className="btn-icon">{icon}</span>}
    {children}
  </button>
);

interface MedInputProps extends InputProps {
  className?: string;
  style?: React.CSSProperties;
  name?: string;
  onChange: (e: any) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onKeyPress?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}
export const MedInput = ({ label, type = 'text', value, onChange, placeholder, required = false, disabled = false, className, style, name, onKeyDown, onKeyPress }: MedInputProps) => (
  <div className={`med-input-group ${className || ''}`} style={style}>
    {label && <label className="med-label">{label}</label>}
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onKeyPress={onKeyPress}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      className="med-input"
    />
  </div>
);
