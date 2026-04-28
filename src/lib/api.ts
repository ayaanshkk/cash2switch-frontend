// lib/api.ts

// ================= BASE CONFIG =================
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5000";
export const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5000";
const DEFAULT_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || 60000);
const DEFAULT_TENANT_ID = String(process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 2);

if (typeof window !== "undefined") {
  console.log("🌐 API_BASE_URL:", API_BASE_URL);
}

/** Dev-only hint when the wrong Flask app is bound to this port (e.g. c2s-backend vs cash2switch-backend). */
function crmBackendMismatchHint(fullUrl: string, status: number): string {
  if (typeof window === "undefined" || process.env.NODE_ENV === "production") return "";
  if (status !== 404) return "";
  try {
    const p = new URL(fullUrl).pathname;
    if (
      p.includes("/api/crm") ||
      p.includes("/energy-") ||
      p.includes("/energy-clients") ||
      p.startsWith("/employees") ||
      p.startsWith("/suppliers") ||
      p.startsWith("/stages") ||
      p.includes("/notifications/")
    ) {
      return " This path is served by Cash2Switch/cash2switch-backend — if you started c2s-backend on port 5000, stop it and run cash2switch-backend (see start-cash2switch-backend.ps1).";
    }
  } catch {
    /* ignore */
  }
  return "";
}

// ================= REQUEST DEDUPLICATION =================
const pendingRequests = new Map<string, Promise<any>>();

function getRequestKey(url: string, options: RequestInit = {}): string {
  const method = options.method || 'GET';
  const body = options.body ? JSON.stringify(options.body) : '';
  return `${method}:${url}:${body}`;
}

/** Browser / proxy closed the socket or DB dropped mid-request — safe to retry GET once */
function isTransientNetworkError(err: unknown): boolean {
  const m = String((err as Error)?.message || err || "").toLowerCase();
  return (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("network request failed") ||
    m.includes("load failed") ||
    m.includes("connection") ||
    m.includes("terminated") ||
    m.includes("unexpectedly") ||
    m.includes("econnreset") ||
    m.includes("aborted")
  );
}

// ================= BACKEND CALLS =================
export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
  const tenantId = localStorage.getItem("tenant_id");

  // ✅ Set default tenant if missing
  if (!tenantId) {
    console.warn(`⚠️ No tenant_id found - setting default to '${DEFAULT_TENANT_ID}'`);
    localStorage.setItem("tenant_id", DEFAULT_TENANT_ID);
  }

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
  headers["X-Tenant-ID"] = tenantId || DEFAULT_TENANT_ID;

  const isNextRewritePath = url.startsWith("/backend-api/");
  const fullUrl = (url.startsWith("http") || isNextRewritePath) ? url : `${API_BASE_URL}${url}`;

  // ⭐ DEDUPLICATION: Check if identical request is in flight
  const requestKey = getRequestKey(fullUrl, options);
  if (pendingRequests.has(requestKey)) {
    console.log("⚡ Reusing in-flight request:", requestKey);
    return pendingRequests.get(requestKey);
  }

  const method = (options.method || "GET").toUpperCase();
  const timeoutMsFromOptions = Number((options as any)?.timeoutMs);
  const timeoutMs = Number.isFinite(timeoutMsFromOptions) && timeoutMsFromOptions > 0
    ? timeoutMsFromOptions
    : DEFAULT_TIMEOUT_MS;

  const requestOptions: RequestInit = { ...options };
  delete (requestOptions as any).timeoutMs;

  // ⭐ Create the request promise
  const requestPromise = (async () => {
    const runRequest = async (effectiveTimeoutMs: number) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), effectiveTimeoutMs);

      try {
        let response: Response;
        try {
          response = await fetch(fullUrl, {
            ...requestOptions,
            headers,
            signal: controller.signal,
          });
        } catch (err: any) {
          if (err?.name === "AbortError") {
            throw new Error(`Request timed out after ${Math.ceil(effectiveTimeoutMs / 1000)}s`);
          }
          throw err;
        }

        const contentType = response.headers.get("content-type");
        const data = contentType?.includes("application/json")
          ? await response.json()
          : response;

        if (!response.ok) {
          const baseMsg =
            typeof data === "object" && (data?.message || data?.error)
              ? (data.message || data.error)
              : `Request failed: ${response.status}`;
          const msg = baseMsg + crmBackendMismatchHint(fullUrl, response.status);
          if (
            response.status === 401 &&
            typeof window !== "undefined" &&
            /token|auth|unauthorized/i.test(String(msg))
          ) {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("token");
            localStorage.removeItem("auth_user");
            localStorage.removeItem("user_role");
            document.cookie = "auth-token=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;";
            if (!window.location.pathname.includes("/login")) {
              window.location.assign("/login");
            }
          }
          throw new Error(msg);
        }

        return data;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    try {
      try {
        return await runRequest(timeoutMs);
      } catch (err: any) {
        const timedOut = typeof err?.message === "string" && err.message.startsWith("Request timed out");
        if (method === "GET" && timedOut) {
          const retryTimeoutMs = Math.max(timeoutMs, 90000);
          console.warn(`⚠️ Retrying GET request after timeout (${Math.ceil(retryTimeoutMs / 1000)}s):`, fullUrl);
          return await runRequest(retryTimeoutMs);
        }
        if (method === "GET" && isTransientNetworkError(err)) {
          console.warn("⚠️ Retrying GET after transient network error:", fullUrl);
          return await runRequest(timeoutMs);
        }
        throw err;
      }
    } finally {
      // ⭐ Remove from pending requests after completion
      pendingRequests.delete(requestKey);
    }
  })();

  // ⭐ Store the pending request
  pendingRequests.set(requestKey, requestPromise);

  return requestPromise;
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

  const isNextRewritePath = url.startsWith("/backend-api/");
  const fullUrl = (url.startsWith("http") || isNextRewritePath) ? url : `${API_BASE_URL}${url}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

  const response = await fetch(fullUrl, {
    ...options,
    headers,
    signal: controller.signal,
  });

  clearTimeout(timeoutId);

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
  // ==================== AUTH ====================
  async login(username: string, password: string, tenant_id: number = Number(DEFAULT_TENANT_ID)) {
    localStorage.setItem("tenant_id", tenant_id.toString());
    console.log("✅ Setting tenant_id:", tenant_id);
    
    const res = await fetchPublic("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password, tenant_id }),
      headers: { "Content-Type": "application/json" },
    });
    
    const storedTenantId = localStorage.getItem("tenant_id");
    console.log("✅ Verified tenant_id after login:", storedTenantId);
    
    return res;
  },

  // ==================== CLIENTS / RENEWALS ====================
  getCustomers: () => fetchWithAuth("/clients"),
  getRenewals: () => fetchWithAuth("/clients"),

  // ==================== LEADS ====================
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

  // ==================== EMPLOYEES ====================
  getEmployees: () => fetchWithAuth("/employees"),

  // ==================== ASSIGNMENTS ====================
  getAssignments: () => fetchWithAuth("/assignments"),

  // ==================== DOCUMENTS ====================
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

  // ==================== CALENDAR ====================
  getContractSchedule: () => fetchWithAuth("/backend-api/api/calendar/contracts"),
  getCalendarClients: () => fetchWithAuth("/backend-api/api/calendar/clients"),
  getCalendarEmployees: () => fetchWithAuth("/backend-api/api/calendar/employees"),
  
  getCalendarRenewals: (employeeId?: number) => {
    const params = new URLSearchParams();
    if (employeeId !== undefined) {
      params.append('employee_id', employeeId.toString());
    }
    const url = `/backend-api/api/calendar/renewals${params.toString() ? '?' + params.toString() : ''}`;
    console.log("📡 Calendar API URL:", url);
    return fetchWithAuth(url, { timeoutMs: 120000 } as RequestInit & { timeoutMs: number });
  },

  getCalendarLeads: (employeeId?: number, service = 'utilities') => {
    const params = new URLSearchParams({ service });
    if (employeeId) params.set('employee_id', String(employeeId));
    return fetchWithAuth(`/backend-api/api/calendar/leads?${params}`, { timeoutMs: 120000 } as RequestInit & { timeoutMs: number });
  },

  // ==================== NOTIFICATIONS ====================
  getNotifications: () => fetchWithAuth("/notifications/production"),
  
  markNotificationAsRead: (id: string) =>
    fetchWithAuth(`/notifications/mark-read/${id}`, {
      method: "PATCH",
    }),

  markAllNotificationsAsRead: () =>
    fetchWithAuth("/notifications/mark-all-read", {
      method: "PATCH",
    }),

  dismissNotification: (id: string) =>
    fetchWithAuth(`/notifications/dismiss/${id}`, {
      method: "PATCH",
    }),

  deleteNotification: (id: string) =>
    fetchWithAuth(`/notifications/delete/${id}`, {
      method: "DELETE",
    }),

  clearAllNotifications: () =>
    fetchWithAuth("/notifications/clear-all", {
      method: "DELETE",
    }),
};
