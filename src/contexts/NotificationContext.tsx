"use client";

import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

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

// ✅ Poll every 60 seconds — not 30. Halves the connection load.
const POLL_INTERVAL_MS = 60_000;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const previousUnreadCountRef = useRef<number>(0);
  const isFetchingRef = useRef(false);       // ✅ Prevent concurrent fetches
  const consecutiveFailsRef = useRef(0);     // ✅ Track failures for backoff
  const hasInteractedRef = useRef(false);    // ✅ Track user interaction for autoplay

  // ✅ Track user interaction so audio can play (browser autoplay policy)
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
    // ✅ Skip if already fetching (prevents stacked requests)
    if (isFetchingRef.current) return;

    const token = localStorage.getItem("auth_token");
    if (!token) {
      setLoading(false);
      return;
    }

    isFetchingRef.current = true;

    try {
      const response = await fetch(`${API_BASE_URL}/notifications/production`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        consecutiveFailsRef.current = 0; // ✅ Reset fail counter on success

        const newNotifications: Notification[] = data.notifications || [];
        const newUnreadCount: number = data.unread_count || 0;

        setNotifications(newNotifications);
        setUnreadCount(newUnreadCount);

        // ✅ Play sound only if user has interacted with the page first
        if (
          hasInteractedRef.current &&
          newUnreadCount > previousUnreadCountRef.current &&
          previousUnreadCountRef.current >= 0
        ) {
          const hasUrgent = newNotifications.some(
            (n) => !n.read && n.priority === 'urgent'
          );

          if (hasUrgent) {
            // ✅ Create audio inline — avoids autoplay block on mount
            const audio = new Audio('/notification-sound.mp3');
            audio.volume = 1.0;
            audio.play().catch(() => {}); // Silently ignore if still blocked

            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("🚨 Urgent Contract Expiry!", {
                body: "You have contracts expiring soon. Check notifications now!",
                icon: "/favicon.ico",
              });
            }
          }
        }

        previousUnreadCountRef.current = newUnreadCount;
      } else {
        consecutiveFailsRef.current += 1;
      }
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

  // ✅ Poll with exponential backoff on consecutive failures
  useEffect(() => {
    fetchNotifications();

    const scheduleNext = () => {
      // Back off: 60s → 120s → 240s → max 300s on repeated failures
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
            const token = localStorage.getItem("auth_token");
            await fetch(`${API_BASE_URL}/notifications/mark-read/${id}`, {
              method: "PATCH",
              headers: { Authorization: `Bearer ${token}` },
            });
            setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
            setUnreadCount((prev) => Math.max(0, prev - 1));
          } catch (error) {
            console.error("Failed to mark as read:", error);
          }
        }, []),

        markAllAsRead: useCallback(async () => {
          try {
            const token = localStorage.getItem("auth_token");
            await fetch(`${API_BASE_URL}/notifications/mark-all-read`, {
              method: "PATCH",
              headers: { Authorization: `Bearer ${token}` },
            });
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
            setUnreadCount(0);
          } catch (error) {
            console.error("Failed to mark all as read:", error);
          }
        }, []),

        dismissNotification: useCallback(async (id: string) => {
          try {
            const token = localStorage.getItem("auth_token");
            await fetch(`${API_BASE_URL}/notifications/dismiss/${id}`, {
              method: "PATCH",
              headers: { Authorization: `Bearer ${token}` },
            });
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
            const token = localStorage.getItem("auth_token");
            await fetch(`${API_BASE_URL}/notifications/delete/${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
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
            const token = localStorage.getItem("auth_token");
            await fetch(`${API_BASE_URL}/notifications/clear-all`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
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