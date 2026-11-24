"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchPublic, fetchWithAuth, API_BASE_URL } from "@/lib/api";

interface User {
  name: string;
  id: number;
  employee_id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone?: string;
  role: string;
  role_id?: number;
  department?: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  last_login?: string;
}

interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  department?: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string, tenantId?: number) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  register: (userData: RegisterData) => Promise<{ success: boolean; error?: string }>;
  updateUser: (userData: Partial<User>) => void;
  checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const clearAuth = useCallback(() => {
    setUser(null);
    setToken(null);
    // tenant_id is non-sensitive — keep it so API calls don't lose context
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    localStorage.removeItem("user_role");
  }, []);

  // Restore session by calling /auth/me — the HttpOnly cookie is sent automatically
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Migrate: clear any leftover sensitive tokens from localStorage
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        localStorage.removeItem("user_role");

        const data = await fetchWithAuth("/auth/me");
        if (data?.user) {
          setUser(data.user);
          if (data.user.tenant_id) {
            localStorage.setItem("tenant_id", String(data.user.tenant_id));
          }
        }
      } catch {
        // No valid cookie — user is not logged in; stay on login page
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (username: string, password: string, tenantId: number = 1): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetchPublic("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password, tenant_id: tenantId }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        return { success: false, error: "Server returned an invalid response." };
      }

      if (response.ok) {
        // Backend sets the HttpOnly cookie via Set-Cookie header.
        // We keep token in memory only (never localStorage).
        setToken(data.token);
        setUser(data.user);
        if (data.user?.tenant_id) {
          localStorage.setItem("tenant_id", String(data.user.tenant_id));
        }
        return { success: true };
      } else {
        return { success: false, error: data.error || "Login failed" };
      }
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "Cannot connect to server. Please ensure the backend is running." };
    }
  };

  const register = async (userData: RegisterData): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetchPublic("/auth/register", {
        method: "POST",
        body: JSON.stringify(userData),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        return { success: false, error: "Server returned an invalid response." };
      }

      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, error: data.error || "Registration failed" };
      }
    } catch (error) {
      console.error("Registration error:", error);
      return { success: false, error: "Cannot connect to server. Please try again." };
    }
  };

  const logout = async () => {
    try {
      // Tell the backend to clear the HttpOnly cookie
      await fetchWithAuth("/auth/logout", { method: "POST" });
    } catch {
      // Even if the request fails, clear local state and redirect
    }
    clearAuth();
    router.replace("/login");
  };

  const checkAuth = async (): Promise<boolean> => {
    try {
      const data = await fetchWithAuth("/auth/me");
      if (data?.user) {
        setUser(data.user);
        return true;
      }
      clearAuth();
      return false;
    } catch {
      clearAuth();
      return false;
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    register,
    updateUser,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
