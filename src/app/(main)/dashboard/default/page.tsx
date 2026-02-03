"use client";

import { EnergyRenewalsOverview } from "./_components/energy-renewals-overview";
import { RenewalsTable } from "./_components/renewals-table";

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Renewals Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor and manage upcoming contract renewals for your energy customers
        </p>
      </div>

      {/* Overview Cards and Charts */}
      <EnergyRenewalsOverview />

      {/* Renewals Table */}
      <RenewalsTable />
    </div>
  );
}