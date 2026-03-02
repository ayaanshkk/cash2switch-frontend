"use client";

import { useAuth } from "@/contexts/AuthContext";
import { EnergyRenewalsOverview } from "./_components/energy-renewals-overview";
import { StaffPerformanceGrid } from "@/components/StaffPerformanceGrid";
import { RenewalsTable } from "./_components/renewals-table";

export default function DashboardPage() {
  const { user } = useAuth();

  // ✅ DEBUG: Check what data we're passing
  console.log("🏠 Dashboard Page Debug:", {
    user_role: user?.role,
    employee_id: user?.employee_id,
    full_user: user
  });

  // ✅ Case-insensitive check for Platform Admin
  const userRole = user?.role?.toLowerCase() || '';
  const isPlatformAdmin = userRole.includes('platform') && userRole.includes('admin');

  console.log("🔐 Role Check:", {
    userRole,
    isPlatformAdmin,
    employeeIdToPass: isPlatformAdmin ? undefined : user?.employee_id
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      {isPlatformAdmin ? (
        /* ============================================
           PLATFORM ADMIN DASHBOARD VIEW
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

          {/* ✅ Company-wide Stats - NO filter, show ALL data */}
          <EnergyRenewalsOverview 
            userRole={user?.role} 
            employeeId={undefined} // ✅ undefined = no filter = ALL company data
          />

          {/* ✅ All Company Renewals */}
          <RenewalsTable employeeId={undefined} /> {/* ✅ Show all renewals */}
        </>
      ) : (
        /* ============================================
           SALESPERSON DASHBOARD VIEW
           ============================================ */
        <>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              My Performance Dashboard
            </h1>
            <p className="text-muted-foreground">
              Track your personal renewal performance and customers
            </p>
          </div>

          {/* ✅ Personal Stats - Filter by their employee_id */}
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