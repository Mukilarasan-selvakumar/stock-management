import React, { createContext, useState, useEffect } from 'react';
import axiosInstance from '../api/axiosInstance';
import { useNavigate } from 'react-router-dom';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const token = sessionStorage.getItem('accessToken');
      if (token) {
        try {
          const res = await axiosInstance.get('/auth/me');
          setUser(res.data);
        } catch (error) {
          console.error("Auth check failed:", error);
          sessionStorage.removeItem('accessToken');
        }
      }
      setLoading(false);
    };

    checkAuth();

    // Listen for auth errors from axios interceptor
    const handleAuthError = () => {
      setUser(null);
      navigate('/login');
    };

    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, [navigate]);

  const login = async (email, password) => {
    const res = await axiosInstance.post('/auth/login', { email, password });
    sessionStorage.setItem('accessToken', res.data.accessToken);
    setUser(res.data.user);
    navigate('/');
  };

  const signup = async (userData) => {
    await axiosInstance.post('/auth/signup', userData);
    navigate('/login');
  };

  const logout = async () => {
    try {
      await axiosInstance.post('/auth/logout');
    } catch (error) {
      console.error("Logout error", error);
    } finally {
      sessionStorage.removeItem('accessToken');
      setUser(null);
      navigate('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
