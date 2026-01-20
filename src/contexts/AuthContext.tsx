"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { fetchPublic, fetchWithAuth } from "@/lib/api";

interface User {
  name: any;
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone?: string;
  role: string;
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
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
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

// ✅ Helper function to set cookie
function setCookie(name: string, value: string, days: number = 7) {
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
}

// ✅ Helper function to delete cookie
function deleteCookie(name: string) {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const clearAuth = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
    localStorage.removeItem("user_role");
    deleteCookie("auth-token"); // ✅ Clear cookie
  }, []);

  // ✅ Initialize auth state from localStorage - ONLY RUN ONCE
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem("auth_token");
        const storedUser = localStorage.getItem("auth_user");

        console.log("Initializing auth...", { hasToken: !!storedToken, hasUser: !!storedUser });

        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(parsedUser);
          localStorage.setItem("user_role", parsedUser.role); // ✅ ADD THIS LINE
          setCookie("auth-token", storedToken, 7);
          console.log("Auth state restored from localStorage");
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
        setUser(null);
        setToken(null);
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        deleteCookie("auth-token");
      } finally {
        console.log("Auth initialization complete");
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // ✅ LOGIN - Sets both localStorage AND cookie
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log("🔄 Attempting login...");

      const response = await fetchPublic("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        console.error("Failed to parse JSON response:", e);
        return { success: false, error: "Server returned an invalid response (not JSON)." };
      }

      console.log("📡 Login response:", { status: response.status, data });

      if (response.ok) {
        console.log("✅ Login successful, setting auth state...");
        setToken(data.token);
        setUser(data.user);

        // ✅ Save to localStorage
        localStorage.setItem("auth_token", data.token);
        localStorage.setItem("auth_user", JSON.stringify(data.user));
        localStorage.setItem("user_role", data.user.role); // ✅ ADD THIS LINE

        // ✅ Save to cookie (for middleware)
        setCookie("auth-token", data.token, 7);

        console.log("💾 Auth state saved to localStorage AND cookie");

        return { success: true };
      } else {
        console.log("❌ Login failed:", data.error);
        return { success: false, error: data.error || "Login failed" };
      }
    } catch (error) {
      console.error("🚨 Login network/fetch error:", error);
      return { success: false, error: "Cannot connect to server. Please ensure the backend is running." };
    }
  };

  // ✅ REGISTER - No redirects
  const register = async (userData: RegisterData): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log("🔄 Attempting registration...");

      const response = await fetchPublic("/auth/register", {
        method: "POST",
        body: JSON.stringify(userData),
      });

      let data;
      try {
        data = await response.json();
      } catch (e) {
        console.error("Failed to parse JSON response:", e);
        return { success: false, error: "Server returned an invalid response (not JSON)." };
      }

      console.log("📡 Registration response:", { status: response.status, data });

      if (response.ok) {
        console.log("✅ Registration successful");
        return { success: true };
      } else {
        console.log("❌ Registration failed:", data.error);
        return { success: false, error: data.error || "Registration failed" };
      }
    } catch (error) {
      console.error("🚨 Registration network error:", error);
      return { success: false, error: "Cannot connect to server. Please try again." };
    }
  };

  // ✅ LOGOUT - Clear cookie too
  const logout = async () => {
    console.log("Logging out...");
    clearAuth();
    router.replace("/login");
  };

  // ✅ AUTH CHECK - No redirects on failure
  const checkAuth = async (): Promise<boolean> => {
    if (!token) return false;

    try {
      const response = await fetchWithAuth("/auth/me");

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        localStorage.setItem("auth_user", JSON.stringify(data.user));
        return true;
      } else {
        clearAuth();
        return false;
      }
    } catch (error) {
      console.error("Auth check network error:", error);
      clearAuth();
      return false;
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem("auth_user", JSON.stringify(updatedUser));
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