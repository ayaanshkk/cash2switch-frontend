"use client";

import { useEffect, useState } from 'react';

interface User {
  id: number;
  email: string;
  username?: string;
  full_name?: string;
  role: string;
}

export const useAuth = () => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Get token from localStorage
    const storedToken = localStorage.getItem('token') || localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user');

    if (storedToken) {
      setToken(storedToken);
    }

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse user data');
      }
    }
  }, []);

  return { token, user };
};