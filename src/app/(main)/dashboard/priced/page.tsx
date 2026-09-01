"use client";

import { useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "react-hot-toast";
import { fetchWithAuth } from "@/lib/api";
import { Check, RefreshCw, Users, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type PricedType = "leads" | "renewals";

type Employee = {
  employee_id: number;
  employee_name: string;
};

type PricedRecord = {
  source: PricedType;
  id: number;
  display_id?: number | null;
  business_name?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  mpan_mpr?: string | null;
  supplier_name?: string | null;
  annual_usage?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  assigned_to_id?: number | null;
  assigned_to_name?: string | null;
  created_at?: string | null;
};

const service = "utilities";

const formatDate = (dateString?: string | null) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("en-GB");
};

const normalizeLead = (lead: any): PricedRecord => ({
  source: "leads",
  id: lead.opportunity_id,
  display_id: lead.display_order ?? lead.tenant_lead_id ?? lead.opportunity_id,
  business_name: lead.business_name,
  contact_person: lead.contact_person,
  phone: lead.tel_number ?? lead.phone,
  email: lead.email,
  mpan_mpr: lead.mpan_mpr,
  supplier_name: lead.supplier_name,
  annual_usage: Number(lead.annual_usage || 0),
  start_date: lead.start_date,
  end_date: lead.end_date,
  assigned_to_id: lead.assigned_to_id ?? lead.opportunity_owner_employee_id,
  assigned_to_name: lead.assigned_to_name,
  created_at: lead.created_at,
});

const normalizeRenewal = (renewal: any): PricedRecord => ({
  source: "renewals",
  id: renewal.client_id,
  display_id: renewal.display_id ?? renewal.tenant_client_id ?? renewal.id ?? renewal.client_id,
  business_name: renewal.business_name,
  contact_person: renewal.contact_person,
  phone: renewal.phone ?? renewal.tel_number,
  email: renewal.email,
  mpan_mpr: renewal.mpan_mpr ?? renewal.mpan_top,
  supplier_name: renewal.supplier_name,
  annual_usage: Number(renewal.annual_usage || 0),
  start_date: renewal.start_date,
  end_date: renewal.end_date,
  assigned_to_id: renewal.assigned_to_id,
  assigned_to_name: renewal.assigned_to_name,
  created_at: renewal.created_at,
});

export default function PricedPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "Platform Admin" || user?.role === "Tenant Super Admin";

  const [activeTab, setActiveTab] = useState<PricedType>("leads");
  const [leads, setLeads] = useState<PricedRecord[]>([]);
  const [renewals, setRenewals] = useState<PricedRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<number | "all">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const fetchEmployees = async () => {
    try {
      const response = await fetchWithAuth("/employees");
      setEmployees(Array.isArray(response?.data) ? response.data : Array.isArray(response) ? response : []);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchPriced = async () => {
    try {
      setLoading(true);
      const pricedResponse = await fetchWithAuth(
        `/api/crm/priced?service=${encodeURIComponent(service)}`
      );

      const leadRows = Array.isArray(pricedResponse?.leads) ? pricedResponse.leads : [];
      const renewalRows = Array.isArray(pricedResponse?.renewals) ? pricedResponse.renewals : [];

      setLeads(leadRows.map(normalizeLead));
      setRenewals(renewalRows.map(normalizeRenewal));
    } catch (error) {
      console.error("Error fetching priced records:", error);
      toast.error("Failed to fetch priced records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPriced();
    if (isAdmin) fetchEmployees();
  }, [isAdmin]);

  const activeRecords = activeTab === "leads" ? leads : renewals;

  const filteredRecords = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return activeRecords.filter((record) => {
      const employeeMatch = selectedEmployee === "all" || record.assigned_to_id === selectedEmployee;
      const searchMatch =
        !search ||
        record.business_name?.toLowerCase().includes(search) ||
        record.contact_person?.toLowerCase().includes(search) ||
        record.phone?.toLowerCase().includes(search) ||
        record.email?.toLowerCase().includes(search) ||
        record.mpan_mpr?.toLowerCase().includes(search) ||
        record.supplier_name?.toLowerCase().includes(search);

      return employeeMatch && searchMatch;
    });
  }, [activeRecords, searchTerm, selectedEmployee]);

  const statsRecords = selectedEmployee === "all"
    ? activeRecords
    : activeRecords.filter((record) => record.assigned_to_id === selectedEmployee);

  const totalAq = statsRecords.reduce((sum, record) => sum + Number(record.annual_usage || 0), 0);

  const completePricedRecord = async (record: PricedRecord, action: "accept" | "reject") => {
    const actionLabel = action === "accept" ? "move to renewals" : "move to lost";
    const confirmed = confirm(`Are you sure you want to ${actionLabel} "${record.business_name || "this record"}"?`);
    if (!confirmed) return;

    const key = `${record.source}-${record.id}-${action}`;
    setBusyKey(key);

    try {
      await fetchWithAuth(`/api/crm/priced/${record.source}/${record.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (record.source === "leads") {
        setLeads((prev) => prev.filter((item) => item.id !== record.id));
      } else {
        setRenewals((prev) => prev.filter((item) => item.id !== record.id));
      }

      toast.success(action === "accept" ? "Moved to renewals" : "Moved to lost");
    } catch (error: any) {
      console.error(`Failed to ${action} priced record:`, error);
      toast.error(error?.message || `Failed to ${actionLabel}`);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Toaster position="top-right" />
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-black">Priced</h1>
        <p className="text-gray-600 mt-1">Review priced leads and renewals before onboarding or moving to lost.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Total Priced {activeTab === "leads" ? "Leads" : "Renewals"}</div>
          <div className="text-3xl font-bold text-black">{statsRecords.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
          <div className="text-sm text-gray-600 mb-1">Total AQ (kWh)</div>
          <div className="text-3xl font-bold text-black">{totalAq.toLocaleString()}</div>
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4 mb-6 border border-gray-200">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            <button onClick={() => setActiveTab("leads")} className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === "leads" ? "bg-black text-white" : "text-black hover:bg-gray-100"}`}>
              Leads ({leads.length})
            </button>
            <button onClick={() => setActiveTab("renewals")} className={`px-4 py-2 rounded-md text-sm font-medium ${activeTab === "renewals" ? "bg-black text-white" : "text-black hover:bg-gray-100"}`}>
              Renewals ({renewals.length})
            </button>
          </div>
          <input type="text" placeholder={`Search priced ${activeTab}...`} value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="min-w-[260px] flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-black" />
          <button onClick={fetchPriced} className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>
      {isAdmin && employees.length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Users className="h-5 w-5 text-black" />
            <span className="text-sm font-medium text-black">Filter by Salesperson</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSelectedEmployee("all")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedEmployee === "all" ? "bg-black text-white" : "bg-gray-100 text-black hover:bg-gray-200"}`}>All Salespeople</button>
            {employees.map((employee) => (
              <button key={employee.employee_id} onClick={() => setSelectedEmployee(employee.employee_id)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedEmployee === employee.employee_id ? "bg-black text-white" : "bg-gray-100 text-black hover:bg-gray-200"}`}>
                {employee.employee_name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        {loading ? (
          <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black" /></div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-xl mb-2">No priced {activeTab} found</div>
            <p className="text-gray-500">Records with Priced status will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["ID", "Business Name", "Contact Person", "Phone", "Email", "MPAN/MPR", "Supplier", "Annual Usage", "Assigned To", "Date", "Actions"].map((heading) => (
                    <th key={heading} className={`px-4 py-3 text-xs font-medium text-black uppercase tracking-wider ${heading === "Actions" ? "text-center" : "text-left"}`}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRecords.map((record) => (
                  <tr key={`${record.source}-${record.id}`} className="hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm text-black">{record.display_id || record.id}</td>
                    <td className="px-4 py-4 text-sm font-medium text-black">{record.business_name || "-"}</td>
                    <td className="px-4 py-4 text-sm text-black">{record.contact_person || "-"}</td>
                    <td className="px-4 py-4 text-sm text-black">{record.phone || "-"}</td>
                    <td className="px-4 py-4 text-sm text-black">{record.email || "-"}</td>
                    <td className="px-4 py-4 text-sm text-black">{record.mpan_mpr || "-"}</td>
                    <td className="px-4 py-4 text-sm text-black">{record.supplier_name || "-"}</td>
                    <td className="px-4 py-4 text-sm text-black">{record.annual_usage ? `${Number(record.annual_usage).toLocaleString()} kWh` : "-"}</td>
                    <td className="px-4 py-4 text-sm text-black">{record.assigned_to_name || "Unassigned"}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{formatDate(record.created_at)}</td>
                    <td className="px-4 py-4 text-sm">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => completePricedRecord(record, "accept")} disabled={busyKey === `${record.source}-${record.id}-accept`} className="p-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50" title="Onboard and move to renewals">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={() => completePricedRecord(record, "reject")} disabled={busyKey === `${record.source}-${record.id}-reject`} className="p-2 bg-gray-200 text-black rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50" title="Move to lost">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}