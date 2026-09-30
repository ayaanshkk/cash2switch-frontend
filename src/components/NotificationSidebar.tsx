"use client";

import {
  Bell, X, Trash2, CheckCheck, ExternalLink, AlertCircle,
  UserCheck, Clock, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

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

function extractDisplayId(message: string): string | null {
  const match = message.match(/(?:🆔 )?ID:\s*(\d+)/);
  return match ? match[1] : null;
}

function stripEmojis(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|\u{200D}|\u{FE0F}/gu, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/^ /gm, '')
    .trim();
}

export function NotificationSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAllNotifications,
  } = useNotifications();

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all notifications?')) return;
    await clearAllNotifications();
  };

  const handleViewAll = () => {
    setIsOpen(false);
    router.push('/dashboard/notifications');
  };

  const displayedNotifications = notifications.filter((n) => !n.dismissed);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-6 w-6 flex items-center justify-center p-0 text-xs font-bold shadow-lg"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:w-[600px] p-0 data-[state=open]:duration-150 data-[state=closed]:duration-150">
        <div className="flex h-full flex-col">
          {/* Header */}
          <SheetHeader className="border-b px-6 py-4 bg-white">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-xl flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  Notifications
                </SheetTitle>
                <SheetDescription>
                  {unreadCount > 0
                    ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}`
                    : 'All caught up!'}
                </SheetDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleViewAll}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              >
                <span className="text-sm font-medium">View All</span>
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center space-x-2 mt-3">
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllAsRead}
                  className="flex items-center space-x-1 flex-1"
                >
                  <CheckCheck className="h-4 w-4" />
                  <span>Mark all read</span>
                </Button>
              )}
              {displayedNotifications.length > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClearAll}
                  className="flex items-center space-x-1 flex-1"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>Clear all</span>
                </Button>
              )}
            </div>
          </SheetHeader>

          {/* Notifications List */}
          <ScrollArea className="flex-1 h-0 min-h-0">
            {displayedNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <Bell className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No notifications</h3>
                <p className="text-sm text-gray-500">You&apos;re all caught up!</p>
              </div>
            ) : (
              <div className="divide-y">
                {displayedNotifications.map((notification) => {
                  const isUrgent = notification.priority === 'urgent';
                  const isAssignment = notification.notification_type === 'assignment';
                  const isExpiry = notification.notification_type?.includes('expiry');
                  const displayId = extractDisplayId(notification.message);

                  const IconComponent = isAssignment ? UserCheck : isExpiry ? Clock : FileText;
                  const iconColor = isAssignment ? 'text-blue-600' : isUrgent ? 'text-red-600' : 'text-gray-500';
                  const iconBg = isAssignment ? 'bg-blue-50' : isUrgent ? 'bg-red-50' : 'bg-gray-100';

                  return (
                    <div
                      key={notification.id}
                      className={`group relative px-6 py-4 transition-colors hover:bg-gray-50 ${
                        !notification.read ? 'bg-slate-50 border-l-4 border-l-slate-700' : ''
                      } ${isUrgent && notification.read ? 'border-l-4 border-l-red-400' : ''
                      } ${isAssignment && notification.read ? 'border-l-4 border-l-blue-400' : ''}`}
                    >
                      <div className="flex items-start justify-between space-x-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start space-x-3 mb-2">
                            <div className={`mt-0.5 flex-shrink-0 rounded-md p-1.5 ${iconBg}`}>
                              <IconComponent className={`h-4 w-4 ${iconColor}`} />
                            </div>
                            <div className="flex-1">
                              <div className={`${!notification.read ? 'font-semibold' : 'font-normal'} whitespace-pre-line text-sm text-gray-800 leading-relaxed`}>
                                {stripEmojis(notification.message)}
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 flex items-center space-x-3 text-xs text-gray-400 ml-10">
                            <span>
                              {new Date(notification.created_at).toLocaleString('en-GB', {
                                day: '2-digit', month: 'short', year: 'numeric',
                                hour: '2-digit', minute: '2-digit',
                              })}
                            </span>
                            {isUrgent && (
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-700 ring-1 ring-inset ring-red-200">
                                Urgent
                              </span>
                            )}
                            {isAssignment && (
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200">
                                Assignment
                              </span>
                            )}
                            {isExpiry && (
                              <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200">
                                Contract Expiry
                              </span>
                            )}
                          </div>

                          {notification.client_id && (
                            <div className="mt-3 ml-10">
                              <button
                                onClick={() => {
                                  setIsOpen(false);
                                  const urlId = displayId || notification.client_id;
                                  window.open(`/dashboard/renewals/${urlId}`, '_blank');
                                }}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                              >
                                View customer record
                                <ExternalLink className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!notification.read && (
                            <Button
                              variant="ghost" size="icon"
                              onClick={() => markAsRead(notification.id)}
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                              title="Mark as read"
                            >
                              <CheckCheck className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => dismissNotification(notification.id)}
                            className="h-8 w-8 text-gray-600 hover:text-gray-700 hover:bg-gray-100"
                            title="Dismiss"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {displayedNotifications.length >= 10 && (
            <div className="border-t px-6 py-3 bg-gray-50">
              <Button
                variant="link" size="sm"
                onClick={handleViewAll}
                className="w-full text-blue-600 hover:text-blue-700 font-medium"
              >
                View all notifications →
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
