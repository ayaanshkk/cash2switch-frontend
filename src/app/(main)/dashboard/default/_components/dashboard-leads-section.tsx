"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWithAuth } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

import {
  LeadsDashboardOverview,
  type LeadPerformanceStats,
  type TeamLeadStat,
} from "./leads-dashboard-overview";
import { LeadsDashboardTable, type LeadRow } from "./leads-dashboard-table";
import {
  LeadsTeamPerformanceStrip,
  loadTeamStatsWithFallback,
  type LeadsTeamStatRow,
} from "./leads-team-performance-strip";

const SERVICE = "utilities";

function mapLeadsResponse(leadsResp: unknown): LeadRow[] {
  const raw: unknown[] = Array.isArray(leadsResp)
    ? leadsResp
    : ((leadsResp as { data?: unknown[] })?.data ?? []);
  return raw.map((item: any) => ({
    opportunity_id: item.opportunity_id,
    business_name: item.business_name ?? null,
    contact_person: item.contact_person ?? null,
    tel_number: item.tel_number ?? null,
    email: item.email ?? null,
    stage_name: item.stage_name ?? null,
    end_date: item.end_date ?? null,
    annual_usage: item.annual_usage ?? null,
    assigned_to_name: item.assigned_to_name ?? null,
  }));
}

export function DashboardLeadsSection({ employeeId }: { employeeId?: number | null }) {
  const { user } = useAuth();
  const isAdmin =
    user?.role === "Platform Admin" || user?.role === "Tenant Super Admin";

  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [teamStats, setTeamStats] = useState<TeamLeadStat[]>([]);
  const [teamStripStats, setTeamStripStats] = useState<LeadsTeamStatRow[]>([]);
  const [performance, setPerformance] = useState<LeadPerformanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const leadsPromise = fetchWithAuth(
        `/api/crm/leads?exclude_stage=Lost&service=${encodeURIComponent(SERVICE)}`
      );
      const perfPromise = fetchWithAuth(
        `/api/crm/leads/performance?service=${encodeURIComponent(SERVICE)}`
      ).catch((e) => {
        console.warn("[dashboard-leads] performance endpoint failed:", e);
        return null;
      });
      const teamPromise = loadTeamStatsWithFallback(SERVICE);

      const [leadsResp, perfResp, teamBundle] = await Promise.all([
        leadsPromise,
        perfPromise,
        teamPromise,
      ]);

      setLeads(mapLeadsResponse(leadsResp));
      setTeamStats(teamBundle.teamStats);
      setTeamStripStats(teamBundle.teamStripStats);

      if (perfResp && !(perfResp as { error?: string }).error) {
        const p = perfResp as Record<string, number>;
        setPerformance({
          converted: p.converted_count ?? 0,
          renewed: p.renewed_count ?? 0,
          in_progress: p.contacted_count ?? 0,
          not_contacted: p.not_contacted_count ?? 0,
          lost: p.lost_count ?? 0,
          success_rate: p.success_rate ?? 0,
          renewed_directly: p.renewed_directly_count ?? 0,
          end_date_changed: p.end_date_changed_count ?? 0,
          priced: p.priced_count ?? 0,
        });
      } else {
        setPerformance(null);
      }
    } catch (e: unknown) {
      console.error("Dashboard leads load error:", e);
      const msg = e instanceof Error ? e.message : "Failed to load leads";
      setError(msg);
      setLeads([]);
      setTeamStats([]);
      setTeamStripStats([]);
      setPerformance(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="font-semibold">Could not load leads</p>
            <p className="mt-1 text-red-800/90">{error}</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => load()}>
              Try again
            </Button>
          </div>
        </div>
      )}

      <LeadsTeamPerformanceStrip
        stats={teamStripStats}
        loading={loading}
        isAdmin={isAdmin}
        myLeadCount={leads.length}
      />

      <LeadsDashboardOverview
        leads={leads}
        performance={performance}
        teamStats={teamStats}
        loading={loading}
      />
      <LeadsDashboardTable leads={leads} loading={loading} employeeId={employeeId} />
    </div>
  );
}
