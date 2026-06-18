// lib/api.ts

// ================= BASE CONFIG =================
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5000";
export const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:5000";
const DEFAULT_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || 60000);

if (typeof window !== "undefined") {
  console.log("🌐 API_BASE_URL:", API_BASE_URL);
}

// ================= REQUEST DEDUPLICATION =================
const pendingRequests = new Map<string, Promise<any>>();

function getRequestKey(url: string, options: RequestInit = {}): string {
  const method = options.method || 'GET';
  // body is already a string (JSON.stringify'd by caller), don't double-stringify
  const body = options.body ? String(options.body) : '';
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
    console.warn("⚠️ No tenant_id found - setting default to '2'");
    localStorage.setItem("tenant_id", "2");
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
  headers["X-Tenant-ID"] = tenantId || "2";

  const isAbsoluteUrl = url.startsWith("http");
  const isProxyPath = url.startsWith("/backend-api/");
  const isAuthProxyPath = url.startsWith("/auth/");
  const isBackendApiPath =
    url.startsWith("/api/crm/") ||
    url.startsWith("/api/admin/") ||
    url.startsWith("/api/calendar/") ||
    url.startsWith("/api/task-status/");
  const isOtherNextApiPath = url.startsWith("/api/") && !isBackendApiPath;
  const isBackendRootPath = url.startsWith("/") && !isProxyPath && !isAuthProxyPath && !isOtherNextApiPath;

  // ✅ Declare method early so it can be used for URL routing
  const method = (options.method || "GET").toUpperCase();
  const isMutatingRequest = ["PATCH", "POST", "PUT", "DELETE"].includes(method);

  let fullUrl = url;
  if (isAbsoluteUrl || isProxyPath || isAuthProxyPath || isOtherNextApiPath) {
    fullUrl = url;
  } else if (isMutatingRequest && (isBackendApiPath || isBackendRootPath)) {
    // Bypass proxy — go direct to backend for writes
    fullUrl = `${API_BASE_URL}${url}`;
  } else if (isBackendApiPath || isBackendRootPath) {
    fullUrl = `/backend-api${url}`;
  } else {
    fullUrl = `${API_BASE_URL}${url}`;
  }

  console.log("🔗 fetchWithAuth URL:", fullUrl); // Debug logging

  // ⭐ DEDUPLICATION: Check if identical request is in flight
  const requestKey = getRequestKey(fullUrl, options);
  if (pendingRequests.has(requestKey)) {
    console.log("⚡ Reusing in-flight request:", requestKey);
    return pendingRequests.get(requestKey);
  }

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
          const msg =
            typeof data === "object" && (data?.message || data?.error)
              ? (data.message || data.error)
              : `Request failed: ${response.status}`;
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

  // ✅ CRITICAL FIX: Only /backend-api/ should be treated as proxy
  const isProxyPath = url.startsWith("/backend-api/");
  const fullUrl = (url.startsWith("http") || isProxyPath) ? url : `${API_BASE_URL}${url}`;

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
  async login(username: string, password: string, tenant_id: number = 2) {
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
