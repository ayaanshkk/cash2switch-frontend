"use client";

import React, { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Filter, Search, Trash2, X, ExternalLink, FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotifications } from '@/contexts/NotificationContext';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  message: string;
  read: boolean;
  dismissed: boolean;
  created_at: string;
  customer_id?: string;
  job_id?: string;
  checklist_id?: string;
  form_submission_id?: number;
  form_type?: string;
  moved_by?: string;
}

const NotificationsPage = () => {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'read'>('all');
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());

  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    fetchAllNotifications,
  } = useNotifications();

  useEffect(() => {
    fetchAllNotifications();
  }, [fetchAllNotifications]);

  const parseNotificationMessage = (message: string) => {
    const parts = message.split('\n');
    const mainMessage = parts[0];
    const changes = parts.slice(1).filter(c => c.trim());
    
    return { mainMessage, changes };
  };

  const renderChange = (change: string) => {
    const trimmed = change.trim();
    
    if (trimmed.startsWith('✅')) {
      return <span className="text-green-600 font-medium">{trimmed}</span>;
    } else if (trimmed.startsWith('❌')) {
      return <span className="text-red-600 font-medium">{trimmed}</span>;
    } else if (trimmed.startsWith('➕')) {
      return <span className="text-blue-600 font-medium">{trimmed}</span>;
    } else if (trimmed.startsWith('➖')) {
      return <span className="text-orange-600 font-medium">{trimmed}</span>;
    } else if (trimmed.startsWith('✏️')) {
      return <span className="text-purple-600 font-medium">{trimmed}</span>;
    } else if (trimmed.startsWith('•')) {
      return <span className="text-gray-700 ml-2">{trimmed}</span>;
    }
    
    return <span className="text-gray-700">{trimmed}</span>;
  };

  const getNotificationIcon = (message: string, form_type?: string) => {
    if (message.includes('Invoice') || message.includes('💰')) return '💰';
    if (message.includes('Receipt') || message.includes('🧾')) return '🧾';
    if (message.includes('Checklist') || message.includes('📋')) return '📋';
    if (message.includes('stage') || message.includes('🔄')) return '🔄';
    if (message.includes('Delivery') || message.includes('🚚')) return '🚚';
    if (message.includes('Complete') || message.includes('🎉')) return '🎉';
    if (message.includes('Accepted') || message.includes('✅')) return '✅';
    if (message.includes('Production') || message.includes('🏭')) return '🏭';
    if (message.includes('Installation') || message.includes('🔧')) return '🔧';
    return '🔔';
  };

  const deleteAllRead = async () => {
    if (!window.confirm('Delete all read notifications? This cannot be undone.')) {
      return;
    }
    const readIds = notifications.filter(n => n.read).map(n => n.id);
    for (const id of readIds) {
      await deleteNotification(id);
    }
  };

  const toggleSelectNotification = (id: string) => {
    setSelectedNotifications((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const deleteSelected = async () => {
    if (!window.confirm(`Delete ${selectedNotifications.size} selected notifications? This cannot be undone.`)) {
      return;
    }
    for (const id of Array.from(selectedNotifications)) {
      await deleteNotification(id);
    }
    setSelectedNotifications(new Set());
  };

  const handleClearAll = async () => {
    if (!window.confirm('⚠️ PERMANENTLY DELETE ALL notifications? This action cannot be undone.')) {
      return;
    }
    await clearAllNotifications();
    setSelectedNotifications(new Set());
  };

  const filteredNotifications = notifications
    .filter((notif: Notification) => {
      if (activeTab === 'unread') return !notif.read;
      if (activeTab === 'read') return notif.read;
      return true;
    })
    .filter((notif: Notification) =>
      notif.message.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="container mx-auto py-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Bell className="h-8 w-8" />
              All Notifications
            </h1>
            <p className="text-muted-foreground mt-1">
              Complete notification history with detailed changes
            </p>
          </div>
          <div className="flex gap-2">
            {selectedNotifications.size > 0 && (
              <Button variant="destructive" onClick={deleteSelected} size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected ({selectedNotifications.size})
              </Button>
            )}
            <Button variant="outline" onClick={markAllAsRead} size="sm">
              <CheckCheck className="h-4 w-4 mr-2" />
              Mark All Read
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-2" />
                  More Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={deleteAllRead}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete All Read
                </DropdownMenuItem>
                <DropdownMenuItem onClick={fetchAllNotifications}>
                  <Bell className="h-4 w-4 mr-2" />
                  Refresh
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleClearAll} className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  <span>Clear All (Permanent)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notifications..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mb-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">
            All
            <Badge variant="secondary" className="ml-2">
              {notifications.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="unread">
            Unread
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="read">Read</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Notifications List */}
      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      ) : filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No notifications</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery
                  ? 'No notifications match your search'
                  : activeTab === 'unread'
                  ? "You're all caught up!"
                  : 'No notifications yet'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[calc(100vh-320px)]">
          <div className="space-y-3">
            {filteredNotifications.map((notification: Notification) => {
              const { mainMessage, changes } = parseNotificationMessage(notification.message);
              const icon = getNotificationIcon(notification.message, notification.form_type);
              const isSelected = selectedNotifications.has(notification.id);
              const hasChanges = changes.length > 0;

              return (
                <Card
                  key={notification.id}
                  className={`transition-all hover:shadow-md ${
                    !notification.read ? 'border-l-4 border-l-primary bg-primary/5' : ''
                  } ${isSelected ? 'ring-2 ring-primary' : ''} ${
                    notification.dismissed ? 'opacity-60' : ''
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectNotification(notification.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 cursor-pointer"
                      />

                      {/* Icon */}
                      <div className="flex-shrink-0">
                        <div className="text-3xl">{icon}</div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-3">
                        {/* Main Message */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm ${!notification.read ? 'font-semibold' : ''}`}>
                                {mainMessage}
                              </p>
                              {notification.dismissed && (
                                <Badge variant="outline" className="text-xs">
                                  Hidden from sidebar
                                </Badge>
                              )}
                            </div>
                            
                            {/* Display detailed changes */}
                            {hasChanges && (
                              <div className="mt-3 space-y-2 bg-gradient-to-br from-gray-50 to-gray-100 p-4 rounded-lg border border-gray-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                  <FileText className="h-4 w-4 text-gray-600" />
                                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                                    Changes Made:
                                  </p>
                                </div>
                                <ul className="space-y-1.5">
                                  {changes.map((change, idx) => (
                                    <li key={idx} className="text-sm leading-relaxed">
                                      {renderChange(change)}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          {!notification.read && (
                            <div className="flex-shrink-0 w-2 h-2 bg-primary rounded-full mt-1.5" />
                          )}
                        </div>

                        {/* Metadata */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {formatDistanceToNow(new Date(notification.created_at), {
                              addSuffix: true,
                            })}
                          </span>
                          {notification.moved_by && (
                            <>
                              <span>•</span>
                              <span>By: {notification.moved_by}</span>
                            </>
                          )}
                        </div>

                        {/* Action Links */}
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          {notification.customer_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/dashboard/clients/${notification.customer_id}`)}
                              className="h-8"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View Client
                            </Button>
                          )}
                          
                          {notification.job_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/dashboard/jobs/${notification.job_id}`)}
                              className="h-8"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View Job
                            </Button>
                          )}
                          
                          {notification.form_submission_id && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                router.push(`/checklist-view?id=${notification.form_submission_id}`);
                              }}
                              className="h-8 bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              View {notification.form_type ? notification.form_type.charAt(0).toUpperCase() + notification.form_type.slice(1) : 'Checklist'}
                            </Button>
                          )}
                          
                          {notification.checklist_id && !notification.form_submission_id && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                router.push(`/checklist-view?id=${notification.checklist_id}`);
                              }}
                              className="h-8 bg-purple-600 hover:bg-purple-700 text-white"
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              View Checklist
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!notification.read && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsRead(notification.id)}
                            className="h-8 w-8 p-0"
                            title="Mark as read"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteNotification(notification.id)}
                          className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                          title="Delete notification permanently"
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