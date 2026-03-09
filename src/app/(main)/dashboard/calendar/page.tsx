"use client";

import { useEffect, useState, useMemo } from "react";
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

export default function CalendarPage() {
  const { user } = useAuth();
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedRenewal, setSelectedRenewal] = useState<Renewal | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  
  // ✅ Employee filter states
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | undefined>(undefined);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin
  useEffect(() => {
    if (user) {
      const adminRoles = ['Platform Admin', 'Tenant Super Admin'];
      setIsAdmin(adminRoles.includes(user.role || ''));
      console.log("✅ User role:", user.role, "isAdmin:", adminRoles.includes(user.role || ''));
    }
  }, [user]);

  // Load employees for admin
  useEffect(() => {
    const loadEmployees = async () => {
      if (isAdmin) {
        try {
          console.log("📊 Loading employees...");
          const response = await api.getCalendarEmployees();
          
          console.log("✅ Employees response:", response);
          
          // Handle both { data: [...] } and direct array responses
          const employeesList = Array.isArray(response) 
            ? response 
            : (response?.data || []);
          
          setEmployees(employeesList);
          console.log("✅ Loaded employees:", employeesList);
        } catch (error) {
          console.error("❌ Error loading employees:", error);
        }
      }
    };
    loadEmployees();
  }, [isAdmin]);

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

  const loadRenewals = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("🔄 Loading renewals...");
      console.log("📊 Selected employee ID:", selectedEmployeeId);
      
      const response = await api.getCalendarRenewals(selectedEmployeeId);
      
      console.log("✅ Calendar response:", response);
      
      // Handle both { data: [...] } and direct array responses
      const renewalsList = Array.isArray(response) 
        ? response 
        : (response?.data || []);
      
      console.log("✅ Loaded renewals:", renewalsList.length);
      
      setRenewals(renewalsList);
    } catch (err) {
      console.error("❌ Error loading renewals:", err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load calendar data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadRenewals();
    }
  }, [user, selectedEmployeeId]);

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
    if (renewal.type === 'callback') {
      return "bg-blue-100 text-blue-800 border-blue-300";  
    }
    return "bg-orange-100 text-orange-800 border-orange-300";  
  };

  const openCustomerDetails = (customerId: number) => {
    window.open(`/dashboard/renewals/${customerId}`, '_blank', 'noopener,noreferrer');
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
          <h1 className="text-3xl font-bold">Renewals Calendar</h1>
          <p className="text-muted-foreground mt-1">
            View all customers contract end dates and callbacks
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* ✅ Employee Filter Dropdown (Admin Only) */}
          {isAdmin && (
            <Select
              value={selectedEmployeeId?.toString() || "all"}
              onValueChange={(value) => {
                console.log("🔄 Employee filter changed:", value);
                setSelectedEmployeeId(value === "all" ? undefined : parseInt(value));
              }}
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
          )}
          
          <Button onClick={loadRenewals} disabled={loading} variant="outline" size="sm">
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
              onClick={loadRenewals} 
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
          <h2 className="ml-4 text-xl font-semibold">
            {currentDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </h2>
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
                        {renewal.type === 'callback' ? 'Callback' : renewal.mpan}
                      </div>
                    </div>
                  ))}
                  {dayRenewals.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{dayRenewals.length - 3} more
                    </div>
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
    </div>
  );
}