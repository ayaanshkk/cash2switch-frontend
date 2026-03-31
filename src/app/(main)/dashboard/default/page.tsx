"use client";

import { useAuth } from "@/contexts/AuthContext";
import { EnergyRenewalsOverview } from "./_components/energy-renewals-overview";
import { StaffPerformanceGrid } from "@/components/StaffPerformanceGrid";
import { RenewalsTable } from "./_components/renewals-table";

export default function DashboardPage() {
  const { user } = useAuth();

  // ✅ Case-insensitive check for Platform Admin
  const userRole = user?.role?.toLowerCase() || '';
  const isPlatformAdmin = userRole.includes('platform') && userRole.includes('admin');

  return (
    <div className="flex flex-col gap-6 rounded-2xl bg-slate-50/90 p-6 md:p-8">
      {isPlatformAdmin ? (
        <>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Admin / Company dashboard
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Company Dashboard
            </h1>
            <p className="text-[15px] text-slate-600">
              Monitor team performance and manage all company renewals
            </p>
          </div>

          {/* Team Performance Grid - Shows all salespeople */}
          <StaffPerformanceGrid />

          {/* Company-wide Stats - ALL data */}
          <EnergyRenewalsOverview 
            userRole={user?.role} 
            employeeId={undefined}
          />

          {/* All Company Renewals */}
          <RenewalsTable employeeId={undefined} />
        </>
      ) : (
        /* ============================================
           SALESPERSON DASHBOARD - PERSONALIZED VIEW
           Completely different, isolated view
           ============================================ */
        <>
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              My dashboard
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
            </h1>
            <p className="text-[15px] text-slate-600">
              Here&apos;s your personal performance overview.
            </p>
          </div>

          {/* ✅ Personal Performance Stats - ONLY their data */}
          <EnergyRenewalsOverview 
            userRole={user?.role} 
            employeeId={user?.employee_id}
          />

          {/* ✅ Only their assigned renewals */}
          <RenewalsTable employeeId={user?.employee_id} />
        </>
      )}
    </div>
  );
}