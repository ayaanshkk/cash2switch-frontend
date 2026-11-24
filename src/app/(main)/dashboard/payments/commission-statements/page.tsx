"use client";

import { useEffect, useState, useCallback } from "react";
import { Download, Eye, FileText, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchWithAuth } from "@/lib/api";

const PER_PAGE = 20;

interface Statement {
  id: string;
  agent_name: string;
  generated_by_name: string;
  generated_at: string;
  file_name: string;
  receipt_count: number;
  total_commission: number;
  batch_id: string | null;
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CommissionStatementsPage() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [agents, setAgents] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedAgent, setSelectedAgent] = useState("all");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [selectedAgent]);

  const fetchAgents = useCallback(async () => {
    try {
      const data = await fetchWithAuth("/api/commission/statements/agents");
      setAgents(data.agents || []);
    } catch {
      // silent
    }
  }, []);

  const fetchStatements = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(PER_PAGE),
      });
      if (selectedAgent !== "all") params.set("agent_name", selectedAgent);
      const data = await fetchWithAuth(`/api/commission/statements?${params}`);
      setStatements(data.statements || []);
      setTotal(data.total || 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, selectedAgent]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  useEffect(() => {
    fetchStatements();
  }, [fetchStatements]);

  async function getDownloadUrl(id: string): Promise<string | null> {
    const data = await fetchWithAuth(`/api/commission/statements/${id}/download`);
    return data.download_url as string;
  }

  async function handleDownload(id: string, fileName: string) {
    if (downloading) return;
    setDownloading(id);
    try {
      const url = await getDownloadUrl(id);
      if (!url) throw new Error("No URL");
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.target = "_blank";
      a.click();
    } catch {
      alert("Could not download the statement. Please try again.");
    } finally {
      setDownloading(null);
    }
  }

  async function handleView(id: string) {
    if (downloading) return;
    setDownloading(id);
    try {
      const url = await getDownloadUrl(id);
      if (url) window.open(url, "_blank");
    } catch {
      alert("Could not open the statement. Please try again.");
    } finally {
      setDownloading(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Commission Statements
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            All generated commission statements saved to the system
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchAgents(); fetchStatements(); }} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Agent filter */}
      <div className="w-64">
        <Select value={selectedAgent} onValueChange={setSelectedAgent}>
          <SelectTrigger>
            <SelectValue placeholder="All Agents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-sm">
          <colgroup>
            <col className="w-[20%]" />
            <col className="w-[20%]" />
            <col className="w-[25%]" />
            <col className="w-[10%]" />
            <col className="w-[15%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Agent</th>
              <th className="text-left px-4 py-3 font-medium">Generated By</th>
              <th className="text-left px-4 py-3 font-medium">Date &amp; Time</th>
              <th className="text-left px-4 py-3 font-medium">Receipts</th>
              <th className="text-left px-4 py-3 font-medium">Total Commission</th>
              <th className="text-left px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-slate-400">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading statements…
                </td>
              </tr>
            ) : statements.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-slate-400">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  {selectedAgent !== "all" ? `No statements found for ${selectedAgent}.` : "No statements saved yet."}
                  <p className="text-xs mt-1">Statements are saved automatically when downloaded from Agent Commissions.</p>
                </td>
              </tr>
            ) : (
              statements.map((s, i) => (
                <tr
                  key={s.id}
                  className={`border-t border-slate-100 dark:border-slate-700 ${
                    i % 2 === 0 ? "" : "bg-slate-50/50 dark:bg-slate-800/30"
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                    {s.agent_name || "—"}
                    {s.batch_id && (
                      <span className="ml-2">
                        <Badge variant="outline" className="text-xs">Batch</Badge>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {s.generated_by_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {s.generated_at ? fmtDate(s.generated_at) : "—"}
                  </td>
                  <td className="px-4 py-3 text-left text-slate-600 dark:text-slate-300">
                    {s.receipt_count ?? 0}
                  </td>
                  <td className="px-4 py-3 text-left font-medium text-slate-900 dark:text-slate-100">
                    {fmt(s.total_commission)}
                  </td>
                  <td className="px-4 py-3 text-left">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!!downloading}
                        onClick={() => handleView(s.id)}
                        title="View PDF"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!!downloading}
                        onClick={() => handleDownload(s.id, s.file_name)}
                        title="Download"
                      >
                        <Download className={`h-4 w-4 mr-1 ${downloading === s.id ? "animate-pulse" : ""}`} />
                        Download
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > PER_PAGE && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
