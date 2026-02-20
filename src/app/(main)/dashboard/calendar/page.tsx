"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { format } from "date-fns";

interface Deadline {
  id: string;
  customer_id: number;
  type: string;
  title: string;
  name: string;                   // business name
  voa_reference: string;          // was: mpan
  billing_authority: string;      // was: supplier
  case_opened_date: string;       // was: contract_start_date
  appeal_deadline: string;        // was: contract_end_date
  reminder_date: string;
  address: string;
  postcode: string;
  contact: string;
  email: string;
  phone: string;
  service_title: string;
  current_rv?: string;            // rateable value
  proposed_rv?: string;
  projected_saving?: string;
  case_stage?: string;            // check / challenge / appeal / resolved / lost
  notes: string;
  display_date: string;
  display_type: string;
  status: string;
  days_until_deadline?: number;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDeadline, setSelectedDeadline] = useState<Deadline | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const formatDateKey = (date: Date | string) => {
    if (typeof date === "string") return date;
    const yyyy = date.getFullYear();
    const mm   = String(date.getMonth() + 1).padStart(2, "0");
    const dd   = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const calendarDays = useMemo(() => {
    const year  = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay       = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();
    const lastDay        = new Date(year, month + 1, 0).getDate();
    const daysFromPrev   = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const days: Date[]   = [];

    for (let i = daysFromPrev; i > 0; i--)     days.push(new Date(year, month, 1 - i));
    for (let d = 1; d <= lastDay; d++)          days.push(new Date(year, month, d));
    for (let d = 1; d <= 35 - days.length; d++) days.push(new Date(year, month + 1, d));

    return days;
  }, [currentDate]);

  const deadlinesByDate = useMemo(() => {
    const dateMap: Record<string, Deadline[]> = {};
    for (const deadline of deadlines) {
      if (deadline.display_date) {
        const key = formatDateKey(deadline.display_date);
        if (!dateMap[key]) dateMap[key] = [];
        dateMap[key].push(deadline);
      }
    }
    return dateMap;
  }, [deadlines]);

  const loadDeadlines = async () => {
    try {
      setLoading(true);
      const result = await api.getCalendarRenewals();
      setDeadlines(result.data || []);
    } catch (err) {
      console.error("Error loading deadlines:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadDeadlines();
  }, [user]);

  const navigateMonth = (direction: "prev" | "next") => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + (direction === "prev" ? -1 : 1));
    setCurrentDate(d);
  };

  const getDeadlinesForDate = (date: Date) =>
    deadlinesByDate[formatDateKey(date)] || [];

  // Colour-code by urgency: ≤30 days = red, ≤60 = amber, else blue
  const getDeadlineColor = (deadline: Deadline) => {
    const days = deadline.days_until_deadline;
    if (days !== undefined && days !== null) {
      if (days <= 30) return "bg-red-100 text-red-800 border-red-300";
      if (days <= 60) return "bg-orange-100 text-orange-800 border-orange-300";
    }
    return "bg-blue-100 text-blue-800 border-blue-300";
  };

  const openCaseDetails = (customerId: number) => {
    window.open(`/dashboard/rates-clients/${customerId}`, "_blank", "noopener,noreferrer");
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
          <h1 className="text-3xl font-bold">Appeal Deadlines Calendar</h1>
          <p className="text-muted-foreground mt-1">
            Appeal deadlines and follow-up reminders (90 days before deadline)
          </p>
        </div>
        <Button onClick={loadDeadlines} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Urgency legend */}
      <div className="mb-4 flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-red-400" />
          Urgent (≤30 days)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-orange-400" />
          Warning (31–60 days)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full bg-blue-400" />
          Upcoming
        </span>
      </div>

      {/* Navigation */}
      <div className="mb-4 flex items-center gap-2">
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

      {/* Calendar */}
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
            const isToday        = day.toDateString() === new Date().toDateString();
            const dayDeadlines   = getDeadlinesForDate(day);

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
                  {dayDeadlines.slice(0, 3).map((deadline) => (
                    <div
                      key={`${deadline.id}-${deadline.display_date}`}
                      onClick={() => { setSelectedDeadline(deadline); setShowDetailDialog(true); }}
                      className={`cursor-pointer rounded border px-2 py-1 text-xs hover:shadow-md transition-shadow ${getDeadlineColor(deadline)}`}
                    >
                      <div className="font-medium truncate">{deadline.name}</div>
                      <div className="text-xs opacity-75 truncate">
                        {deadline.voa_reference || deadline.billing_authority}
                      </div>
                    </div>
                  ))}
                  {dayDeadlines.length > 3 && (
                    <div className="text-xs text-gray-500">
                      +{dayDeadlines.length - 3} more
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
            <DialogTitle>Case Details</DialogTitle>
          </DialogHeader>
          {selectedDeadline && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Business Name</p>
                  <p className="text-base font-semibold">{selectedDeadline.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">VOA Reference</p>
                  <p className="text-base font-semibold">{selectedDeadline.voa_reference || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Billing Authority</p>
                  <p>{selectedDeadline.billing_authority || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Case Stage</p>
                  <p className="capitalize">{selectedDeadline.case_stage || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Current RV</p>
                  <p>{selectedDeadline.current_rv ? `£${Number(selectedDeadline.current_rv).toLocaleString()}` : "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Proposed RV</p>
                  <p>{selectedDeadline.proposed_rv ? `£${Number(selectedDeadline.proposed_rv).toLocaleString()}` : "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Case Opened</p>
                  <p>{selectedDeadline.case_opened_date
                    ? format(new Date(selectedDeadline.case_opened_date), "dd MMM yyyy")
                    : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Appeal Deadline</p>
                  <p className={`font-semibold ${
                    (selectedDeadline.days_until_deadline ?? 999) <= 30
                      ? "text-red-600"
                      : (selectedDeadline.days_until_deadline ?? 999) <= 60
                        ? "text-orange-600"
                        : "text-gray-900"
                  }`}>
                    {selectedDeadline.appeal_deadline
                      ? format(new Date(selectedDeadline.appeal_deadline), "dd MMM yyyy")
                      : "N/A"}
                    {selectedDeadline.days_until_deadline !== undefined && (
                      <span className="ml-2 text-sm font-normal">
                        ({selectedDeadline.days_until_deadline} days)
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Contact</p>
                  <p>{selectedDeadline.contact || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Phone</p>
                  <p>{selectedDeadline.phone || "N/A"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-500">Email</p>
                  <p>{selectedDeadline.email || "N/A"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-sm font-medium text-gray-500">Property Address</p>
                  <p>{selectedDeadline.address || "N/A"}</p>
                  {selectedDeadline.postcode && (
                    <p className="text-sm text-gray-600">{selectedDeadline.postcode}</p>
                  )}
                </div>
                {selectedDeadline.projected_saving && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-gray-500">Projected Annual Saving</p>
                    <p className="text-green-700 font-semibold">
                      £{Number(selectedDeadline.projected_saving).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {selectedDeadline.notes && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Notes</p>
                  <p className="text-sm mt-1">{selectedDeadline.notes}</p>
                </div>
              )}

              <div className="flex justify-between items-center pt-4 border-t">
                <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                  Close
                </Button>
                <Button
                  onClick={() => openCaseDetails(selectedDeadline.customer_id)}
                  className="gap-2"
                >
                  View Full Case
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