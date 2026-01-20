"use client";

import { QuickActions } from "@/components/dashboard/QuickActions";
import { MiniCalendar } from "@/components/dashboard/MiniCalendar";
import { OverviewCards } from "./_components/overview-cards";
import { TableCards } from "./_components/table-cards";

export default function Page() {
  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here's what's happening with your business today.
          </p>
        </div>
      </div>

      {/* Quick Actions + Mini Calendar Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <QuickActions />
        <div className="lg:col-span-2">
          <MiniCalendar />
        </div>
      </div>

      {/* Overview Cards - New Leads, Sales Pipeline, Action Items */}
      <OverviewCards />

      {/* Recent Leads Table */}
      <TableCards />
    </div>
  );
}