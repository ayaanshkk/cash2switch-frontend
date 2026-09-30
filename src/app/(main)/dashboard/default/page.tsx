  "use client";

  import { useState, useEffect } from "react";
  import { useAuth } from "@/contexts/AuthContext";
  import { EnergyRenewalsOverview } from "./_components/energy-renewals-overview";
  import { StaffPerformanceGrid } from "@/components/StaffPerformanceGrid";
  import { RenewalsTable } from "./_components/renewals-table";
  import {
    DashboardViewSwitcher,
    type DashboardMainView,
  } from "./_components/dashboard-view-switcher";
  import { DashboardLeadsSection } from "./_components/dashboard-leads-section";
  import { RenewalEmailLogsSummary } from "./_components/renewal-email-logs-summary";

  export default function DashboardPage() {
    const { user } = useAuth();
    const [view, setView] = useState<DashboardMainView>("renewals");

    const userRole = user?.role?.toLowerCase() || "";
    const isPlatformAdmin = userRole.includes("platform") && userRole.includes("admin");
    
    // Check if user is offshore (role_id 5)
    const isOffshore = user?.role_id === 5;

    // Force leads view for offshore users
    useEffect(() => {
      if (isOffshore) {
        setView("leads");
      }
    }, [isOffshore]);

    return (
      <div className="flex flex-col gap-6 rounded-2xl bg-slate-50/90 p-6 md:p-8 dark:bg-slate-950/60 dark:text-slate-100">
        {isPlatformAdmin ? (
          <>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Admin / Company dashboard
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Company Dashboard</h1>
                <p className="max-w-xl text-[15px] text-slate-600 dark:text-slate-400">
                  {view === "renewals"
                    ? "Monitor team performance and manage all company renewals."
                    : "Pipeline health, stage mix, and outcomes across your lead funnel."}
                </p>
              </div>
              <DashboardViewSwitcher value={view} onChange={setView} className="shrink-0 lg:pt-1" />
            </div>

            {view === "renewals" && (
              <>
                <StaffPerformanceGrid />
                <EnergyRenewalsOverview userRole={user?.role} employeeId={undefined} />
                <RenewalEmailLogsSummary />
                <RenewalsTable employeeId={undefined} />
              </>
            )}

            {view === "leads" && <DashboardLeadsSection employeeId={undefined} />}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">My dashboard</p>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                  Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
                </h1>
                <p className="max-w-xl text-[15px] text-slate-600 dark:text-slate-400">
                  {isOffshore
                    ? "Your lead pipeline & opportunities"
                    : view === "renewals"
                      ? "Your personal performance and assigned renewals."
                      : "Your pipeline, stages, and lead outcomes."}
                </p>
              </div>
              {!isOffshore && (
                <DashboardViewSwitcher value={view} onChange={setView} className="shrink-0 lg:pt-1" />
              )}
            </div>

            {!isOffshore && view === "renewals" && (
              <>
                <StaffPerformanceGrid employeeId={user?.employee_id} />
                <EnergyRenewalsOverview userRole={user?.role} employeeId={user?.employee_id} />
                <RenewalsTable employeeId={user?.employee_id} />
              </>
            )}

            {(view === "leads" || isOffshore) && (
              <DashboardLeadsSection employeeId={user?.employee_id} />
            )}
          </>
        )}
      </div>
    );
  }