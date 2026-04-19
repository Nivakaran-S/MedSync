import Cookies from 'js-cookie';

const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || 'http://localhost:5000/api/auth';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'patient' | 'doctor' | 'admin';
}

export interface AuthResponse {
  user: User;
  token: string;
}

const parseError = async (response: Response, fallback: string) => {
  try {
    const error = await response.json();
    return error?.message || fallback;
  } catch {
    return fallback;
  }
};

export const authService = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await fetch(`${AUTH_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) throw new Error(await parseError(response, 'Login failed'));
    return response.json();
  },

  register: async (userData: unknown): Promise<AuthResponse> => {
    const response = await fetch(`${AUTH_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    if (!response.ok) throw new Error(await parseError(response, 'Registration failed'));
    return response.json();
  },

  logout: () => {
    Cookies.remove('medsync_token');
    if (typeof window !== 'undefined') localStorage.removeItem('medsync_user');
  },

  setToken: (token: string) => {
    Cookies.set('medsync_token', token, {
      expires: 7,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  },

  getToken: () => Cookies.get('medsync_token'),

  isAuthenticated: () => !!Cookies.get('medsync_token'),
};
