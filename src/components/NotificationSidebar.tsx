"use client";

import { Bell, X, Trash2, CheckCheck, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";

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

function getNotificationIcon(notification: Notification) {
  if (notification.priority === 'urgent') return '🚨';
  if (notification.notification_type.includes('expiry')) return '⏰';
  return '📌';
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
    if (!window.confirm('Are you sure you want to clear all notifications?')) {
      return;
    }
    await clearAllNotifications();
  };

  const handleViewAll = () => {
    setIsOpen(false);
    router.push('/dashboard/notifications');
  };

  const displayedNotifications = notifications
    .filter(n => !n.dismissed)
    .slice(0, 10);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className={`h-5 w-5 ${unreadCount > 0 ? 'animate-bounce' : ''}`} />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-6 w-6 flex items-center justify-center p-0 text-xs font-bold animate-pulse shadow-lg"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent side="right" className="w-full sm:w-[600px] p-0">
        <div className="flex h-full flex-col">
          {/* Header */}
          <SheetHeader className="border-b px-6 py-4 bg-gradient-to-r from-red-50 to-orange-50">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-xl flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  Contract Notifications
                </SheetTitle>
                <SheetDescription>
                  {unreadCount > 0 
                    ? `${unreadCount} urgent notification${unreadCount !== 1 ? 's' : ''}` 
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
                  <span className="hidden sm:inline">Mark all read</span>
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
                  <span className="hidden sm:inline">Clear all</span>
                </Button>
              )}
            </div>
          </SheetHeader>

          {/* Notifications List */}
          <ScrollArea className="flex-1">
            {displayedNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <Bell className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No notifications</h3>
                <p className="text-sm text-gray-500">
                  You're all caught up! Check back later for updates.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {displayedNotifications.map((notification) => {
                  const isUrgent = notification.priority === 'urgent';
                  const icon = getNotificationIcon(notification);
                  
                  return (
                    <div
                      key={notification.id}
                      className={`group relative px-6 py-4 transition-colors hover:bg-gray-50 ${
                        !notification.read ? 'bg-red-50/50 border-l-4 border-l-red-500' : ''
                      } ${
                        isUrgent ? 'border-l-4 border-l-red-600 bg-red-50/30' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between space-x-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start space-x-2 mb-2">
                            <span className="text-2xl flex-shrink-0 animate-pulse">{icon}</span>
                            <div className="flex-1">
                              <div className={`${!notification.read ? 'font-bold' : 'font-semibold'} whitespace-pre-line`}>
                                {notification.message}
                              </div>
                            </div>
                          </div>
                          
                          <div className="mt-2 flex items-center space-x-3 text-xs text-gray-500 ml-9">
                            <span>
                              {new Date(notification.created_at).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {isUrgent && (
                              <Badge variant="destructive" className="text-xs font-bold animate-pulse">
                                URGENT
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!notification.read && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => markAsRead(notification.id)}
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                              title="Mark as read"
                            >
                              <CheckCheck className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => dismissNotification(notification.id)}
                            className="h-8 w-8 text-gray-600 hover:text-gray-700 hover:bg-gray-100"
                            title="Dismiss"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {notification.client_id && (
                        <div className="mt-3 ml-9">
                          <Link
                            href={`/dashboard/renewals`}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline bg-blue-50 px-3 py-1.5 rounded-md"
                            onClick={() => setIsOpen(false)}
                          >
                            View Customer Details →
                          </Link>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {displayedNotifications.length >= 10 && (
            <div className="border-t px-6 py-3 bg-gray-50">
              <Button
                variant="link"
                size="sm"
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