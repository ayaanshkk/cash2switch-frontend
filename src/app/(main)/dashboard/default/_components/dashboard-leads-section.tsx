"use client";

import { useAuth } from "@/contexts/AuthContext";
import { StaffPerformanceGrid } from "@/components/StaffPerformanceGrid";
import { LeadsOverview } from "./leads-dashboard-overview";
import { LeadsDashboardTable } from "./leads-dashboard-table";

export function DashboardLeadsSection({ employeeId }: { employeeId?: number | null }) {
  const { user } = useAuth();

  return (
    <div className="space-y-4">
      {/* Team Performance Grid - Shows lead performance metrics */}
      <StaffPerformanceGrid 
        employeeId={employeeId ?? undefined} 
        isLeadsDashboard={true} 
      />

      {/* Leads Overview - Stats and charts */}
      <LeadsOverview 
        userRole={user?.role} 
        employeeId={employeeId ?? undefined} 
      />

      {/* Leads Table */}
      <LeadsDashboardTable employeeId={employeeId} />
    </div>
  );
}