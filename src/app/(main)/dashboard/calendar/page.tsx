"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, ExternalLink, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
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
}

interface Employee {
  id: number;
  full_name: string;
  email: string;
}

type CalendarView = "renewals" | "leads";

export default function CalendarPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const isLeadsRole = useMemo(() => {
    const role = user?.role || '';
    const adminRoles = ['Platform Admin', 'Tenant Super Admin'];
    // Don't treat admins as leads role - they see renewals with full access
    if (adminRoles.includes(role)) return false;
    return role.toLowerCase().includes('leads offshore') || role.toLowerCase().includes('leads');
  }, [user?.role]);

  const [calendarView, setCalendarView] = useState<CalendarView>("renewals");
  const isLeadsView = calendarView === "leads";

  const pageTitle = isLeadsView ? "Leads Calendar" : "Renewals Calendar";
  const pageSubtitle = isLeadsView
    ? "View all leads contract end dates and callbacks"
    : "View all customers contract end dates and callbacks";
  const detailsBasePath = isLeadsView ? "/dashboard/leads" : "/dashboard/renewals";
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedRenewal, setSelectedRenewal] = useState<Renewal | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedDayRenewals, setSelectedDayRenewals] = useState<Renewal[]>([]);
  const [showDayEventsDialog, setShowDayEventsDialog] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // ✅ Employee filter states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  useEffect(() => {
    const view = searchParams.get("view");
    if (view === "leads" || view === "renewals") {
      console.log("🔄 Setting view from URL:", view);
      setCalendarView(view);
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
      const adminRoles = ['Platform Admin', 'Tenant Super Admin'];
      const isUserAdmin = adminRoles.includes(user.role || '');
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
      if (showMonthPicker && !target.closest('.absolute')) {
        setShowMonthPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMonthPicker]);

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

  const renewalsByDate = useMemo(() => {
    const dateMap: Record<string, Renewal[]> = {};
    
    for (const renewal of renewals) {
      if (renewal.display_date) {
        const dateKey = formatDateKey(renewal.display_date);
        if (!dateMap[dateKey]) dateMap[dateKey] = [];
        dateMap[dateKey].push(renewal);
      }
    }
    
    return dateMap;
  }, [renewals]);

  const loadCalendarEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log(`📅 Loading ${calendarView} calendar for employee:`, selectedEmployeeId || 'all');

      const response = isLeadsView
        ? await api.getCalendarLeads(selectedEmployeeId)
        : await api.getCalendarRenewals(selectedEmployeeId);

      const renewalsList = Array.isArray(response)
        ? response
        : (response?.data || []);

      console.log(`✅ Loaded ${renewalsList.length} ${calendarView} events`);
      setRenewals(renewalsList);
    } catch (err) {
      console.error("❌ Error loading calendar:", err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load calendar data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && calendarView) {
      console.log(`🔄 Triggering calendar load - view: ${calendarView}, employee: ${selectedEmployeeId || 'all'}`);
      loadCalendarEvents();
    }
  }, [user, selectedEmployeeId, calendarView]); 

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
    const displayType = renewal.display_type.toLowerCase();
    
    // Contract end dates (orange)
    if (renewal.type === 'contract_end') {
      return "bg-orange-100 text-orange-800 border-orange-300";
    }
    
    // Callback-type events (different colors based on status)
    if (displayType === 'callback' || displayType === 'called' || displayType === 'not answered') {
      return "bg-blue-100 text-blue-800 border-blue-300";
    }
    
    if (displayType === 'already renewed') {
      return "bg-green-100 text-green-800 border-green-300";
    }
    
    if (displayType === 'end date changed') {
      return "bg-purple-100 text-purple-800 border-purple-300";
    }
    
    if (displayType === 'priced') {
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    }
    
    if (displayType === 'broker in place') {
      return "bg-indigo-100 text-indigo-800 border-indigo-300";
    }
    
    // Default for any other callback-related event
    return "bg-blue-100 text-blue-800 border-blue-300";
  };


  const openCustomerDetails = (customerId: number) => {
    window.open(`${detailsBasePath}/${customerId}`, '_blank', 'noopener,noreferrer');
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{pageTitle}</h1>
          <p className="text-muted-foreground mt-1">
            {pageSubtitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
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
              {loadingEmployees && (
                <span className="text-xs text-gray-500">Loading salespeople...</span>
              )}
              {!loadingEmployees && employees.length === 0 && (
                <span className="text-xs text-red-500">No salespeople found</span>
              )}
              {!loadingEmployees && employees.length > 0 && (
                <span className="text-xs text-gray-500">{employees.length} salesperson(s)</span>
              )}
            </div>
          )}

          <Button onClick={loadCalendarEvents} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ✅ Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">Error Loading Calendar</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <Button 
              onClick={loadCalendarEvents} 
              variant="outline" 
              size="sm" 
              className="mt-3"
            >
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
            <div className="absolute mt-2 z-50 bg-white border rounded-lg shadow-lg p-4 top-[180px]">
              <div className="flex gap-4">
                {/* Month Selector */}
                <div>
                  <p className="text-sm font-medium mb-2">Month</p>
                  <div className="grid grid-cols-3 gap-2">
                    {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month, idx) => (
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
                    ))}
                  </div>
                </div>
                
                {/* Year Selector */}
                <div>
                  <p className="text-sm font-medium mb-2">Year</p>
                  <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
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
              
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowMonthPicker(false)}
                >
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
            <span>{renewals.length} event{renewals.length !== 1 ? 's' : ''}</span>
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
                className={`min-h-[120px] border-b border-r p-2 last:border-r-0 ${
                  isCurrentMonth ? "bg-white" : "bg-gray-50"
                } ${isToday ? "ring-2 ring-inset ring-blue-500" : ""}`}
              >
                <div className="mb-1">
                  <span className={`text-sm ${isToday ? "font-bold text-blue-600" : ""}`}>
                    {day.getDate()}
                  </span>
                </div>
                <div className="space-y-1">
                  {dayRenewals.slice(0, 3).map((renewal) => (
                    <div
                      key={`${renewal.id}-${renewal.display_date}`}
                      onClick={() => {
                        setSelectedRenewal(renewal);
                        setShowDetailDialog(true);
                      }}
                      className={`cursor-pointer rounded border px-2 py-1 text-xs hover:shadow-md transition-shadow ${getRenewalColor(renewal)}`}
                    >
                      <div className="font-medium truncate">{renewal.name}</div>
                      <div className="text-xs opacity-75 truncate">
                        {renewal.display_type}
                      </div>
                    </div>
                  ))}
                  {dayRenewals.length > 3 && (
                    <button
                      onClick={() => {
                        // ✅ NEW: Show all events for this day in a dialog
                        setSelectedDayRenewals(dayRenewals);
                        setShowDayEventsDialog(true);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium w-full text-left"
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
          </DialogHeader>
          {selectedRenewal && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                  <p className="text-base font-semibold">{selectedRenewal.mpan || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Supplier</p>
                  <p>{selectedRenewal.supplier || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Service</p>
                  <p>{selectedRenewal.service_title || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  <p>{selectedRenewal.status || 'N/A'}</p>
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
                      {selectedRenewal.type === 'callback' ? 'Callback Date' : 'Renewal Reminder'}
                    </p>
                    <p>{format(new Date(selectedRenewal.reminder_date), "dd MMM yyyy")}</p>
                    {selectedRenewal.type !== 'callback' && (
                      <p className="text-xs text-gray-500">(365 days early notice)</p>
                    )}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-gray-500">Contact</p>
                  <p>{selectedRenewal.contact || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p>{selectedRenewal.phone || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p>{selectedRenewal.email || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-500">Address</p>
                  <p>{selectedRenewal.address || 'N/A'}</p>
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
                <div>
                  <p className="text-sm font-medium text-gray-500">Notes</p>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{selectedRenewal.notes}</p>
                </div>
              )}
              <div className="flex justify-between items-center pt-4 border-t">
                <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                  Close
                </Button>
                <Button 
                  onClick={() => openCustomerDetails(selectedRenewal.customer_id)}
                  className="gap-2"
                >
                  View Full Details
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showDayEventsDialog} onOpenChange={setShowDayEventsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              All Events - {selectedDayRenewals.length > 0 && format(new Date(selectedDayRenewals[0].display_date), "dd MMM yyyy")}
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
                className={`cursor-pointer rounded border p-3 hover:shadow-md transition-shadow ${getRenewalColor(renewal)}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-semibold text-base">{renewal.name}</div>
                    <div className="text-sm mt-1">
                      <span className="font-medium">{renewal.display_type}</span>
                      {renewal.mpan && <span className="ml-2 text-xs opacity-75">• {renewal.mpan}</span>}
                    </div>
                    {renewal.supplier && (
                      <div className="text-xs mt-1 opacity-75">Supplier: {renewal.supplier}</div>
                    )}
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