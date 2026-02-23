// ============================================
// REALMIO AUTH CLIENT UNTUK TRANSITYCORE
// ============================================
// Letakkan file ini di: client/src/lib/realmio-auth.ts
// Kemudian sesuaikan dengan kebutuhan project

// Konfigurasi - letakkan di .env
const REALMIO_AUTH_URL = import.meta.env.VITE_REALMIO_AUTH_URL || 'https://realmio-rndynt.zocomputer.io';
const REALMIO_TENANT_ID = import.meta.env.VITE_REALMIO_TENANT_ID || 'transity-core';

// ============================================
// Types
// ============================================
export interface User {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: string | null;
  createdAt: Date;
}

export interface Session {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  user: User;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

// ============================================
// Realmio Auth Client
// ============================================
class RealmioAuthClient {
  private baseUrl: string;
  private tenantId: string;

  constructor(baseUrl: string = REALMIO_AUTH_URL, tenantId: string = REALMIO_TENANT_ID) {
    this.baseUrl = baseUrl;
    this.tenantId = tenantId;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': this.tenantId,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || 'Request failed');
    }

    return response.json();
  }

  // Sign Up
  async signUp(email: string, password: string, name?: string): Promise<Session> {
    return this.request<Session>('/api/auth/sign-up/email', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
  }

  // Sign In
  async signIn(email: string, password: string): Promise<Session> {
    return this.request<Session>('/api/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  // Sign Out
  async signOut(): Promise<void> {
    await this.request('/api/auth/sign-out', { method: 'POST' });
  }

  // Get Session
  async getSession(): Promise<Session | null> {
    try {
      return await this.request<Session>('/api/auth/get-session');
    } catch {
      return null;
    }
  }

  // Get Current User (dengan info tenant)
  async getMe(): Promise<{ user: User; tenant: { id: string; slug: string } }> {
    return this.request('/me');
  }
}

export const realmioAuth = new RealmioAuthClient();

// ============================================
// React Hook untuk Auth
// ============================================
import { useState, useEffect, useCallback } from 'react';

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const checkSession = useCallback(async () => {
    try {
      const data = await realmioAuth.getMe();
      setState({
        user: data.user,
        session: null,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch {
      setState({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      await realmioAuth.signIn(email, password);
      await checkSession();
      return { success: true };
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: (error as Error).message };
    }
  }, [checkSession]);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    setState(prev => ({ ...prev, isLoading: true }));
    try {
      await realmioAuth.signUp(email, password, name);
      await checkSession();
      return { success: true };
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      return { success: false, error: (error as Error).message };
    }
  }, [checkSession]);

  const signOut = useCallback(async () => {
    try {
      await realmioAuth.signOut();
      setState({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
      });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  }, []);

  return {
    ...state,
    signIn,
    signUp,
    signOut,
    checkSession,
  };
}

// ============================================
// Contoh Penggunaan di Login Page
// ============================================
/*
// client/src/pages/LoginPage.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/realmio-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const { signIn, signUp, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Redirect jika sudah login
  if (isAuthenticated) {
    navigate('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegister) {
      const result = await signUp(email, password, name);
      if (result.success) {
        navigate('/');
      } else {
        alert(result.error);
      }
    } else {
      const result = await signIn(email, password);
      if (result.success) {
        navigate('/');
      } else {
        alert(result.error);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 p-8 border rounded-lg">
        <h1 className="text-2xl font-bold">{isRegister ? 'Register' : 'Login'}</h1>
        
        {isRegister && (
          <Input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}
        
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        
        <Input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? 'Loading...' : isRegister ? 'Register' : 'Login'}
        </Button>
        
        <p className="text-center text-sm">
          {isRegister ? 'Sudah punya akun?' : 'Belum punya akun?'}{' '}
          <button type="button" onClick={() => setIsRegister(!isRegister)} className="text-blue-600">
            {isRegister ? 'Login' : 'Register'}
          </button>
        </p>
      </form>
    </div>
  );
}
*/

export default realmioAuth;
