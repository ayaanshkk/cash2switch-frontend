"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Eye, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface Task {
  id: string;
  title: string;
  start_date?: string;
  end_date?: string;
  date?: string;
  job_type?: string;
  customer_name?: string;
  start_time?: string;
  end_time?: string;
}

// Color coding for task types
const getTaskColor = (jobType?: string) => {
  switch (jobType?.toLowerCase()) {
    case "survey":
      return "bg-blue-100 text-blue-800 border-blue-300";
    case "delivery":
      return "bg-purple-100 text-purple-800 border-purple-300";
    case "installation":
      return "bg-green-100 text-green-800 border-green-300";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300";
  }
};

const formatDateKey = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export function MiniCalendar() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
    return new Date(today.setDate(diff));
  });

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setLoading(true);
        const tasksData = await api.getAssignments();
        setTasks(Array.isArray(tasksData) ? tasksData : []);
      } catch (err) {
        console.error("Failed to fetch tasks:", err);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, []);

  // Get week days
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(currentWeekStart);
      day.setDate(currentWeekStart.getDate() + i);
      days.push(day);
    }
    return days;
  }, [currentWeekStart]);

  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    
    tasks.forEach((task) => {
      if (task.start_date) {
        const dateKey = formatDateKey(new Date(task.start_date));
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(task);
      } else if (task.date) {
        if (!map[task.date]) map[task.date] = [];
        map[task.date].push(task);
      }
    });
    
    return map;
  }, [tasks]);

  const navigateWeek = (direction: "prev" | "next") => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === "prev" ? -7 : 7));
    setCurrentWeekStart(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    setCurrentWeekStart(new Date(today.setDate(diff)));
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>This Week's Schedule</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigateWeek("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigateWeek("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day, idx) => {
            const dateKey = formatDateKey(day);
            const dayTasks = tasksByDate[dateKey] || [];
            const dayName = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][idx];

            return (
              <div
                key={dateKey}
                className={`min-h-[120px] rounded-lg border p-2 ${
                  isToday(day) ? "ring-2 ring-blue-500 bg-blue-50" : "bg-white"
                }`}
              >
                <div className="text-center mb-2">
                  <div className="text-xs font-medium text-gray-600">{dayName}</div>
                  <div className={`text-lg font-bold ${isToday(day) ? "text-blue-600" : ""}`}>
                    {day.getDate()}
                  </div>
                </div>
                <div className="space-y-1">
                  {dayTasks.slice(0, 2).map((task) => (
                    <div
                      key={task.id}
                      className={`text-xs p-1 rounded border ${getTaskColor(task.job_type)} truncate`}
                      title={task.title}
                    >
                      {task.customer_name || task.title}
                    </div>
                  ))}
                  {dayTasks.length > 2 && (
                    <div className="text-xs text-gray-500">
                      +{dayTasks.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
      <CardFooter>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push("/dashboard/schedule")}
        >
          <Eye className="mr-2 h-4 w-4" />
          View Full Schedule
        </Button>
      </CardFooter>
    </Card>
  );
}