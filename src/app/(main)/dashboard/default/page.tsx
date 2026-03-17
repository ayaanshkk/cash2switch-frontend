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
    <div className="flex flex-col gap-6 p-6">
      {isPlatformAdmin ? (
        /* ============================================
           ADMIN DASHBOARD - COMPANY-WIDE VIEW
           Same as before, no changes
           ============================================ */
        <>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Company Dashboard
            </h1>
            <p className="text-muted-foreground">
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
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              My Dashboard
            </h1>
            <p className="text-muted-foreground">
              Welcome back, {user?.name || 'Salesperson'}! Here's your personal performance overview.
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