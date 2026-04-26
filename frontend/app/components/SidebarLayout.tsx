'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ToastContainer } from './UI';
import { useAuth } from '../context/AuthContext';

import {
  UserCog, Stethoscope, Clock, Calendar, Home,
  Search, CalendarClock, User, FileText, Bot, Video, LayoutDashboard,
  Users, LineChart, CreditCard, LogOut, HeartPulse, Brain, Bell,
} from 'lucide-react';

const getNavItems = (role?: string) => {
  if (role === 'admin') {
    return [
      { href: '/admin', label: 'Admin Dashboard', icon: <LayoutDashboard size={20} /> },
      { href: '/admin/doctors', label: 'Manage Doctors', icon: <UserCog size={20} /> },
      { href: '/admin/patients', label: 'Manage Patients', icon: <Users size={20} /> },
      { href: '/admin/appointments', label: 'All Appointments', icon: <Calendar size={20} /> },
      { href: '/admin/payments', label: 'System Payments', icon: <CreditCard size={20} /> },
      { href: '/admin/oversight', label: 'Platform Oversight', icon: <LineChart size={20} /> },
      { href: '/admin/health', label: 'Service Health', icon: <HeartPulse size={20} /> },
      { href: '/admin/ai-insights', label: 'AI Triage Insights', icon: <Brain size={20} /> },
      { href: '/notifications', label: 'Notifications', icon: <Bell size={20} /> },
    ];
  }
  if (role === 'doctor') {
    return [
      { href: '/doctor', label: 'Doctor Dashboard', icon: <Stethoscope size={20} /> },
      { href: '/doctor/availability', label: 'My Schedule', icon: <Clock size={20} /> },
      { href: '/doctor/appointments', label: 'Appointments', icon: <Calendar size={20} /> },
      { href: '/telemedicine', label: 'Virtual Meetings', icon: <Video size={20} /> },
      { href: '/notifications', label: 'Notifications', icon: <Bell size={20} /> },
    ];
  }
  return [
    { href: '/patient', label: 'Dashboard', icon: <Home size={20} /> },
    { href: '/appointment/search', label: 'Find Doctors', icon: <Search size={20} /> },
    { href: '/appointment', label: 'My Appointments', icon: <CalendarClock size={20} /> },
    { href: '/telemedicine', label: 'Join Consultation', icon: <Video size={20} /> },
    { href: '/patient/profile', label: 'My Profile', icon: <User size={20} /> },
    { href: '/patient/health', label: 'Health Profile', icon: <HeartPulse size={20} /> },
    { href: '/patient/records', label: 'Records & Documents', icon: <FileText size={20} /> },
    { href: '/symptom-checker', label: 'AI Symptom Checker', icon: <Bot size={20} /> },
    { href: '/payment', label: 'Billing & Payments', icon: <CreditCard size={20} /> },
    { href: '/notifications', label: 'Notifications', icon: <Bell size={20} /> },
  ];
};

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();
  
  // Routes where sidebar should NOT be displayed (public routes)
  const noSidebarRoutes = ['/', '/login', '/register', '/verify'];
  const showSidebar = !noSidebarRoutes.some(route => pathname === route || pathname.startsWith(route + '/'));

  useEffect(() => {
    // PUBLIC ROUTES - Never redirect or check auth
    if (isLoading) return;
    
    // ALWAYS allow home page and public routes - no redirects
    if (pathname === '/' || pathname === '/login' || pathname === '/register' || pathname.startsWith('/verify')) {
      return;
    }
    
    // For all other protected routes, check auth
    if (!user) {
      router.replace('/login');
      return;
    }

    const allowedPrefixesByRole: Record<string, string[]> = {
      admin: ['/admin', '/notifications', '/'],
      doctor: ['/doctor', '/telemedicine', '/notifications', '/'],
      patient: ['/patient', '/appointment', '/symptom-checker', '/telemedicine', '/payment', '/notifications', '/'],
    };

    const allowedPrefixes = allowedPrefixesByRole[user.role] || [];
    const isAllowed = allowedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(prefix));

    if (!isAllowed) {
      router.replace(user.role === 'admin' ? '/admin' : user.role === 'doctor' ? '/doctor' : '/patient');
      return;
    }

    if (pathname.startsWith('/admin') && user.role !== 'admin') {
      router.replace(user.role === 'doctor' ? '/doctor' : '/patient');
      return;
    }

    if (pathname.startsWith('/doctor') && user.role !== 'doctor') {
      router.replace(user.role === 'admin' ? '/admin' : '/patient');
      return;
    }

    if (pathname.startsWith('/patient') && user.role !== 'patient') {
      router.replace(user.role === 'admin' ? '/admin' : '/doctor');
      return;
    }
  }, [isLoading, pathname, router, user]);

  const navItems = getNavItems(user?.role);

  if (!showSidebar) {
    return (
      <>
        <ToastContainer />
        <main>{children}</main>
      </>
    );
  }

  if (isLoading || !user) {
    return (
      <>
        <ToastContainer />
        <main className="main-content" />
      </>
    );
  }

  return (
    <>
      <ToastContainer />

      {/* Mobile toggle */}
      <button className="mobile-toggle" onClick={() => setIsOpen(!isOpen)}>
        {isOpen ? '✕' : '☰'}
      </button>

      <div className="app-layout">
        {/* Sidebar */}
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
          <div className="sidebar-brand">
            <h1>Med<span>Sync</span></h1>
            <p>Healthcare Platform</p>
          </div>

          <nav className="sidebar-nav">
            {navItems.map((item) => {
              const isActive = item.href === '/admin' || item.href === '/doctor' || item.href === '/patient' 
                ? pathname === item.href 
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            {user ? (
              <div>
                <p style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>
                  {user.name} ({user.role})
                </p>
                <p style={{ marginBottom: '8px' }}>{user.email}</p>
                <button
                  onClick={logout}
                  className="logout-btn"
                >
                  <LogOut size={16} /> Logout
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', marginBottom: '12px' }}>Not signed in</p>
                <Link href="/login" style={{ width: '100%', display: 'block' }}>
                  <button
                    style={{
                      background: 'var(--turquoise)',
                      border: 'none',
                      color: '#fff',
                      padding: '8px 16px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 600,
                      width: '100%'
                    }}
                  >
                    Login / Join
                  </button>
                </Link>
              </div>
            )}
            <p style={{ marginTop: '12px' }}>© 2026 MedSync</p>
          </div>
        </aside>

        {/* Main content */}
        <main className="main-content">
          {children}
        </main>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', zIndex: 999
          }}
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
