"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string;
  fallback?: React.ReactNode;
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, loading, token } = useAuth();
  const router = useRouter();

  useEffect(() => {
    console.log("ProtectedRoute state:", { loading, user: !!user, token: !!token });
  }, [loading, user, token]);

  // Show loading while auth initializes
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
      </div>
    );
  }

  // If no auth after loading, middleware will handle redirect
  // Don't redirect here to avoid loops
  if (!user || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2"></div>
      </div>
    );
  }

  // Check role-based access
  if (requiredRole && user.role !== requiredRole) {
    router.replace("/unauthorized");
    return null;
  }

  return <>{children}</>;
}