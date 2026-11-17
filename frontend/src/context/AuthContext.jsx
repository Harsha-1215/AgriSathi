import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import authService, { getAuthenticatedUser } from '../services/authService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [restoreError, setRestoreError] = useState(null);
  const sessionCheckRef = useRef(null);

  const refreshUser = useCallback(async () => {
    if (sessionCheckRef.current) return sessionCheckRef.current;
    const request = (async () => {
      setLoading(true);
      setRestoreError(null);
      try {
        const response = await authService.me();
        const authenticatedUser = getAuthenticatedUser(response);
        setUser(authenticatedUser);
        return authenticatedUser;
      } catch (error) {
        if (error?.response?.status === 401) {
          setUser(null);
          return null;
        }
        setUser(null);
        setRestoreError(error);
        throw error;
      } finally {
        setSessionChecked(true);
        setLoading(false);
      }
    })();
    sessionCheckRef.current = request;
    try {
      return await request;
    } finally {
      if (sessionCheckRef.current === request) sessionCheckRef.current = null;
    }
  }, []);

  const login = useCallback(async (credentials) => {
    setLoading(true);
    setRestoreError(null);
    setSessionExpired(false);
    try {
      const response = await authService.login(credentials);
      const authenticatedUser = getAuthenticatedUser(response);
      setUser(authenticatedUser);
      return authenticatedUser;
    } catch (error) {
      setUser(null);
      throw error;
    } finally {
      setSessionChecked(true);
      setLoading(false);
    }
  }, []);

  const loginWithRecoveryOtp = useCallback(async ({ identifier, otp }) => {
    setLoading(true);
    setRestoreError(null);
    setSessionExpired(false);
    try {
      const response = await authService.verifyOtp({ identifier, otp, purpose: 'password_reset' });
      const authenticatedUser = getAuthenticatedUser(response);
      setUser(authenticatedUser);
      return authenticatedUser;
    } catch (error) {
      setUser(null);
      throw error;
    } finally {
      setSessionChecked(true);
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setRestoreError(null);
      setSessionExpired(false);
      setSessionChecked(true);
      queryClient.clear();
    }
  }, [queryClient]);

  const invalidateSession = useCallback(() => {
    setUser(null);
    setRestoreError(null);
    setSessionExpired(true);
    setSessionChecked(true);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo(() => ({
    user,
    loading,
    sessionChecked,
    sessionExpired,
    restoreError,
    isAuthenticated: Boolean(user),
    login,
    loginWithRecoveryOtp,
    logout,
    refreshUser,
    invalidateSession,
  }), [user, loading, sessionChecked, sessionExpired, restoreError, login, loginWithRecoveryOtp, logout, refreshUser, invalidateSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider.');
  return value;
}
