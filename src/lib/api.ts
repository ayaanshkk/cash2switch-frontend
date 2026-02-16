// ================= BASE CONFIG =================

// Frontend base path (Vercel subpath support)
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Backend URL (Render in production, localhost in dev)
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

// Next.js routes ONLY for auth
const AUTH_API_ROOT = `${BASE_PATH}/api`;

// All data endpoints go directly to backend
const DATA_API_ROOT = BACKEND_URL;

if (typeof window !== "undefined") {
  console.log("🌐 API CONFIG:", { AUTH_API_ROOT, DATA_API_ROOT });
}

// ================= HELPERS =================

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err: any) {
    clearTimeout(id);
    if (err.name === "AbortError") {
      throw new Error("Server timeout (cold start)");
    }
    throw err;
  }
}

async function handleApiResponse(response: Response) {
  const contentType = response.headers.get("content-type");

  if (!response.ok) {
    if (contentType?.includes("application/json")) {
      const data = await response.json();
      throw new Error(data.message || data.error || "API error");
    }
    throw new Error(`Request failed: ${response.status}`);
  }

  if (contentType?.includes("application/json")) {
    return response.json();
  }

  return { success: true };
}

// ================= AUTH CALLS (NEXT ROUTES) =================

export async function fetchPublic(path: string, options: RequestInit = {}) {
  const url = `${AUTH_API_ROOT}${path}`;
  return fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
}

// ================= BACKEND CALLS =================

export async function fetchWithAuth(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem("auth_token");
  const tenantId = localStorage.getItem("tenant_id") || "1";

  if (!token) throw new Error("Not authenticated");

  const url = `${DATA_API_ROOT}${path}`;

  console.log("📡 BACKEND CALL:", url);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "X-Tenant-ID": tenantId, // ✅ Always send for ALL endpoints
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetchWithTimeout(
    url,
    {
      ...options,
      headers,
    },
    30000
  );

  return handleApiResponse(response);
}

// ================= API METHODS =================

export const api = {
  // AUTH
  async login(username: string, password: string, tenant_id: number = 1) {
    const res = await fetchPublic("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password, tenant_id }),
    });

    const data = await handleApiResponse(res);

    localStorage.setItem("tenant_id", tenant_id.toString());
    return data;
  },

  // CLIENTS
  getCustomers: () => fetchWithAuth("/clients"),

  // LEADS
  getLeads: () => fetchWithAuth("/api/crm/leads"),

  updateLeadStatus: (id: number, stage_id: number) =>
    fetchWithAuth(`/api/crm/leads/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ stage_id }),
    }),

  importLeads: (formData: FormData) =>
    fetch(`${DATA_API_ROOT}/api/crm/leads/import`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("auth_token")}`,
        "X-Tenant-ID": localStorage.getItem("tenant_id") || "1",
      },
      body: formData,
    }),

  // RENEWALS
  getRenewals: () => fetchWithAuth("/clients"),

  // ASSIGNMENTS
  getAssignments: () => fetchWithAuth("/assignments"),

  // DOCUMENTS
  uploadDocument: async (formData: FormData) => {
    const token = localStorage.getItem("auth_token");
    const tenantId = localStorage.getItem("tenant_id") || "1";

    if (!token) throw new Error("Not authenticated");

    const url = `${DATA_API_ROOT}/api/crm/documents/upload`;
    
    console.log("📡 Uploading document to:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Tenant-ID": tenantId,
        // ✅ Don't set Content-Type - let browser set it with boundary
      },
      body: formData,
    });

    // ✅ Check if response is OK before parsing
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Upload failed:", errorData);
      throw new Error(errorData.message || errorData.error || `Upload failed: ${response.status}`);
    }

    return response.json();
  },

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