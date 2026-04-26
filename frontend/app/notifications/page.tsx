'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell, Check, Trash2, RefreshCcw, Calendar, CreditCard, Pill, UserCircle,
  AlertCircle, Filter,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { notificationApi, type MedNotification } from '../services/api';
import { showToast, Badge } from '../components/UI';

const categoryIcon = (category: string) => {
  switch (category) {
    case 'appointment': return <Calendar size={18} />;
    case 'payment':     return <CreditCard size={18} />;
    case 'prescription':return <Pill size={18} />;
    case 'account':     return <UserCircle size={18} />;
    case 'system':      return <AlertCircle size={18} />;
    default:            return <Bell size={18} />;
  }
};

const formatRelative = (iso: string) => {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1)   return 'just now';
  if (min < 60)  return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)   return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7)   return `${day}d ago`;
  return d.toLocaleDateString();
};

export default function NotificationsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<MedNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [isLoading, user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationApi.list({ unreadOnly, limit: 100 });
      setItems(res.items);
      setUnread(res.unread);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to load notifications', 'error');
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => { if (user) load(); }, [user, load]);

  const onMarkRead = async (id: string) => {
    try {
      await notificationApi.markRead(id);
      setItems(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to mark as read', 'error');
    }
  };

  const onMarkAll = async () => {
    try {
      const { updated } = await notificationApi.markAllRead();
      showToast(`Marked ${updated} as read`, 'success');
      load();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to mark all as read', 'error');
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm('Delete this notification?')) return;
    try {
      await notificationApi.delete(id);
      setItems(prev => prev.filter(n => n._id !== id));
      showToast('Notification deleted', 'success');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete', 'error');
    }
  };

  if (isLoading || !user) {
    return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>;
  }

  return (
    <div className="animate-in" style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Bell size={28} />
          <div>
            <h1 style={{ margin: 0, fontSize: '1.6rem' }}>Notifications</h1>
            <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
              {unread > 0 ? `${unread} unread` : 'All caught up'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setUnreadOnly(v => !v)}
            className="med-button secondary sm"
            title="Toggle unread filter"
          >
            <Filter size={14} /> {unreadOnly ? 'All' : 'Unread only'}
          </button>
          <button onClick={load} className="med-button secondary sm" title="Refresh">
            <RefreshCcw size={14} /> Refresh
          </button>
          {unread > 0 && (
            <button onClick={onMarkAll} className="med-button primary sm">
              <Check size={14} /> Mark all read
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading notifications…</div>
      ) : items.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 60, background: '#f8fafc',
          borderRadius: 12, border: '1px dashed #cbd5e1', color: '#64748b'
        }}>
          <Bell size={36} style={{ opacity: 0.4 }} />
          <p style={{ marginTop: 12 }}>
            {unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(n => (
            <div
              key={n._id}
              style={{
                background: n.isRead ? '#fff' : '#eff6ff',
                border: `1px solid ${n.isRead ? '#e2e8f0' : '#bfdbfe'}`,
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                gap: 14,
                alignItems: 'flex-start',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10, background: '#f1f5f9',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#0ea5e9', flexShrink: 0,
              }}>
                {categoryIcon(n.category)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <strong style={{ fontSize: '0.95rem' }}>
                    {n.title || n.subject || n.category}
                  </strong>
                  <Badge text={n.category} variant="info" />
                  {!n.isRead && (
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%', background: '#0ea5e9',
                    }} />
                  )}
                </div>
                <p style={{ margin: 0, color: '#475569', fontSize: '0.9rem', lineHeight: 1.5 }}>
                  {n.message}
                </p>
                <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                  {formatRelative(n.createdAt)}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {!n.isRead && (
                  <button
                    onClick={() => onMarkRead(n._id)}
                    title="Mark as read"
                    style={{
                      background: 'transparent', border: '1px solid #cbd5e1',
                      borderRadius: 8, padding: 6, cursor: 'pointer', color: '#0ea5e9',
                    }}
                  >
                    <Check size={14} />
                  </button>
                )}
                <button
                  onClick={() => onDelete(n._id)}
                  title="Delete"
                  style={{
                    background: 'transparent', border: '1px solid #fecaca',
                    borderRadius: 8, padding: 6, cursor: 'pointer', color: '#dc2626',
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
