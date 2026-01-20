"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, FileDown } from "lucide-react";
import { fetchWithAuth } from "@/lib/api";
import { useRouter } from "next/navigation";
import { generateRecentLeadsData } from "@/app/(main)/dashboard/crm/_components/crm.config"; // ✅ Fixed path

export function RecentLeadsTable() {
  const router = useRouter();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const pipelineResponse = await fetchWithAuth("pipeline");
        if (pipelineResponse.ok) {
          const pipelineData = await pipelineResponse.json();
          const recentLeads = generateRecentLeadsData(pipelineData);
          setLeads(recentLeads);
        }
      } catch (error) {
        console.error("Error fetching leads:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="h-64 animate-pulse bg-gray-100 rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Leads</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Track and manage your latest leads and their status.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/clients")}>
              <Eye className="mr-2 h-4 w-4" />
              View All
            </Button>
            <Button variant="outline" size="sm">
              <FileDown className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 text-sm font-medium">Name</th>
                <th className="text-left p-3 text-sm font-medium">Email</th>
                <th className="text-left p-3 text-sm font-medium">Phone</th>
                <th className="text-left p-3 text-sm font-medium">Source</th>
                <th className="text-left p-3 text-sm font-medium">Added</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">
                    No recent leads found
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/dashboard/clients/${lead.id}`)}
                  >
                    <td className="p-3 text-sm">{lead.name}</td>
                    <td className="p-3 text-sm">{lead.email}</td>
                    <td className="p-3 text-sm">{lead.phone}</td>
                    <td className="p-3 text-sm">{lead.source}</td>
                    <td className="p-3 text-sm">{lead.lastActivity}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}