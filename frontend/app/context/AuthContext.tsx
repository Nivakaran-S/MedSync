'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import Cookies from 'js-cookie';
import { authService, User as AuthUser } from '../services/authService';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (data: Record<string, unknown> & { role: 'patient' | 'doctor' }) => Promise<AuthUser>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Defensive normalisation — backend services still return `_id` and sometimes omit `role`.
const normaliseUser = (raw: any): AuthUser => {
  const u = { ...raw };
  if (u._id && !u.id) u.id = u._id;
  if (!u.role && u.email !== 'admin@medsync.com') u.role = 'patient';
  return u as AuthUser;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = Cookies.get('medsync_token');
    const storedUser = typeof window !== 'undefined' ? localStorage.getItem('medsync_user') : null;
    if (storedToken && storedUser) {
      try {
        setToken(storedToken);
        setUser(normaliseUser(JSON.parse(storedUser)));
      } catch {
        authService.logout();
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const data = await authService.login(email, password);
    const u = normaliseUser(data.user);
    authService.setToken(data.token);
    if (typeof window !== 'undefined') {
      localStorage.setItem('medsync_user', JSON.stringify(u));
    }
    setToken(data.token);
    setUser(u);
    return u;
  };

  const register = async (formData: Record<string, unknown> & { role: 'patient' | 'doctor' }) => {
    const data = await authService.register(formData);
    const u = normaliseUser(data.user);
    if (!u.role) u.role = formData.role;
    authService.setToken(data.token);
    if (typeof window !== 'undefined') {
      localStorage.setItem('medsync_user', JSON.stringify(u));
    }
    setToken(data.token);
    setUser(u);
    return u;
  };

  const logout = () => {
    authService.logout();
    setToken(null);
    setUser(null);
    if (typeof window !== 'undefined') window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
