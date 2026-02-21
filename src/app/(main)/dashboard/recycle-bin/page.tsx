"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchWithAuth } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { RotateCcw } from "lucide-react";

type LostCase = {
  opportunity_id: number;
  business_name: string | null;
  contact_person: string | null;
  tel_number: string | null;
  email: string | null;
  voa_reference: string | null;       // was mpan_mpr
  billing_authority?: string | null;  // was supplier
  case_opened_date: string | null;    // was start_date
  appeal_deadline?: string | null;
  case_stage?: string | null;
  stage_name: string | null;
  stage_id?: number;
  created_at: string | null;
};

const DAYS_UNTIL_DELETE = 30;

const getDaysRemaining = (createdAt?: string | null): number | null => {
  if (!createdAt) return null;
  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) return null;
  const elapsedDays = Math.floor((Date.now() - createdTime) / (1000 * 60 * 60 * 24));
  return Math.max(DAYS_UNTIL_DELETE - elapsedDays, 0);
};

export default function RecycleBinPage() {
  const { loading: authLoading } = useAuth();
  const [rows, setRows] = useState<LostCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkStageId, setCheckStageId] = useState<number | null>(null);
  const [restoringIds, setRestoringIds] = useState<Record<number, boolean>>({});

  const loadLostCases = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use the dedicated recycle bin endpoint (returns Lost stage only)
      const data = await fetchWithAuth("/api/crm/leads/recycle-bin");
      const lostCases = Array.isArray(data.data) ? data.data : [];
      setRows(lostCases);

      // Resolve Check stage ID for restoration if not already cached
      if (!checkStageId) {
        const stagesData = await fetchWithAuth("/api/crm/stages");
        const checkStage = (stagesData.data || []).find(
          (s: any) => s.stage_name?.toLowerCase() === "check"
        );
        if (checkStage?.stage_id) {
          setCheckStageId(checkStage.stage_id);
        } else {
          console.warn("Check stage not found in Stage_Master");
        }
      }

    } catch (err: any) {
      console.error("Recycle bin: fetch error", err);
      setError(err.message || "Failed to load lost cases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) loadLostCases();
  }, [authLoading]);

  const handleRestore = async (lostCase: LostCase) => {
    if (!checkStageId) {
      setError("Check stage not available. Please refresh.");
      return;
    }

    setRestoringIds(prev => ({ ...prev, [lostCase.opportunity_id]: true }));

    try {
      await fetchWithAuth(`/api/crm/leads/${lostCase.opportunity_id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: checkStageId, status: "check" }),
      });

      setRows(prev => prev.filter(r => r.opportunity_id !== lostCase.opportunity_id));

    } catch (err: any) {
      console.error(`Failed to restore case ${lostCase.opportunity_id}:`, err);
      setError(err.message || "Failed to restore case");
    } finally {
      setRestoringIds(prev => ({ ...prev, [lostCase.opportunity_id]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recycle Bin</CardTitle>
              <CardDescription>
                Lost cases are held here for 30 days before permanent deletion.
                Restore a case to move it back to the Check stage.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadLostCases}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-64 animate-pulse bg-gray-100 rounded" />
          ) : error ? (
            <div className="text-center text-sm text-destructive">{error}</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No lost cases in recycle bin.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium min-w-[80px]">ID</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[180px]">Business Name</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[160px]">Contact Person</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[140px]">Tel Number</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[200px]">Email</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[140px]">VOA Reference</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[140px]">Billing Authority</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[130px]">Case Opened</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[180px]">Deletion</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[140px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const daysLeft = getDaysRemaining(r.created_at);
                    return (
                      <tr key={r.opportunity_id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm">{r.opportunity_id}</td>
                        <td className="p-3 text-sm font-medium">{r.business_name || "—"}</td>
                        <td className="p-3 text-sm">{r.contact_person || "—"}</td>
                        <td className="p-3 text-sm">{r.tel_number || "—"}</td>
                        <td className="p-3 text-sm">{r.email || "—"}</td>
                        <td className="p-3 text-sm font-mono">{r.voa_reference || "—"}</td>
                        <td className="p-3 text-sm">{r.billing_authority || "—"}</td>
                        <td className="p-3 text-sm">
                          {r.case_opened_date
                            ? format(new Date(r.case_opened_date), "dd/MM/yyyy")
                            : "—"}
                        </td>
                        <td className="p-3 text-sm text-red-600">
                          {daysLeft === null ? "—" : `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`}
                        </td>
                        <td className="p-3 text-sm">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestore(r)}
                            disabled={restoringIds[r.opportunity_id]}
                            className="gap-2"
                          >
                            <RotateCcw className="h-4 w-4" />
                            {restoringIds[r.opportunity_id] ? "Restoring..." : "Restore"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}