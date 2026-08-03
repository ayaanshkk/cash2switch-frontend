"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";

const ADMIN_ROLES = new Set(["platform admin", "tenant super admin", "admin", "superadmin", "super admin"]);

export default function PaymentsLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const isAdmin = ADMIN_ROLES.has(user?.role?.trim().toLowerCase() || "");

  useEffect(() => {
    if (!loading && user && !isAdmin) {
      router.replace("/unauthorized");
    }
  }, [isAdmin, loading, router, user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Checking access...
      </div>
    );
  }

  if (!isAdmin) return null;
  return children;
}
