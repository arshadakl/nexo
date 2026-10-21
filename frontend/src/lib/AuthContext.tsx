import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenantId: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check active session on initial load
    apiFetch<{ user: AuthUser }>('/api/auth/me')
      .then((res) => {
        if (res?.user) {
          setUser(res.user);
        }
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = async (email: string, password: string) => {
    const res = await apiFetch<{ user: AuthUser; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res?.user) {
      setUser(res.user);
    }
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
