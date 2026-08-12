"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, ExternalLink, AlertCircle, Search } from "lucide-react";
import { api, fetchWithAuth } from "@/lib/api";
import { format } from "date-fns";

interface Renewal {
  id: string;
  customer_id: number;
  type: string;
  title: string;
  name: string;
  mpan: string;
  supplier: string;
  contract_start_date: string;
  contract_end_date: string;
  reminder_date: string;
  address: string;
  postcode: string;
  contact: string;
  email: string;
  phone: string;
  service_title: string;
  rates: string;
  notes: string;
  display_date: string;
  display_type: string;
  status: string;
  assigned_to?: string;
  is_overdue?: boolean;
}

interface Employee {
  id: number;
  full_name: string;
  email: string;
}

type CalendarView = "renewals" | "leads";
const CALENDAR_VIEW_STORAGE_KEY = "cash2switch_calendar_view";

/** Statuses that accept a callback/reminder date via POST /callback */
const CALLBACK_SCHEDULE_STATUSES = new Set([
  "Callback",
  "Not Answered",
  "Called",
  "Lost",
  "Already Renewed",
  "Broker in Place",
  "End Date Changed",
  "Email Only",
  "Renewed Directly",
]);

function resolveCalendarCallbackStatus(renewal: Renewal): string {
  const status = (renewal.status || "").trim();
  if (status && CALLBACK_SCHEDULE_STATUSES.has(status)) {
    return status;
  }
  if (status && status !== "Active") {
    return status;
  }
  return "Callback";
}

const getInitialCalendarView = (): CalendarView => {
  if (typeof window === "undefined") return "renewals";
  const urlView = new URLSearchParams(window.location.search).get("view");
  if (urlView === "leads" || urlView === "renewals") return urlView;
  const storedView = localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY);
  if (storedView === "leads" || storedView === "renewals") return storedView;
  return "renewals";
};

export default function CalendarPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const isLeadsRole = useMemo(() => {
    const role = user?.role || "";
    const adminRoles = ["Platform Admin", "Tenant Super Admin"];
    // Don't treat admins as leads role - they see renewals with full access
    if (adminRoles.includes(role)) return false;
    return role.toLowerCase().includes("lead");
  }, [user?.role]);

  const [calendarView, setCalendarView] = useState<CalendarView>(getInitialCalendarView);
  const isLeadsView = calendarView === "leads";

  const pageTitle = isLeadsView ? "Leads Calendar" : "Renewals Calendar";
  const pageSubtitle = isLeadsView
    ? "View all scheduled lead callbacks"
    : "View all customers contract end dates and callbacks";
  const detailsBasePath = isLeadsView ? "/dashboard/leads" : "/dashboard/renewals";
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    if (typeof window === "undefined") return new Date();
    const saved = sessionStorage.getItem("calendar_current_date");
    if (saved) {
      const parsed = new Date(saved);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  });
  const [selectedRenewal, setSelectedRenewal] = useState<Renewal | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedDayRenewals, setSelectedDayRenewals] = useState<Renewal[]>([]);
  const [showDayEventsDialog, setShowDayEventsDialog] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [contractEndDateInput, setContractEndDateInput] = useState("");
  const [rescheduleNotes, setRescheduleNotes] = useState("");
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // ✅ Employee filter states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // ✅ NEW: Refetch trigger for when callbacks are updated
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const updateCalendarView = (view: CalendarView) => {
    setCalendarView(view);
    setSelectedRenewal(null);
    setShowDetailDialog(false);
    setSelectedDayRenewals([]);
    setShowDayEventsDialog(false);
    if (typeof window !== "undefined") {
      localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, view);
      const url = new URL(window.location.href);
      url.searchParams.set("view", view);
      window.history.replaceState(null, "", url.toString());
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("calendar_current_date", currentDate.toISOString());
    }
  }, [currentDate]);

  useEffect(() => {
    const view = searchParams.get("view");
    if (view === "leads" || view === "renewals") {
      console.log("🔄 Setting view from URL:", view);
      setCalendarView(view);
      if (typeof window !== "undefined") {
        localStorage.setItem(CALENDAR_VIEW_STORAGE_KEY, view);
      }
      return;
    }

    const storedView = typeof window !== "undefined" ? localStorage.getItem(CALENDAR_VIEW_STORAGE_KEY) : null;
    if (storedView === "leads" || storedView === "renewals") {
      console.log("ðŸ”„ Setting view from saved preference:", storedView);
      setCalendarView(storedView);
    } else if (isLeadsRole) {
      console.log("🔄 Setting view from role: leads");
      setCalendarView("leads");
    } else {
      console.log("🔄 Setting view from role: renewals");
      setCalendarView("renewals");
    }
  }, [searchParams, isLeadsRole]);

  useEffect(() => {
    if (user) {
      const adminRoles = ["Platform Admin", "Tenant Super Admin"];
      const isUserAdmin = adminRoles.includes(user.role || "");
      setIsAdmin(isUserAdmin);
      console.log("✅ User role:", user.role, "isAdmin:", isUserAdmin);
    }
  }, [user]);

  // Load employees for admin
  useEffect(() => {
    const loadEmployees = async () => {
      if (isAdmin) {
        setLoadingEmployees(true);
        try {
          console.log("📊 Loading employees for dropdown...");
          const response = await api.getCalendarEmployees();

          console.log("✅ Employees raw response:", response);

          let employeesList: Employee[] = [];

          if (Array.isArray(response)) {
            employeesList = response;
          } else if (response?.data && Array.isArray(response.data)) {
            employeesList = response.data;
          } else if (response?.success && response?.data && Array.isArray(response.data)) {
            employeesList = response.data;
          }

          console.log("✅ Parsed employees list:", employeesList);
          console.log("✅ Number of employees:", employeesList.length);

          setEmployees(employeesList);
        } catch (error) {
          console.error("❌ Error loading employees:", error);
          setEmployees([]);
        } finally {
          setLoadingEmployees(false);
        }
      }
    };
    loadEmployees();
  }, [isAdmin]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showMonthPicker && !target.closest(".absolute")) {
        setShowMonthPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMonthPicker]);

  // ✅ NEW: Listen for storage events from lead details page
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "calendar-refetch-trigger") {
        console.log("🔔 Received calendar refetch signal from another tab");
        setRefetchTrigger((prev) => prev + 1);
      }
    };

    const handleCustomEvent = (e: CustomEvent) => {
      if (e.detail?.action === "refetch-calendar") {
        console.log("🔔 Received calendar refetch signal from same page");
        setRefetchTrigger((prev) => prev + 1);
      }
    };

    window.addEventListener("storage", handleStorageChange as EventListener);
    window.addEventListener("calendar-refetch" as any, handleCustomEvent as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorageChange as EventListener);
      window.removeEventListener("calendar-refetch" as any, handleCustomEvent as EventListener);
    };
  }, []);

  const formatDateKey = (date: Date | string) => {
    if (typeof date === "string") {
      const ymd = date.slice(0, 10);
      return /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? ymd : date;
    }
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const daysFromPrevMonth = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const days: Date[] = [];

    for (let i = daysFromPrevMonth; i > 0; i--) {
      days.push(new Date(year, month, 1 - i));
    }
    for (let day = 1; day <= lastDay; day++) {
      days.push(new Date(year, month, day));
    }
    const remainingDays = 35 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      days.push(new Date(year, month + 1, day));
    }
    return days;
  }, [currentDate]);

  const filteredRenewals = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return renewals;

    return renewals.filter((renewal) =>
      [
        renewal.name,
        renewal.title,
        renewal.mpan,
        renewal.supplier,
        renewal.service_title,
        renewal.status,
        renewal.display_type,
        renewal.contact,
        renewal.email,
        renewal.phone,
        renewal.address,
        renewal.postcode,
        renewal.assigned_to,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [renewals, searchTerm]);

  const renewalsByDate = useMemo(() => {
    const dateMap: Record<string, Renewal[]> = {};

    for (const renewal of filteredRenewals) {
      if (renewal.display_date) {
        const dateKey = formatDateKey(renewal.display_date);
        if (!dateMap[dateKey]) dateMap[dateKey] = [];
        dateMap[dateKey].push(renewal);
      }
    }

    return dateMap;
  }, [filteredRenewals]);

  const loadCalendarEvents = async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setLoading(true);
      }
      setError(null);

      console.log(`📅 Loading ${calendarView} calendar for employee:`, selectedEmployeeId || "all");

      const response = isLeadsView
        ? await api.getCalendarLeads(selectedEmployeeId)
        : await api.getCalendarRenewals(selectedEmployeeId);

      const renewalsList = Array.isArray(response) ? response : response?.data || [];

      console.log(`✅ Loaded ${renewalsList.length} ${calendarView} events`);
      setRenewals(renewalsList);
    } catch (err) {
      console.error("❌ Error loading calendar:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to load calendar data";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && calendarView) {
      console.log(`🔄 Triggering calendar load - view: ${calendarView}, employee: ${selectedEmployeeId || "all"}`);
      loadCalendarEvents();
    }
  }, [user, selectedEmployeeId, calendarView, refetchTrigger]); // ✅ Added refetchTrigger

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + (direction === "prev" ? -1 : 1));
    setCurrentDate(newDate);
  };

  const getRenewalsForDate = (date: Date) => {
    const dateKey = formatDateKey(date);
    return renewalsByDate[dateKey] || [];
  };

  const getRenewalColor = (renewal: Renewal) => {
    if (renewal.is_overdue) {
      return "bg-red-100 text-red-800 border-red-300";
    }

    const displayType = renewal.display_type.toLowerCase();

    // Contract end dates (orange)
    if (renewal.type === "contract_end") {
      return "bg-orange-100 text-orange-800 border-orange-300";
    }

    // Callback-type events (different colors based on status)
    if (displayType === "callback" || displayType === "called" || displayType === "not answered") {
      return "bg-blue-100 text-blue-800 border-blue-300";
    }

    if (displayType === "already renewed") {
      return "bg-green-100 text-green-800 border-green-300";
    }

    if (displayType === "end date changed") {
      return "bg-purple-100 text-purple-800 border-purple-300";
    }

    if (displayType === "priced") {
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    }

    if (displayType === "broker in place") {
      return "bg-indigo-100 text-indigo-800 border-indigo-300";
    }

    // Default for any other callback-related event
    return "bg-blue-100 text-blue-800 border-blue-300";
  };

  const openCustomerDetails = (customerId: number) => {
    window.open(`${detailsBasePath}/${customerId}`, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    if (!selectedRenewal) {
      setRescheduleDate("");
      setContractEndDateInput("");
      setRescheduleError(null);
      return;
    }
    setRescheduleDate(selectedRenewal.reminder_date ? String(selectedRenewal.reminder_date).slice(0, 10) : "");
    setContractEndDateInput(
      selectedRenewal.contract_end_date ? String(selectedRenewal.contract_end_date).slice(0, 10) : "",
    );
    setRescheduleNotes(selectedRenewal.notes || "");
    setRescheduleError(null);
  }, [selectedRenewal]);

  const handlePopupReschedule = async () => {
    if (!selectedRenewal) {
      setRescheduleError("Please select a customer.");
      return;
    }

    const renewalSnapshot = selectedRenewal;
    const existingCallbackDate = renewalSnapshot.reminder_date
      ? String(renewalSnapshot.reminder_date).slice(0, 10)
      : "";
    const existingEndDate = renewalSnapshot.contract_end_date
      ? String(renewalSnapshot.contract_end_date).slice(0, 10)
      : "";
    const callbackChanged = Boolean(rescheduleDate) && rescheduleDate !== existingCallbackDate;
    const isLeadEvent = renewalSnapshot.id.startsWith("lead-callback-");
    const endDateChanged = !isLeadEvent && Boolean(contractEndDateInput) && contractEndDateInput !== existingEndDate;
    const notesChanged = rescheduleNotes.trim() !== (renewalSnapshot.notes || "").trim();

    if (!callbackChanged && !endDateChanged && !notesChanged) {
      setRescheduleError("No changes detected. Update callback date, contract end date, or notes.");
      return;
    }

    setIsRescheduling(true);
    setRescheduleError(null);

    try {
      if (isLeadEvent && callbackChanged) {
        await fetchWithAuth(`/api/crm/leads/${renewalSnapshot.customer_id}/callback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: resolveCalendarCallbackStatus(renewalSnapshot),
            callback_date: rescheduleDate,
            notes: rescheduleNotes.trim() || "Rescheduled from calendar",
          }),
        });
      }

      if (!isLeadEvent && (callbackChanged || endDateChanged || notesChanged)) {
        await fetchWithAuth(`/backend-api/api/calendar/renewals/${renewalSnapshot.customer_id}/schedule`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            callback_date: callbackChanged ? rescheduleDate : undefined,
            contract_end_date: endDateChanged ? contractEndDateInput : undefined,
            notes: notesChanged ? rescheduleNotes.trim() : undefined,
          }),
        });
      }

      const applyUpdate = (item: Renewal): Renewal => {
        if (item.id !== renewalSnapshot.id) return item;
        return {
          ...item,
          reminder_date: callbackChanged ? rescheduleDate : item.reminder_date,
          contract_end_date: endDateChanged ? contractEndDateInput : item.contract_end_date,
          notes: notesChanged ? rescheduleNotes.trim() : item.notes,
          display_date:
            item.type === "contract_end"
              ? endDateChanged
                ? contractEndDateInput
                : item.display_date
              : callbackChanged
                ? rescheduleDate
                : item.display_date,
        };
      };

      setRenewals((prev) => prev.map(applyUpdate));
      setShowDetailDialog(false);
      setSelectedRenewal(null);
      localStorage.setItem("calendar-refetch-trigger", Date.now().toString());
      window.dispatchEvent(new CustomEvent("calendar-refetch", { detail: { action: "refetch-calendar" } }));
      void loadCalendarEvents({ silent: true });
    } catch (err: any) {
      const message = err?.message || "Failed to reschedule callback.";
      setRescheduleError(
        message === "Failed to fetch"
          ? "Could not reach the calendar update endpoint. Restart the backend and try again."
          : message,
      );
    } finally {
      setIsRescheduling(false);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold">{pageTitle}</h1>
          <p className="text-muted-foreground mt-1">{pageSubtitle}</p>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search renewals or leads..."
              className="w-full pl-9 lg:w-72"
            />
          </div>
          <div className="flex rounded-md border border-gray-200 bg-white p-1">
            <Button
              type="button"
              size="sm"
              variant={calendarView === "leads" ? "default" : "ghost"}
              onClick={() => updateCalendarView("leads")}
            >
              Leads
            </Button>
            <Button
              type="button"
              size="sm"
              variant={calendarView === "renewals" ? "default" : "ghost"}
              onClick={() => updateCalendarView("renewals")}
            >
              Renewals
            </Button>
          </div>
          {/* ✅ Employee Filter Dropdown (Admin Only) */}
          {isAdmin && (
            <div className="flex flex-col gap-1">
              <Select
                value={selectedEmployeeId?.toString() || "all"}
                onValueChange={(value) => {
                  console.log("🔄 Employee filter changed:", value);
                  setSelectedEmployeeId(value === "all" ? undefined : parseInt(value));
                }}
                disabled={loadingEmployees}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Salespeople" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Salespeople</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>
                      {emp.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* ✅ Debug info - remove in production */}
              {loadingEmployees && <span className="text-xs text-gray-500">Loading salespeople...</span>}
              {!loadingEmployees && employees.length === 0 && (
                <span className="text-xs text-red-500">No salespeople found</span>
              )}
              {!loadingEmployees && employees.length > 0 && (
                <span className="text-xs text-gray-500">{employees.length} salesperson(s)</span>
              )}
            </div>
          )}

          <Button onClick={() => void loadCalendarEvents()} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ✅ Error Display */}
      {error && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">Error Loading Calendar</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <Button onClick={() => void loadCalendarEvents()} variant="outline" size="sm" className="mt-3">
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigateMonth("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigateMonth("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* ✅ NEW: Month/Year Picker */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowMonthPicker(!showMonthPicker)}
            className="ml-4 min-w-[200px]"
          >
            {currentDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </Button>

          {/* ✅ Month/Year Picker Dropdown */}
          {showMonthPicker && (
            <div className="absolute top-[180px] z-50 mt-2 rounded-lg border bg-white p-4 shadow-lg">
              <div className="flex gap-4">
                {/* Month Selector */}
                <div>
                  <p className="mb-2 text-sm font-medium">Month</p>
                  <div className="grid grid-cols-3 gap-2">
                    {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(
                      (month, idx) => (
                        <Button
                          key={month}
                          variant={currentDate.getMonth() === idx ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            const newDate = new Date(currentDate);
                            newDate.setMonth(idx);
                            setCurrentDate(newDate);
                          }}
                          className="w-16"
                        >
                          {month}
                        </Button>
                      ),
                    )}
                  </div>
                </div>

                {/* Year Selector */}
                <div>
                  <p className="mb-2 text-sm font-medium">Year</p>
                  <div className="grid max-h-[300px] grid-cols-2 gap-2 overflow-y-auto">
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 2 + i).map((year) => (
                      <Button
                        key={year}
                        variant={currentDate.getFullYear() === year ? "default" : "outline"}
                        size="sm"
                        onClick={() => {
                          const newDate = new Date(currentDate);
                          newDate.setFullYear(year);
                          setCurrentDate(newDate);
                        }}
                        className="w-20"
                      >
                        {year}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" size="sm" onClick={() => setShowMonthPicker(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ✅ Show loading/count info */}
        <div className="text-sm text-gray-600">
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </span>
          ) : (
            <span>
              {filteredRenewals.length} of {renewals.length} event{renewals.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-lg border">
        <div className="grid grid-cols-7 border-b bg-gray-50">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div key={day} className="border-r p-2 text-center text-sm font-medium last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isToday = day.toDateString() === new Date().toDateString();
            const dayRenewals = getRenewalsForDate(day);

            return (
              <div
                key={idx}
                className={`min-h-[120px] border-r border-b p-2 last:border-r-0 ${
                  isCurrentMonth ? "bg-white" : "bg-gray-50"
                } ${isToday ? "ring-2 ring-blue-500 ring-inset" : ""}`}
              >
                <div className="mb-1">
                  <span className={`text-sm ${isToday ? "font-bold text-blue-600" : ""}`}>{day.getDate()}</span>
                </div>
                <div className="space-y-1">
                  {dayRenewals.slice(0, 3).map((renewal) => (
                    <div
                      key={`${renewal.id}-${renewal.display_date}`}
                      onClick={() => {
                        setSelectedRenewal(renewal);
                        setShowDetailDialog(true);
                      }}
                      className={`cursor-pointer rounded border px-2 py-1 text-xs transition-shadow hover:shadow-md ${getRenewalColor(renewal)}`}
                    >
                      <div className="truncate font-medium">{renewal.name}</div>
                      <div className="truncate text-xs opacity-75">{renewal.display_type}</div>
                    </div>
                  ))}
                  {dayRenewals.length > 3 && (
                    <button
                      onClick={() => {
                        // ✅ NEW: Show all events for this day in a dialog
                        setSelectedDayRenewals(dayRenewals);
                        setShowDayEventsDialog(true);
                      }}
                      className="w-full text-left text-xs font-medium text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      +{dayRenewals.length - 3} more
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden p-0">
          {selectedRenewal && (
            <div className="flex min-h-0 flex-1 flex-col">
              <DialogHeader className="border-b bg-gray-50 px-6 py-5">
                <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <DialogTitle className="text-xl font-semibold text-gray-950">{selectedRenewal.name}</DialogTitle>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getRenewalColor(selectedRenewal)}`}>
                        {selectedRenewal.display_type}
                      </span>
                      <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                        {selectedRenewal.status || "No status"}
                      </span>
                      {selectedRenewal.assigned_to && (
                        <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700">
                          {selectedRenewal.assigned_to}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-md border bg-white px-3 py-2 text-sm">
                    <p className="text-xs font-medium text-gray-500">
                      {selectedRenewal.type === "callback" ? "Callback" : "Display Date"}
                    </p>
                    <p className="font-semibold text-gray-950">
                      {selectedRenewal.display_date ? format(new Date(selectedRenewal.display_date), "dd MMM yyyy") : "N/A"}
                    </p>
                  </div>
                </div>
              </DialogHeader>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-gray-500">Customer Name</p>
                  <p className="text-base font-semibold">{selectedRenewal.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Event Type</p>
                  <p className="text-base font-semibold">{selectedRenewal.display_type}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">MPAN Number</p>
                  <p className="text-base font-semibold">{selectedRenewal.mpan || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Supplier</p>
                  <p>{selectedRenewal.supplier || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Service</p>
                  <p>{selectedRenewal.service_title || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <p>{selectedRenewal.status || "N/A"}</p>
                </div>
                {selectedRenewal.contract_end_date && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Contract End Date</p>
                    <p>{format(new Date(selectedRenewal.contract_end_date), "dd MMM yyyy")}</p>
                  </div>
                )}
                {selectedRenewal.reminder_date && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      {selectedRenewal.type === "callback" ? "Callback Date" : "Renewal Reminder"}
                    </p>
                    <p>{format(new Date(selectedRenewal.reminder_date), "dd MMM yyyy")}</p>
                    {selectedRenewal.type !== "callback" && (
                      <p className="text-xs text-gray-500">(365 days early notice)</p>
                    )}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-500">Contact</p>
                  <p>{selectedRenewal.contact || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p>{selectedRenewal.phone || "N/A"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p>{selectedRenewal.email || "N/A"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-500">Address</p>
                  <p>{selectedRenewal.address || "N/A"}</p>
                  {selectedRenewal.postcode && <p className="text-sm text-gray-600">{selectedRenewal.postcode}</p>}
                </div>
                {selectedRenewal.rates && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Rates</p>
                    <p>{selectedRenewal.rates}</p>
                  </div>
                )}
                {selectedRenewal.assigned_to && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Assigned To</p>
                    <p>{selectedRenewal.assigned_to}</p>
                  </div>
                )}
              </div>
              {selectedRenewal.notes && (
                <div className="mt-4 rounded-md border border-gray-200 bg-white p-4">
                  <p className="text-sm font-medium text-gray-500">Notes</p>
                  <p className="mt-1 text-sm leading-6 whitespace-pre-wrap text-gray-700">{selectedRenewal.notes}</p>
                </div>
              )}
                <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900">
                      {isLeadsView ? "Schedule Callback" : "Schedule Updates"}
                    </p>
                    <span className="text-xs text-gray-500">Changes save to calendar dates only</span>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="w-full sm:w-52">
                      <p className="mb-1 text-xs font-medium text-gray-500">Callback Date</p>
                      <Input
                        type="date"
                        value={rescheduleDate}
                        onChange={(e) => setRescheduleDate(e.target.value)}
                        className="w-full min-w-0 bg-white [color-scheme:light]"
                      />
                    </div>
                    {!isLeadsView && (
                      <div className="w-full sm:w-52">
                        <p className="mb-1 text-xs font-medium text-gray-500">Contract End Date</p>
                        <Input
                          type="date"
                          value={contractEndDateInput}
                          onChange={(e) => setContractEndDateInput(e.target.value)}
                          className="w-full min-w-0 bg-white [color-scheme:light]"
                        />
                      </div>
                    )}
                    <Button className="w-full sm:w-auto" onClick={handlePopupReschedule} disabled={isRescheduling}>
                      {isRescheduling ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Updates"
                      )}
                    </Button>
                  </div>
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-medium text-gray-500">Notes</p>
                    <Textarea
                      value={rescheduleNotes}
                      onChange={(event) => setRescheduleNotes(event.target.value)}
                      placeholder="Add notes..."
                      rows={3}
                      className="resize-none bg-white"
                    />
                  </div>
                  {rescheduleError && <p className="mt-2 text-xs font-medium text-red-600">{rescheduleError}</p>}
                </div>
              </div>
                <div className="flex items-center justify-between gap-3 border-t bg-white px-6 py-4">
                  <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                    Close
                  </Button>
                  <Button onClick={() => openCustomerDetails(selectedRenewal.customer_id)} className="gap-2">
                    View Full Details
                    <ExternalLink className="h-4 w-4" />
                  </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDayEventsDialog} onOpenChange={setShowDayEventsDialog}>
        <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              All Events -{" "}
              {selectedDayRenewals.length > 0 && format(new Date(selectedDayRenewals[0].display_date), "dd MMM yyyy")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {selectedDayRenewals.map((renewal) => (
              <div
                key={`${renewal.id}-${renewal.display_date}`}
                onClick={() => {
                  setSelectedRenewal(renewal);
                  setShowDayEventsDialog(false);
                  setShowDetailDialog(true);
                }}
                className={`cursor-pointer rounded border p-3 transition-shadow hover:shadow-md ${getRenewalColor(renewal)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="text-base font-semibold">{renewal.name}</div>
                    <div className="mt-1 text-sm">
                      <span className="font-medium">{renewal.display_type}</span>
                      {renewal.mpan && <span className="ml-2 text-xs opacity-75">• {renewal.mpan}</span>}
                    </div>
                    {renewal.supplier && <div className="mt-1 text-xs opacity-75">Supplier: {renewal.supplier}</div>}
                  </div>
                  <ExternalLink className="h-4 w-4 opacity-50" />
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
