"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { api } from "@/lib/api"; // ✅ Use centralized API

type Notification = {
  id: string;
  client_id?: number;
  contract_id?: number;
  message: string;
  priority: string;
  notification_type: string;
  created_at: string;
  read: boolean;
  dismissed: boolean;
};

type NotificationContextType = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const POLL_INTERVAL_MS = 60_000; // 60 seconds
const NOTIFICATION_SOUND_PATH = process.env.NEXT_PUBLIC_NOTIFICATION_SOUND_PATH;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const previousUnreadCountRef = useRef<number>(0);
  const isFetchingRef = useRef(false);
  const consecutiveFailsRef = useRef(0);
  const hasInteractedRef = useRef(false);

  // Track user interaction for audio autoplay
  useEffect(() => {
    const markInteracted = () => { hasInteractedRef.current = true; };
    window.addEventListener('click', markInteracted, { once: true });
    window.addEventListener('keydown', markInteracted, { once: true });
    return () => {
      window.removeEventListener('click', markInteracted);
      window.removeEventListener('keydown', markInteracted);
    };
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (isFetchingRef.current) return;

    const token = localStorage.getItem("auth_token");
    if (!token) {
      setLoading(false);
      return;
    }

    isFetchingRef.current = true;

    try {
      // ✅ Use centralized API (benefits from request deduplication)
      const data = await api.getNotifications();
      consecutiveFailsRef.current = 0;

      const newNotifications: Notification[] = data.notifications || [];
      const newUnreadCount: number = data.unread_count || 0;

      setNotifications(newNotifications);
      setUnreadCount(newUnreadCount);

      // Play sound for new urgent notifications
      if (
        hasInteractedRef.current &&
        newUnreadCount > previousUnreadCountRef.current &&
        previousUnreadCountRef.current >= 0
      ) {
        const hasUrgent = newNotifications.some(
          (n) => !n.read && n.priority === 'urgent'
        );

        if (hasUrgent && NOTIFICATION_SOUND_PATH) {
          const audio = new Audio(NOTIFICATION_SOUND_PATH);
          audio.volume = 1.0;
          audio.play().catch(() => {});

          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("🚨 Urgent Contract Expiry!", {
              body: "You have contracts expiring soon. Check notifications now!",
              icon: "/favicon.ico",
            });
          }
        }
      }

      previousUnreadCountRef.current = newUnreadCount;
    } catch (error) {
      consecutiveFailsRef.current += 1;
      console.error("Failed to fetch notifications:", error);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Poll with exponential backoff
  useEffect(() => {
    fetchNotifications();

    const scheduleNext = () => {
      const fails = consecutiveFailsRef.current;
      const delay = fails > 0
        ? Math.min(POLL_INTERVAL_MS * Math.pow(2, fails - 1), 300_000)
        : POLL_INTERVAL_MS;

      return setTimeout(() => {
        fetchNotifications();
        timer = scheduleNext();
      }, delay);
    };

    let timer = scheduleNext();
    return () => clearTimeout(timer);
  }, [fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        
        markAsRead: useCallback(async (id: string) => {
          try {
            await api.markNotificationAsRead(id);
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
            setUnreadCount((prev) => Math.max(0, prev - 1));
          } catch (error) {
            console.error("Failed to mark as read:", error);
          }
        }, []),

        markAllAsRead: useCallback(async () => {
          try {
            await api.markAllNotificationsAsRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnreadCount(0);
          } catch (error) {
            console.error("Failed to mark all as read:", error);
          }
        }, []),

        dismissNotification: useCallback(async (id: string) => {
          try {
            await api.dismissNotification(id);
            setNotifications((prev) => {
              const n = prev.find((n) => n.id === id);
              if (n && !n.read) setUnreadCount((c) => Math.max(0, c - 1));
              return prev.filter((n) => n.id !== id);
            });
          } catch (error) {
            console.error("Failed to dismiss notification:", error);
          }
        }, []),

        deleteNotification: useCallback(async (id: string) => {
          try {
            await api.deleteNotification(id);
            setNotifications((prev) => {
              const n = prev.find((n) => n.id === id);
              if (n && !n.read) setUnreadCount((c) => Math.max(0, c - 1));
              return prev.filter((n) => n.id !== id);
            });
          } catch (error) {
            console.error("Failed to delete notification:", error);
          }
        }, []),

        clearAllNotifications: useCallback(async () => {
          try {
            await api.clearAllNotifications();
            setNotifications([]);
            setUnreadCount(0);
          } catch (error) {
            console.error("Failed to clear all notifications:", error);
          }
        }, []),
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
