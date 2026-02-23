// ================= BASE CONFIG =================
// In browser: use /backend-api (proxied by Next.js) to avoid CORS / "Failed to fetch"
// On server: use explicit backend URL
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5000";
export const API_BASE_URL =
  typeof window !== "undefined"
    ? "/backend-api"  // Same-origin proxy - avoids CORS
    : BACKEND_URL;

if (typeof window !== "undefined") {
  console.log("🌐 API_BASE_URL:", API_BASE_URL);
}

// ================= BACKEND CALLS =================
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
  const tenantId = localStorage.getItem("tenant_id");

  const isFormData =
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (tenantId) headers["X-Tenant-ID"] = tenantId;

  // prepend backend url unless already absolute
  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type");
  const data = contentType?.includes("application/json") ? await response.json() : response;

  if (!response.ok) {
    const msg =
      typeof data === "object" && (data?.message || data?.error)
        ? (data.message || data.error)
        : `Request failed: ${response.status}`;
    throw new Error(msg);
  }
  return data;
}

// ================= PUBLIC CALLS (no auth required) =================
export async function fetchPublic(url: string, options: RequestInit = {}) {
  const isFormData =
    typeof FormData !== "undefined" &&
    options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const fullUrl = url.startsWith("http") ? url : `${API_BASE_URL}${url}`;

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  // For login endpoint, return Response object so caller can check status
  if (url.includes("/auth/login")) {
    return response;
  }

  // Parse JSON automatically for other endpoints
  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return await response.json();
  }
  return response;
}

// ================= API METHODS =================
export const api = {
  // AUTH
  async login(username: string, password: string, tenant_id: number = 1) {
    const res = await fetchPublic("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password, tenant_id }),
      headers: { "Content-Type": "application/json" },
    });
    localStorage.setItem("tenant_id", tenant_id.toString());
    return res;
  },

  // CLIENTS / RENEWALS
  getCustomers: () => fetchWithAuth("/clients"),
  getRenewals: () => fetchWithAuth("/clients"),

  // ✅ LEADS - matches your crm_routes blueprint
  getLeads: (service?: string) =>
    fetchWithAuth(`/api/crm/leads${service ? `?service=${encodeURIComponent(service)}` : ""}`),

  updateLeadStatus: (id: number, stage_id: number) =>
    fetchWithAuth(`/api/crm/leads/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ stage_id }),
    }),

  importLeads: async (formData: FormData, service?: string) => {
    const previewBody = await fetchWithAuth("/api/crm/leads/import/preview", {
      method: "POST",
      body: formData,
    });
    const rows = Array.isArray(previewBody?.rows) ? previewBody.rows : [];
    return fetchWithAuth(
      `/api/crm/leads/import/confirm${service ? `?service=${encodeURIComponent(service)}` : ""}`,
      {
        method: "POST",
        body: JSON.stringify(rows),
      }
    );
  },

  // ✅ EMPLOYEES - matches your crm_routes blueprint  
  getEmployees: () => fetchWithAuth("/employees"),

  // ASSIGNMENTS
  getAssignments: () => fetchWithAuth("/assignments"),

  // DOCUMENTS
  uploadDocument: (formData: FormData) => 
    fetchWithAuth("/api/crm/documents/upload", {
      method: "POST",
      body: formData,
    }),

  getDocuments: () => fetchWithAuth("/api/crm/documents"),

  deleteDocument: (publicId: string) =>
    fetchWithAuth("/api/crm/documents", {
      method: "DELETE",
      body: JSON.stringify({ public_id: publicId }),
    }),

  // CALENDAR
  getContractSchedule: () => fetchWithAuth("/api/calendar/contracts"),
  getCalendarClients: () => fetchWithAuth("/api/calendar/clients"),
  getCalendarEmployees: () => fetchWithAuth("/api/calendar/employees"),
  getCalendarRenewals: () => fetchWithAuth("/api/calendar/renewals"),
};