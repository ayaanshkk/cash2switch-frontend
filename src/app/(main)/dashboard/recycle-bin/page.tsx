"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fetchWithAuth } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { RotateCcw } from "lucide-react";

type DeletedLead = {
  opportunity_id: number;
  business_name: string | null;
  contact_person: string | null;
  tel_number: string | null;
  email: string | null;
  mpan_mpr: string | null;
  start_date: string | null;
  stage_name: string | null;
  stage_id?: number;
  created_at: string | null;
};

const DAYS_UNTIL_DELETE = 30;

const getDaysRemaining = (createdAt?: string | null): number | null => {
  if (!createdAt) return null;
  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) return null;
  const now = Date.now();
  const elapsedDays = Math.floor((now - createdTime) / (1000 * 60 * 60 * 24));
  return Math.max(DAYS_UNTIL_DELETE - elapsedDays, 0);
};

export default function RecycleBinPage() {
  const { loading: authLoading } = useAuth();
  const [rows, setRows] = useState<DeletedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notCalledStageId, setNotCalledStageId] = useState<number | null>(null);
  const [restoringIds, setRestoringIds] = useState<Record<number, boolean>>({});

  const loadDeletedLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("🔄 Loading deleted leads...");
      
      // ✅ FIX: Use /api/crm/leads instead of /crm/leads
      const leadsData = await fetchWithAuth("/api/crm/leads");
      console.log("📊 Leads response:", leadsData);
      
      const allLeads = Array.isArray(leadsData.data) ? leadsData.data : [];
      
      // Filter for "Lost" stage leads
      const deletedLeads = allLeads.filter((lead: any) => 
        lead.stage_name?.toLowerCase() === "lost"
      );
      
      console.log(`🗑️ Found ${deletedLeads.length} deleted leads`);
      setRows(deletedLeads);
      
      // Find "Not Called" stage ID for restoration
      if (!notCalledStageId) {
        const notCalledLead = allLeads.find((lead: any) => 
          lead.stage_name?.toLowerCase() === "not called"
        );
        if (notCalledLead?.stage_id) {
          setNotCalledStageId(notCalledLead.stage_id);
          console.log("✅ Not Called stage ID:", notCalledLead.stage_id);
        } else {
          console.warn("⚠️ Not Called stage not found in leads");
        }
      }
      
    } catch (err: any) {
      console.error("❌ Recycle bin: fetch error", err);
      setError(err.message || "Failed to load deleted leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadDeletedLeads();
    }
  }, [authLoading]);

  const handleRestore = async (lead: DeletedLead) => {
    if (!notCalledStageId) {
      setError("Not Called stage not available. Please refresh.");
      return;
    }
    
    setRestoringIds(prev => ({ ...prev, [lead.opportunity_id]: true }));
    
    try {
      console.log(`🔄 Restoring lead ${lead.opportunity_id} to stage ${notCalledStageId}`);
      
      // ✅ FIX: Use /api/crm/leads instead of /crm/leads
      await fetchWithAuth(`/api/crm/leads/${lead.opportunity_id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ stage_id: notCalledStageId })
      });

      console.log(`✅ Lead ${lead.opportunity_id} restored successfully`);

      // Update localStorage with restored lead
      try {
        const key = "restored_lead_ids";
        const raw = localStorage.getItem(key);
        const ids = new Set<number>((raw ? JSON.parse(raw) : []) as number[]);
        ids.add(lead.opportunity_id);
        localStorage.setItem(key, JSON.stringify(Array.from(ids)));
        window.dispatchEvent(new Event("restored-leads-updated"));
      } catch {
        // ignore storage errors
      }

      // Remove from list
      setRows(prev => prev.filter(r => r.opportunity_id !== lead.opportunity_id));
      
    } catch (err: any) {
      console.error(`❌ Failed to restore lead ${lead.opportunity_id}:`, err);
      setError(err.message || "Failed to restore lead");
    } finally {
      setRestoringIds(prev => ({ ...prev, [lead.opportunity_id]: false }));
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
                Lost leads are shown here. They will be permanently removed after 30 days.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadDeletedLeads}>
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid gap-3">
              <div className="h-64 animate-pulse bg-gray-100 rounded" />
            </div>
          ) : error ? (
            <div className="text-center text-sm text-destructive">{error}</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No deleted leads in recycle bin.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium min-w-[80px]">ID</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[160px]">Contact Person</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[180px]">Business Name</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[140px]">Tel Number</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[200px]">Email</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[140px]">MPAN/MPR</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[130px]">Start Date</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[180px]">Deletion</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[140px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.opportunity_id} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-sm min-w-[80px]">{r.opportunity_id}</td>
                      <td className="p-3 text-sm min-w-[160px]">{r.contact_person || "—"}</td>
                      <td className="p-3 text-sm min-w-[180px]">{r.business_name || "—"}</td>
                      <td className="p-3 text-sm min-w-[140px]">{r.tel_number || "—"}</td>
                      <td className="p-3 text-sm min-w-[200px]">{r.email || "—"}</td>
                      <td className="p-3 text-sm min-w-[140px]">{r.mpan_mpr || "—"}</td>
                      <td className="p-3 text-sm min-w-[130px]">
                        {r.start_date
                          ? format(new Date(r.start_date), "dd/MM/yyyy")
                          : "—"}
                      </td>
                      <td className="p-3 text-sm min-w-[180px] text-red-600">
                        {(() => {
                          const daysLeft = getDaysRemaining(r.created_at);
                          return daysLeft === null ? "—" : `${daysLeft} days remaining`;
                        })()}
                      </td>
                      <td className="p-3 text-sm min-w-[140px]">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(r)}
                          disabled={restoringIds[r.opportunity_id]}
                          className="gap-2"
                        >
                          <RotateCcw className="h-4 w-4" />
                          Restore
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}