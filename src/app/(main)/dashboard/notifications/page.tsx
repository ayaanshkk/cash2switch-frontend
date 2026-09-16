"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Check, CheckCheck, Filter, Search, Trash2, X, ExternalLink, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotifications } from '@/contexts/NotificationContext';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  message: string;
  read: boolean;
  dismissed: boolean;
  created_at: string;
  client_id?: number;
  contract_id?: number;
  notification_type: string;
  priority: string;
}

// Extract display ID embedded in notification message (🆔 ID: 123)
function extractDisplayId(message: string): string | null {
  const match = message.match(/🆔 ID:\s*(\d+)/);
  return match ? match[1] : null;
}

function getNotificationIcon(n: Notification) {
  if (n.notification_type === 'assignment') return '📋';
  if (n.priority === 'urgent') return '🚨';
  if (n.notification_type?.includes('expiry')) return '⏰';
  return '📌';
}

function getNotificationLabel(n: Notification) {
  if (n.notification_type === 'assignment') return { label: 'ASSIGNED', className: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800' };
  if (n.notification_type === 'contract_expiry_0_30') return { label: '0-30 DAYS', className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800' };
  if (n.notification_type === 'contract_expiry_31_60') return { label: '31-60 DAYS', className: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800' };
  return null;
}

const NotificationsPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'read' | 'expiry' | 'assignments'>('all');
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());

  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    fetchNotifications,
  } = useNotifications();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const deleteAllRead = async () => {
    if (!window.confirm('Delete all read notifications?')) return;
    for (const n of notifications.filter(n => n.read)) {
      await deleteNotification(n.id);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedNotifications(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const deleteSelected = async () => {
    if (!window.confirm(`Delete ${selectedNotifications.size} selected notifications?`)) return;
    for (const id of Array.from(selectedNotifications)) {
      await deleteNotification(id);
    }
    setSelectedNotifications(new Set());
  };

  const handleClearAll = async () => {
    if (!window.confirm('⚠️ PERMANENTLY DELETE ALL notifications? This cannot be undone.')) return;
    await clearAllNotifications();
    setSelectedNotifications(new Set());
  };

  const expiryCount = notifications.filter(n => n.notification_type?.includes('expiry')).length;
  const assignmentCount = notifications.filter(n => n.notification_type === 'assignment').length;

  const filteredNotifications = notifications.filter((n: Notification) => {
    if (activeTab === 'unread') return !n.read;
    if (activeTab === 'read') return n.read;
    if (activeTab === 'expiry') return n.notification_type?.includes('expiry');
    if (activeTab === 'assignments') return n.notification_type === 'assignment';
    return true;
  }).filter((n: Notification) =>
    n.message.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="container mx-auto py-6 max-w-5xl text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 text-slate-950 dark:text-slate-50">
              <Bell className="h-8 w-8" />
              Notifications
            </h1>
            <p className="text-muted-foreground mt-1 dark:text-slate-400">
              Contract expiry reminders and assignment notifications
            </p>
          </div>
          <div className="flex gap-2">
            {selectedNotifications.size > 0 && (
              <Button variant="destructive" onClick={deleteSelected} size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected ({selectedNotifications.size})
              </Button>
            )}
            <Button variant="outline" onClick={markAllAsRead} size="sm" className="dark:border-slate-700 dark:hover:bg-slate-800">
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="dark:border-slate-700 dark:hover:bg-slate-800">
                  <Filter className="h-4 w-4 mr-2" />
                  More Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="dark:border-slate-800 dark:bg-slate-900">
                <DropdownMenuItem onClick={deleteAllRead} className="dark:hover:bg-slate-800">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All Read
                </DropdownMenuItem>
                <DropdownMenuItem onClick={fetchNotifications} className="dark:hover:bg-slate-800">
                  <Bell className="h-4 w-4 mr-2" />
                  Refresh
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleClearAll} className="text-red-600 dark:text-red-400 dark:hover:bg-slate-800">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear All (Permanent)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-slate-500" />
          <Input
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="mb-6">
        <TabsList className="grid w-full grid-cols-5 bg-slate-100 dark:border dark:border-slate-800 dark:bg-slate-900">
          <TabsTrigger value="all" className="dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100">
            All <Badge variant="secondary" className="ml-2 dark:bg-slate-800 dark:text-slate-300">{notifications.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="unread" className="dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100">
            Unread {unreadCount > 0 && <Badge variant="destructive" className="ml-2">{unreadCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="expiry" className="dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100">
            Expiring {expiryCount > 0 && <Badge className="ml-2 bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300">{expiryCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="assignments" className="dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100">
            Assigned {assignmentCount > 0 && <Badge className="ml-2 bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">{assignmentCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="read" className="dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-100">Read</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* List */}
      {loading ? (
        <Card className="border-slate-200 dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          </CardContent>
        </Card>
      ) : filteredNotifications.length === 0 ? (
        <Card className="border-slate-200 dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground dark:text-slate-500 mb-4" />
              <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">No notifications</h3>
              <p className="text-sm text-muted-foreground dark:text-slate-400 mt-1">
                {searchQuery ? 'No notifications match your search'
                  : activeTab === 'unread' ? "You're all caught up!"
                  : activeTab === 'expiry' ? 'No expiring contracts'
                  : activeTab === 'assignments' ? 'No assignment notifications'
                  : 'No notifications yet'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-340px)]">
          <div className="space-y-3">
            {filteredNotifications.map((notification: Notification) => {
              const icon = getNotificationIcon(notification);
              const label = getNotificationLabel(notification);
              const isSelected = selectedNotifications.has(notification.id);
              const isUrgent = notification.priority === 'urgent';
              const isAssignment = notification.notification_type === 'assignment';
              const displayId = extractDisplayId(notification.message);

              return (
                <Card
                  key={notification.id}
                  className={`border-slate-200 transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900 ${
                    !notification.read ? 'border-l-4 border-l-primary bg-primary/5 dark:bg-slate-800/60' : ''
                  } ${isSelected ? 'ring-2 ring-primary' : ''} ${
                    isUrgent && !isAssignment ? 'border-l-4 border-l-red-500 bg-red-50 dark:border-l-red-500 dark:bg-red-950/20' : ''
                  } ${isAssignment ? 'border-l-4 border-l-blue-400 bg-blue-50/30 dark:border-l-blue-500 dark:bg-blue-950/20' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(notification.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:checked:bg-primary"
                      />
                      <div className="text-3xl flex-shrink-0">{icon}</div>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {isUrgent && !isAssignment && (
                                <Badge variant="destructive" className="text-xs">Urgent</Badge>
                              )}
                              {label && (
                                <Badge variant="outline" className={`text-xs ${label.className}`}>
                                  {label.label}
                                </Badge>
                              )}
                            </div>
                            <p className={`text-sm whitespace-pre-line text-slate-800 dark:text-slate-200 ${!notification.read ? 'font-semibold text-slate-950 dark:text-slate-50' : ''}`}>
                              {notification.message}
                            </p>
                          </div>
                          {!notification.read && (
                            <div className="flex-shrink-0 w-2 h-2 bg-primary rounded-full mt-1.5" />
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-slate-400">
                          <span>
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                          <span>•</span>
                          <span className="capitalize">{notification.notification_type.replace(/_/g, ' ')}</span>
                        </div>

                        {notification.client_id && (
                          <div className="flex items-center gap-2 pt-1 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const urlId = displayId || notification.client_id;
                                window.open(`/dashboard/renewals/${urlId}`, '_blank');
                              }}
                              className="h-8 dark:border-slate-700 dark:hover:bg-slate-800"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View Customer
                            </Button>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!notification.read && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => markAsRead(notification.id)}
                            className="h-8 w-8 p-0 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                            title="Mark as read"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => deleteNotification(notification.id)}
                          className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          title="Delete"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

export default NotificationsPage;