"use client";
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Trash2,
  ChevronDown,
  Check,
  X,
  Archive,
} from "lucide-react";
import { fetchWithAuth, api } from "@/lib/api";


// ✅ PERFORMANCE: Improved cache with compression support
const CACHE_KEY = 'schedule_cache';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes (increased from 5)

interface CachedData {
  tasks: Task[];
  jobs: Job[];
  customers: Customer[];
  timestamp: number;
}

const saveToCache = (data: Partial<CachedData>) => {
  try {
    const existing = getFromCache();
    const updated = {
      ...existing,
      ...data,
      timestamp: Date.now(),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
    console.log('💾 Saved to cache:', Object.keys(data));
  } catch (err) {
    console.error('Failed to save cache:', err);
  }
};

const getFromCache = (): CachedData | null => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const data = JSON.parse(cached) as CachedData;
    const age = Date.now() - data.timestamp;
    
    if (age > CACHE_DURATION) {
      console.log('⏰ Cache expired');
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    console.log('✅ Loaded from cache (age: ' + Math.round(age / 1000) + 's)');
    return data;
  } catch (err) {
    console.error('Failed to load cache:', err);
    return null;
  }
};

// Interfaces
interface Employee {
  id: number;
  full_name: string;
  role?: string;
}

interface Job {
  id: string;
  job_reference: string;
  customer_name: string;
  customer_id: string;
  job_type: string;
  stage: string;
}

interface Customer {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  postcode?: string;
  stage: string;
}

interface Task {
  id: string;
  type: "job" | "off" | "delivery" | "note";
  title: string;
  date: string;
  start_date?: string;
  end_date?: string;
  job_id?: string;
  customer_id?: string;
  customer_name?: string;
  start_time?: string;
  end_time?: string;
  estimated_hours?: number | string;
  notes?: string;
  priority?: string;
  status?: string;
  user_id?: number;
  team_member?: string;
  job_type?: string;
  created_by?: number;
  created_by_name?: string;
  updated_by?: number;
  updated_by_name?: string;
}

// Helper functions - MOVED BEFORE COMPONENT
const formatDateKey = (date: Date | string) => {
  if (typeof date === "string") return date;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// ✅ Color coding for job types
const getTaskColorByType = (jobType?: string) => {
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

// Constants
const START_HOUR_WEEK = 7;
const HOUR_HEIGHT_PX = 60;
const timeSlotsWeek = Array.from({ length: 14 }, (_, i) => {
  const hour = i + START_HOUR_WEEK;
  return `${String(hour).padStart(2, "0")}:00`;
});

const interiorDesignJobTypes = [
  "Survey",
  "Delivery", 
  "Installation",
];

export default function SchedulePage() {
  const { user, token } = useAuth();
  
  console.log("🎬 SchedulePage component mounted");
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [visibleCalendars, setVisibleCalendars] = useState<string[]>([]);
  const [showOwnCalendar, setShowOwnCalendar] = useState(true);
  
  const hasLoadedData = useRef(false);

  const [currentDate, setCurrentDate] = useState(new Date());
  
  // ✅ PERFORMANCE: Load from cache immediately to show data faster
  const cachedData = getFromCache();
  const [tasks, setTasks] = useState<Task[]>(cachedData?.tasks || []);
  const [availableJobs, setAvailableJobs] = useState<Job[]>(cachedData?.jobs || []);
  const [customers, setCustomers] = useState<Customer[]>(cachedData?.customers || []);

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [originalTask, setOriginalTask] = useState<Task | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [isEditingTask, setIsEditingTask] = useState(false);
  
  const [showDayViewDialog, setShowDayViewDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const [customAssignees, setCustomAssignees] = useState<string[]>([]);
  const [customJobTasks, setCustomJobTasks] = useState<string[]>([]);
  const [customAssigneeInput, setCustomAssigneeInput] = useState("");
  const [customTaskInput, setCustomTaskInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  
  const [newTask, setNewTask] = useState<Partial<Task>>({
    type: "job",
    start_date: formatDateKey(new Date()),
    end_date: formatDateKey(new Date()),
    start_time: "09:00",
    end_time: "17:00",
    priority: "Medium",
    status: "Scheduled",
    estimated_hours: 8,
  });

  const [viewMode, setViewMode] = useState<"month" | "week" | "year">("month");

  // ✅ PERFORMANCE: Memoize expensive calculations
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

  const weeks = useMemo(() => {
    const w: Date[][] = [];
    for (let i = 0; i < 5; i++) {
      w.push(calendarDays.slice(i * 7, (i + 1) * 7));
    }
    return w;
  }, [calendarDays]);

  const daysOfWeek = useMemo(() => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const newDay = new Date(startOfWeek);
      newDay.setDate(startOfWeek.getDate() + i);
      days.push(newDay);
    }
    return days;
  }, [currentDate]);

  // ✅ PERFORMANCE: Optimized tasksByDate calculation
  const tasksByDate = useMemo(() => {
    const dateMap: Record<string, Task[]> = {};
    
    for (const task of tasks) {
      if (!task) continue;

      if (task.start_date && task.end_date) {
        const startDate = new Date(task.start_date);
        const endDate = new Date(task.end_date);
        
        const startKey = formatDateKey(startDate);
        if (!dateMap[startKey]) dateMap[startKey] = [];
        dateMap[startKey].push(task);
        
        const endKey = formatDateKey(endDate);
        if (startKey !== endKey) {
          if (!dateMap[endKey]) dateMap[endKey] = [];
          dateMap[endKey].push(task);
        }
      } 
      else if (task.date) {
        const dateKey = task.date;
        if (!dateMap[dateKey]) dateMap[dateKey] = [];
        dateMap[dateKey].push(task);
      }
      else if (task.start_date) {
        const dateKey = formatDateKey(new Date(task.start_date));
        if (!dateMap[dateKey]) dateMap[dateKey] = [];
        dateMap[dateKey].push(task);
      }
    }
    
    return dateMap;
  }, [tasks]);

  const declinedTasks = useMemo(() => {
    if (user?.role === "Manager") return [];
    return tasks.filter((a) => a.user_id === user?.id && a.status === "Declined");
  }, [tasks, user]);

  useEffect(() => {
    const savedAssignees = localStorage.getItem('custom_assignees');
    const savedJobTasks = localStorage.getItem('custom_job_tasks');
    
    if (savedAssignees) {
      try {
        setCustomAssignees(JSON.parse(savedAssignees));
      } catch (e) {
        console.error('Failed to parse custom assignees:', e);
      }
    }
    if (savedJobTasks) {
      try {
        setCustomJobTasks(JSON.parse(savedJobTasks));
      } catch (e) {
        console.error('Failed to parse custom job tasks:', e);
      }
    }
  }, []);

  const saveCustomAssignee = (name: string) => {
    const trimmedName = name.trim();
    if (trimmedName && !customAssignees.includes(trimmedName)) {
      const updated = [...customAssignees, trimmedName];
      setCustomAssignees(updated);
      localStorage.setItem('custom_assignees', JSON.stringify(updated));
    }
  };

  const saveCustomJobTask = (task: string) => {
    const trimmedTask = task.trim();
    if (trimmedTask && !customJobTasks.includes(trimmedTask) && !interiorDesignJobTypes.includes(trimmedTask)) {
      const updated = [...customJobTasks, trimmedTask];
      setCustomJobTasks(updated);
      localStorage.setItem('custom_job_tasks', JSON.stringify(updated));
    }
  };

  const formatHeaderDate = (date: Date, view: "month" | "week" | "year") => {
    if (view === "year") {
      return date.getFullYear().toString();
    }
    if (view === "week") {
      const startOfWeek = new Date(date);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
        return `${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${startOfWeek.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`;
      }
      return `${startOfWeek.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} - ${endOfWeek.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
    }
    return date.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
  };

  const navigateView = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() + (direction === "prev" ? -1 : 1));
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + (direction === "prev" ? -7 : 7));
    } else if (viewMode === "year") {
      newDate.setFullYear(newDate.getFullYear() + (direction === "prev" ? -1 : 1));
    }
    setCurrentDate(newDate);
  };

  const calculateHours = (start?: string, end?: string) => {
    if (!start || !end) return "";
    const startDate = new Date(`2000-01-01T${start}:00`);
    const endDate = new Date(`2000-01-01T${end}:00`);
    const diffMs = endDate.getTime() - startDate.getTime();
    if (diffMs <= 0) return "";
    return (diffMs / (1000 * 60 * 60)).toFixed(2);
  };

  const timeToMinutes = (time: string = "00:00") => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + (minutes || 0);
  };

  const getTaskWeekStyle = (start?: string, end?: string): React.CSSProperties => {
    if (!start || !end) {
      return { top: 0, height: `${HOUR_HEIGHT_PX}px` };
    }

    const startMinutes = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);

    const top = ((startMinutes - START_HOUR_WEEK * 60) / 60) * HOUR_HEIGHT_PX;
    const durationMinutes = Math.max(30, endMinutes - startMinutes);
    const height = (durationMinutes / 60) * HOUR_HEIGHT_PX;

    return {
      top: `${top}px`,
      height: `${height}px`,
      position: "absolute",
      left: "0.25rem",
      right: "0.25rem",
    };
  };

  // ✅ PERFORMANCE: Optimized data fetching with parallel requests
  const fetchData = async () => {
    if (!token || !user || loading) return;

    try {
      setLoading(true);
      setError(null);
      
      console.log("🔄 Fetching schedule data...");

      const directFetch = async (endpoint: string) => {
        const response = await fetch(`http://localhost:5000/${endpoint}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          throw new Error(`${endpoint} failed: ${response.status}`);
        }
        
        return response.json();
      };

      // ✅ Fetch all in parallel for faster loading
      const [tasksData, jobsData, customersData] = await Promise.all([
        directFetch('assignments'),
        directFetch('jobs'),
        directFetch('clients')
      ]);
      
      const newData = {
        tasks: Array.isArray(tasksData) ? tasksData : [],
        jobs: Array.isArray(jobsData) ? jobsData : [],
        customers: Array.isArray(customersData) ? customersData : [],
      };
      
      // ✅ Update state and cache
      setTasks(newData.tasks);
      setAvailableJobs(newData.jobs);
      setCustomers(newData.customers);
      saveToCache(newData);

      console.log("✅ Data loaded successfully");
    } catch (err) {
      console.error("❌ Error fetching data:", err);
      setError(err instanceof Error ? err.message : "Failed to load schedule data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || !token) return;

    setVisibleCalendars([user.full_name]);

    const fetchEmployees = async () => {
      if (user.role !== "Manager") return;

      try {
        const res = await fetchWithAuth("auth/users/staff");
        if (res.ok) {
          const data = await res.json();
          setEmployees(data.users || []);
        }
      } catch (err) {
        console.error("Error fetching employees:", err);
      }
    };

    fetchEmployees();
  }, [user, token]);

  // ✅ Load data once when component mounts with user/token
  useEffect(() => {
    if (user && token && !hasLoadedData.current) {
      console.log("🎯 Initial data load triggered");
      hasLoadedData.current = true;
      
      // ✅ If we have cached data, don't show loading state
      if (cachedData) {
        console.log("⚡ Using cached data, refreshing in background");
        fetchData(); // Refresh in background
      } else {
        console.log("📡 No cache, fetching data");
        fetchData();
      }
    }
  }, [user, token]);

  // CRUD operations
  const createTask = async (taskData: Partial<Task>) => {
    if (!token) throw new Error("Not authenticated");
    
    if (!taskData.customer_id) {
      throw new Error("Customer is required");
    }

    if (!taskData.start_date) {
      throw new Error("Start date is required");
    }

    if (!taskData.end_date) {
      throw new Error("End date is required");
    }

    try {
      setSaving(true);

      const customer = customers.find((c) => c.id === taskData.customer_id);
      const customerName = customer?.name || "Unknown Customer";

      let title = "";
      if (taskData.job_type) {
        title = `${customerName} - ${taskData.job_type}`;
      } else if (taskData.title) {
        title = `${customerName} - ${taskData.title}`;
      } else {
        switch (taskData.type) {
          case "job":
            title = `${customerName} - Job`;
            break;
          case "off":
            title = "Day Off";
            break;
          case "delivery":
            title = `${customerName} - Deliveries`;
            break;
          case "note":
            title = taskData.notes || "Note";
            break;
          default:
            title = customerName;
        }
      }

      let estimatedHours = taskData.estimated_hours;
      if (taskData.start_time && taskData.end_time && !estimatedHours) {
        const hours = calculateHours(taskData.start_time, taskData.end_time);
        estimatedHours = hours ? parseFloat(hours) : 8;
      }

      const cleanedData = {
        type: taskData.type,
        title: title,
        date: taskData.start_date,
        start_date: taskData.start_date,
        end_date: taskData.end_date,
        start_time: taskData.start_time,
        end_time: taskData.end_time,
        estimated_hours: estimatedHours,
        notes: taskData.notes,
        priority: taskData.priority,
        status: user?.role === "Manager" || taskData.user_id === user?.id ? "Accepted" : "Scheduled",
        user_id: taskData.user_id || user?.id,
        team_member: taskData.team_member,
        job_id: taskData.job_id,
        customer_id: taskData.customer_id,
        customer_name: customerName,
        job_type: taskData.job_type,
      };

      Object.keys(cleanedData).forEach(key => {
        if (cleanedData[key as keyof typeof cleanedData] === undefined) {
          delete cleanedData[key as keyof typeof cleanedData];
        }
      });

      console.log("📤 Creating task:", cleanedData);

      const newTask = await api.createAssignment(cleanedData);
      
      if (!newTask.start_date && cleanedData.start_date) {
        newTask.start_date = cleanedData.start_date;
      }
      if (!newTask.end_date && cleanedData.end_date) {
        newTask.end_date = cleanedData.end_date;
      }
      if (!newTask.customer_name && cleanedData.customer_name) {
        newTask.customer_name = cleanedData.customer_name;
      }
      
      const updatedTasks = [...tasks, newTask];
      setTasks(updatedTasks);
      saveToCache({ tasks: updatedTasks });
      
      console.log("✅ Task created successfully");
      return newTask;
    } finally {
      setSaving(false);
    }
  };

  const updateTask = async (id: string, taskData: Partial<Task>) => {
    if (!token) throw new Error("Not authenticated");

    try {
      setSaving(true);
      const updatedTask = await api.updateAssignment(id, taskData);
      
      const updatedTasks = tasks.map((a) => (a.id === id ? updatedTask : a));
      setTasks(updatedTasks);
      saveToCache({ tasks: updatedTasks });
      
      return updatedTask;
    } finally {
      setSaving(false);
    }
  };

  const deleteTask = async (id: string) => {
    if (!token) throw new Error("Not authenticated");

    try {
      setSaving(true);
      
      console.log(`🗑️ Deleting task: ${id}`);
      
      const response = await fetch(`http://localhost:5000/assignments/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('❌ Non-JSON response:', text);
        throw new Error('Server returned an error. Please check if the task exists.');
      }

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Failed to delete task: ${response.status}`);
      }

      const updatedTasks = tasks.filter((t) => t.id !== id);
      setTasks(updatedTasks);
      saveToCache({ tasks: updatedTasks });
      
      setShowTaskDialog(false);
      setSelectedTask(null);
      setIsEditingTask(false);
      
      console.log(`✅ Task deleted successfully`);
      
    } catch (err) {
      console.error('❌ Error deleting task:', err);
      alert(err instanceof Error ? err.message : 'Failed to delete task');
    } finally {
      setSaving(false);
    }
  };

  // Event handlers
  const toggleCalendarVisibility = (name: string) => {
    setVisibleCalendars((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  };

  const getTasksForDate = (date: Date) => {
    const dateKey = formatDateKey(date);
    const allDayTasks = tasks.filter((t) => {
      if (!t) return false;
      
      if (t.start_date && t.end_date) {
        const taskStart = new Date(t.start_date);
        const taskEnd = new Date(t.end_date);
        
        const startKey = formatDateKey(taskStart);
        const endKey = formatDateKey(taskEnd);
        
        return dateKey >= startKey && dateKey <= endKey;
      }
      
      if (t.date) {
        return t.date === dateKey;
      }
      
      if (t.start_date) {
        return formatDateKey(new Date(t.start_date)) === dateKey;
      }
      
      return false;
    });

    return allDayTasks.filter((t) => t.status !== "Declined");
  };

  const getDailyHours = (date: Date) => {
    const dayTasks = getTasksForDate(date);
    return dayTasks.reduce((total, t) => {
      if (!t || !t.estimated_hours) return total;
      const h = typeof t.estimated_hours === "string" ? parseFloat(t.estimated_hours) : t.estimated_hours || 0;
      return total + (isNaN(h) ? 0 : h);
    }, 0);
  };

  const isOverbooked = (date: Date) => getDailyHours(date) > 8;

  const getTaskColor = (task: Task) => {
    switch (task.type) {
      case "off":
        return "bg-gray-200 text-gray-800 border-gray-300";
      case "delivery":
        return getTaskColorByType("Delivery");
      case "note":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "job":
        return getTaskColorByType(task.job_type);
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const handleAddTask = async () => {
    if (!newTask.start_date || !newTask.end_date || !newTask.type) {
      alert("Please fill in required fields (Type, Start Date, and End Date)");
      return;
    }

    if (!newTask.customer_id) {
      alert("Please select a customer");
      return;
    }

    if (customAssigneeInput.trim()) saveCustomAssignee(customAssigneeInput);
    if (customTaskInput.trim()) saveCustomJobTask(customTaskInput);

    try {
      await createTask(newTask);
      
      setShowAddDialog(false);
      
      setNewTask({
        type: "job",
        start_date: formatDateKey(new Date()),
        end_date: formatDateKey(new Date()),
        start_time: "09:00",
        end_time: "17:00",
        priority: "Medium",
        status: "Scheduled",
        estimated_hours: 8,
      });
      setCustomAssigneeInput("");
      setCustomTaskInput("");
    } catch (err) {
      console.error("Error creating task:", err);
      alert(err instanceof Error ? err.message : "Failed to create task");
    }
  };

  const handleEditTask = async () => {
    if (!selectedTask) return;
    
    if (customAssigneeInput.trim()) saveCustomAssignee(customAssigneeInput);
    if (customTaskInput.trim()) saveCustomJobTask(customTaskInput);
    
    try {
      await updateTask(selectedTask.id, selectedTask);
      setShowTaskDialog(false);
      setSelectedTask(null);
      setIsEditingTask(false);
      setCustomAssigneeInput("");
      setCustomTaskInput("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update task");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    await deleteTask(taskId);
  };

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // ✅ INSTANT drag-and-drop with silent retry
  const handleDrop = async (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    if (!draggedTask) return;

    const dateKey = formatDateKey(date);
    const taskToMove = draggedTask;
    
    setDraggedTask(null);
    
    const updatedTask = {
      ...taskToMove,
      start_date: dateKey,
      date: dateKey,
      end_date: dateKey
    };
    
    const previousTasks = tasks;
    
    // ✅ INSTANT UPDATE - UI responds immediately
    const updatedTasks = tasks.map((t) => (t.id === taskToMove.id ? updatedTask : t));
    setTasks(updatedTasks);
    saveToCache({ tasks: updatedTasks });
    console.log(`🎯 Task moved instantly to ${dateKey}`);
    
    // ✅ Update server in background with retry
    const maxRetries = 3;
    let retryCount = 0;
    
    const attemptUpdate = async (): Promise<boolean> => {
      try {
        await updateTask(taskToMove.id, { 
          start_date: dateKey, 
          date: dateKey,
          end_date: dateKey
        });
        console.log(`✅ Server updated successfully`);
        return true;
      } catch (err) {
        retryCount++;
        console.error(`❌ Update failed (attempt ${retryCount}/${maxRetries})`);
        
        if (retryCount < maxRetries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          return attemptUpdate();
        }
        return false;
      }
    };
    
    const success = await attemptUpdate();
    
    if (!success) {
      console.error("❌ All retries failed, reverting");
      setTasks(previousTasks);
      saveToCache({ tasks: previousTasks });
      alert("Failed to move task after multiple attempts. Please try again or refresh the page.");
    }
  };

  const gridColumnStyle = { gridTemplateColumns: `repeat(7, 156.4px)` } as React.CSSProperties;
  const weekdayShort = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <span className="text-lg font-medium">Loading...</span>
        </div>
      </div>
    );
  }

  if (error && tasks.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center max-w-md">
          <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h3 className="mb-2 text-lg font-medium text-red-900">Error Loading Schedule</h3>
          <p className="mb-4 text-red-600">{error}</p>
          <Button onClick={() => {
            hasLoadedData.current = false;
            setError(null);
            fetchData();
          }}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="min-h-screen bg-white p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Schedule</h1>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            title="Refresh schedule"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {user?.role === "Manager" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Calendars <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Visible Calendars</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {employees.map((emp) => (
                  <DropdownMenuCheckboxItem
                    key={emp.id}
                    checked={visibleCalendars.includes(emp.full_name)}
                    onCheckedChange={() => toggleCalendarVisibility(emp.full_name)}
                  >
                    {emp.full_name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigateView("prev")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigateView("next")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="ml-4 text-xl font-semibold">
            {formatHeaderDate(currentDate, viewMode)}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="week">Week</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => {
            setNewTask(prev => ({
              ...prev,
              type: prev.type || "job",
              start_date: formatDateKey(new Date()),
              end_date: formatDateKey(new Date()),
              start_time: prev.start_time || "09:00",
              end_time: prev.end_time || "17:00",
              priority: prev.priority || "Medium",
              status: prev.status || "Scheduled",
              estimated_hours: prev.estimated_hours || 8,
            }));
            setShowAddDialog(true);
          }}>
            Add Task
          </Button>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === "month" && (
        <div className="rounded-lg border">
          <div className="grid grid-cols-7 border-b bg-gray-50">
            {weekdayShort.map((day) => (
              <div key={day} className="border-r p-2 text-center text-sm font-medium last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => {
              const isCurrentMonth = day.getMonth() === currentDate.getMonth();
              const isToday = day.toDateString() === new Date().toDateString();
              const dayTasks = getTasksForDate(day);
              const overbooked = isOverbooked(day);

              return (
                <div
                  key={idx}
                  className={`min-h-[100px] border-b border-r p-2 last:border-r-0 cursor-pointer transition-colors hover:bg-gray-50 ${
                    isCurrentMonth ? "bg-white" : "bg-gray-50"
                  } ${isToday ? "ring-2 ring-inset ring-blue-500" : ""}`}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day)}
                  onClick={() => {
                    setSelectedDate(day);
                    setShowDayViewDialog(true);
                  }}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className={`text-sm ${isToday ? "font-bold text-blue-600" : ""}`}>
                      {day.getDate()}
                    </span>
                    {overbooked && (
                      <AlertTriangle className="h-3 w-3 text-red-500" />
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayTasks.slice(0, 3).map((task) => 
                      task && task.id ? (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={() => handleDragStart(task)}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTask(task);
                            setShowTaskDialog(true);
                          }}
                          className={`cursor-pointer rounded border px-2 py-1 text-xs ${getTaskColor(task)}`}
                        >
                          {task.title}
                        </div>
                      ) : null
                    )}
                    {dayTasks.length > 3 && (
                      <div className="text-xs text-gray-500">
                        +{dayTasks.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === "week" && (
        <div className="rounded-lg border">
          <div className="grid grid-cols-8 border-b bg-gray-50">
            <div className="border-r p-2"></div>
            {daysOfWeek.map((day) => (
              <div key={day.toISOString()} className="border-r p-2 text-center last:border-r-0">
                <div className="text-sm font-medium">{weekdayShort[day.getDay() === 0 ? 6 : day.getDay() - 1]}</div>
                <div className="text-xs text-gray-600">{day.getDate()}</div>
              </div>
            ))}
          </div>
          <div className="relative grid grid-cols-8">
            <div className="border-r">
              {timeSlotsWeek.map((time) => (
                <div key={time} className="border-b p-2 text-xs text-gray-600" style={{ height: `${HOUR_HEIGHT_PX}px` }}>
                  {time}
                </div>
              ))}
            </div>
            {daysOfWeek.map((day) => {
              const dayTasks = getTasksForDate(day);
              return (
                <div
                  key={day.toISOString()}
                  className="relative border-r last:border-r-0"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, day)}
                >
                  {timeSlotsWeek.map((time) => (
                    <div
                      key={time}
                      className="border-b"
                      style={{ height: `${HOUR_HEIGHT_PX}px` }}
                    />
                  ))}
                  {dayTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={() => handleDragStart(task)}
                      onClick={() => {
                        setSelectedTask(task);
                        setShowTaskDialog(true);
                      }}
                      className={`cursor-pointer rounded border p-1 text-xs ${getTaskColor(task)}`}
                      style={getTaskWeekStyle(task.start_time, task.end_time)}
                    >
                      <div className="font-medium">{task.title}</div>
                      <div className="text-xs opacity-75">
                        {task.start_time} - {task.end_time}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={newTask.type}
                onValueChange={(value: "job" | "off" | "delivery" | "note") => {
                  setNewTask({ ...newTask, type: value });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="job">Job</SelectItem>
                  <SelectItem value="off">Off</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={newTask.start_date}
                  onChange={(e) => setNewTask({ ...newTask, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={newTask.end_date}
                  onChange={(e) => setNewTask({ ...newTask, end_date: e.target.value })}
                />
              </div>
            </div>

            {(newTask.type === "job" || newTask.type === "off") && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Start Time</Label>
                    <Input
                      type="time"
                      value={newTask.start_time || ""}
                      onChange={(e) => setNewTask({ ...newTask, start_time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>End Time</Label>
                    <Input
                      type="time"
                      value={newTask.end_time || ""}
                      onChange={(e) => setNewTask({ ...newTask, end_time: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Assign To</Label>
              <Input
                placeholder="Type team member name..."
                list="assignee-suggestions"
                value={customAssigneeInput}
                onChange={(e) => {
                  setCustomAssigneeInput(e.target.value);
                  setNewTask({ ...newTask, team_member: e.target.value });
                }}
              />
              <datalist id="assignee-suggestions">
                {customAssignees.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            {newTask.type === "job" && (
              <div className="space-y-2">
                <Label>Job/Task</Label>
                <Select
                  value={newTask.job_type || newTask.title || ""}
                  onValueChange={(value) => {
                    if (value.includes(" - ")) {
                      const jobId = availableJobs.find(
                        (j) => `${j.job_reference} - ${j.customer_name}` === value
                      )?.id;
                      setNewTask({
                        ...newTask,
                        title: value,
                        job_id: jobId,
                        job_type: undefined,
                      });
                    } else {
                      setNewTask({
                        ...newTask,
                        title: value,
                        job_type: value,
                        job_id: undefined,
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select job or task" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Standard Tasks</SelectLabel>
                      {interiorDesignJobTypes.map((task) => (
                        <SelectItem key={task} value={task}>
                          {task}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                    {customJobTasks.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Custom Tasks</SelectLabel>
                        {customJobTasks.map((task) => (
                          <SelectItem key={task} value={task}>
                            {task}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {availableJobs.length > 0 && (
                      <SelectGroup>
                        <SelectLabel>Available Jobs</SelectLabel>
                        {availableJobs.map((job) => (
                          <SelectItem
                            key={job.id}
                            value={`${job.job_reference} - ${job.customer_name}`}
                          >
                            {job.job_reference} - {job.customer_name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Customer *</Label>
              <Select
                value={newTask.customer_id || ""}
                onValueChange={(value) => {
                  setNewTask({
                    ...newTask,
                    customer_id: value,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <textarea
                className="w-full min-h-[100px] p-2 border rounded-md"
                value={newTask.notes || ""}
                onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })}
                placeholder="Add any additional notes..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddTask} disabled={saving}>
                {saving ? "Adding..." : "Add Task"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View/Edit Dialog */}
      <Dialog open={showTaskDialog} onOpenChange={setShowTaskDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditingTask ? "Edit Task" : "Task Details"}
            </DialogTitle>
          </DialogHeader>

          {selectedTask && (
            <div className="space-y-4">
              <div>
                <Label>Title</Label>
                <p className="text-sm">{selectedTask.title}</p>
              </div>
              {selectedTask.start_date && (
                <div>
                  <Label>Start Date</Label>
                  <p className="text-sm">{selectedTask.start_date}</p>
                </div>
              )}
              {selectedTask.end_date && (
                <div>
                  <Label>End Date</Label>
                  <p className="text-sm">{selectedTask.end_date}</p>
                </div>
              )}
              {selectedTask.start_time && (
                <div>
                  <Label>Time</Label>
                  <p className="text-sm">
                    {selectedTask.start_time} - {selectedTask.end_time}
                  </p>
                </div>
              )}
              {selectedTask.notes && (
                <div>
                  <Label>Notes</Label>
                  <p className="text-sm">{selectedTask.notes}</p>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowTaskDialog(false);
                    setSelectedTask(null);
                  }}
                >
                  Close
                </Button>
                {(user?.role === "Manager" || user?.role === "Sales") && (
                  <Button
                    variant="destructive"
                    onClick={() => selectedTask && handleDeleteTask(selectedTask.id)}
                    disabled={saving}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Day View Dialog */}
      <Dialog open={showDayViewDialog} onOpenChange={setShowDayViewDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Tasks for {selectedDate && selectedDate.toLocaleDateString('en-GB', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedDate && getTasksForDate(selectedDate).length > 0 ? (
              <div className="space-y-3">
                {getTasksForDate(selectedDate).map((task) => (
                  <div
                    key={task.id}
                    className={`cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md ${getTaskColor(task)}`}
                    onClick={() => {
                      setSelectedTask(task);
                      setShowDayViewDialog(false);
                      setShowTaskDialog(true);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-base mb-1">{task.title}</h3>
                        {task.customer_name && (
                          <p className="text-sm text-gray-600 mb-1">
                            Customer: {task.customer_name}
                          </p>
                        )}
                        {task.start_time && (
                          <p className="text-sm text-gray-600 mb-1">
                            Time: {task.start_time} - {task.end_time}
                          </p>
                        )}
                        {task.team_member && (
                          <p className="text-sm text-gray-600 mb-1">
                            Assigned: {task.team_member}
                          </p>
                        )}
                        {task.notes && (
                          <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                            {task.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {task.priority && (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            task.priority === 'High' 
                              ? 'bg-red-100 text-red-700' 
                              : task.priority === 'Medium'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {task.priority}
                          </span>
                        )}
                        {task.status && (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            task.status === 'Completed'
                              ? 'bg-green-100 text-green-700'
                              : task.status === 'In Progress'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {task.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No tasks scheduled for this date.
                <div className="mt-4">
                  <Button
                    onClick={() => {
                      if (selectedDate) {
                        setNewTask({
                          type: "job",
                          start_date: formatDateKey(selectedDate),
                          end_date: formatDateKey(selectedDate),
                          start_time: "09:00",
                          end_time: "17:00",
                          priority: "Medium",
                          status: "Scheduled",
                          estimated_hours: 8,
                        });
                        setShowDayViewDialog(false);
                        setShowAddDialog(true);
                      }
                    }}
                  >
                    Add Task for This Date
                  </Button>
                </div>
              </div>
            )}
            
            {selectedDate && getTasksForDate(selectedDate).length > 0 && (
              <div className="flex justify-between items-center pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setShowDayViewDialog(false)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    if (selectedDate) {
                      setNewTask({
                        type: "job",
                        start_date: formatDateKey(selectedDate),
                        end_date: formatDateKey(selectedDate),
                        start_time: "09:00",
                        end_time: "17:00",
                        priority: "Medium",
                        status: "Scheduled",
                        estimated_hours: 8,
                      });
                      setShowDayViewDialog(false);
                      setShowAddDialog(true);
                    }
                  }}
                >
                  Add New Task
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}