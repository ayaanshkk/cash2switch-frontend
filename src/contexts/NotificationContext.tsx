"use client";

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';

interface Notification {
  id: string;
  message: string;
  read: boolean;
  dismissed: boolean;  // ✅ NEW
  created_at: string;
  customer_id?: string;
  job_id?: string;
  form_submission_id?: number;
  form_type?: string;
  moved_by?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (id: string) => Promise<void>;  // ✅ NEW
  deleteNotification: (id: string) => Promise<void>;
  clearAllNotifications: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  fetchAllNotifications: () => Promise<void>;  // ✅ NEW: For full page
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const unreadCount = notifications.filter(n => !n.read && !n.dismissed).length;

  // ✅ Fetch notifications (for sidebar - excludes dismissed)
  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/notifications/production`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ NEW: Fetch ALL notifications (for full page - includes dismissed)
  const fetchAllNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${BACKEND_URL}/notifications/production/all`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Failed to fetch all notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = async (id: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/notifications/production/${id}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, read: true } : n))
        );
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/notifications/production/mark-all-read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => ({ ...n, read: true }))
        );
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // ✅ NEW: Dismiss notification (hide from sidebar, keep in full page)
  const dismissNotification = async (id: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/notifications/production/${id}/dismiss`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Mark as dismissed in local state
        setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, dismissed: true } : n))
        );
      }
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/notifications/production/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const clearAllNotifications = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${BACKEND_URL}/notifications/production/clear-all`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Failed to clear all notifications:', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        dismissNotification,  // ✅ NEW
        deleteNotification,
        clearAllNotifications,
        fetchNotifications,
        fetchAllNotifications,  // ✅ NEW
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}