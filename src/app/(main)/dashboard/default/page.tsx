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
           PLATFORM ADMIN DASHBOARD VIEW
           - Team Performance Grid (all staff)
           - Overall Company Stats (all renewals)
           - Renewals Table (all data)
           ============================================ */
        <>
          {/* Page Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Renewals Dashboard
            </h1>
            <p className="text-muted-foreground">
              Monitor and manage upcoming contract renewals for your energy customers
            </p>
          </div>

          {/* Team Performance Grid - Click to see individual stats */}
          <StaffPerformanceGrid />

          {/* Overall Company Stats - Admin sees ALL data */}
          <EnergyRenewalsOverview 
            userRole={user?.role} 
            employeeId={undefined} // No filter - show all
          />

          {/* Renewals Table - All renewals */}
          <RenewalsTable />
        </>
      ) : (
        /* ============================================
           SALESPERSON DASHBOARD VIEW
           - Personal Performance Stats Only
           - Their Own Renewals Only
           - No Team Performance Grid
           ============================================ */
        <>
          {/* Page Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              My Performance Dashboard
            </h1>
            <p className="text-muted-foreground">
              Track your personal renewal performance and manage your customers
            </p>
          </div>

          {/* Personal Performance Stats - Salesperson sees ONLY their own data */}
          <EnergyRenewalsOverview 
            userRole={user?.role} 
            employeeId={user?.id} // ✅ Filter by their employee_id
          />

          {/* Renewals Table - Only their assigned renewals */}
          <RenewalsTable employeeId={user?.id} />
        </>
      )}
    </div>
  );
}