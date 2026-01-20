"use client";

import { Bell, X, Trash2, CheckCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState, useRef } from "react";
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
  job_id?: string;
  customer_id?: string;
  message: string;
  created_at: string;
  moved_by?: string;
  read: boolean;
  dismissed: boolean;  // ✅ ADDED
};

/**
 * Format notification message with better visual structure
 * Handles multi-line messages and change details
 */
function formatNotificationMessage(message: string) {
  // Check if message contains change details (indicated by " | " or bullet points)
  const hasChangeDetails = message.includes(' | ') || message.includes('• ');
  
  if (!hasChangeDetails) {
    return <p className="text-sm text-gray-900">{message}</p>;
  }
  
  // Split main message from changes
  const parts = message.split('. Changes: ');
  
  if (parts.length === 2) {
    const [mainMessage, changesText] = parts;
    const changes = changesText.split(' | ');
    
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-900">{mainMessage}</p>
        <div className="pl-3 border-l-2 border-blue-300 space-y-1">
          <p className="text-xs font-medium text-gray-700">Changes made:</p>
          {changes.map((change, idx) => (
            <p key={idx} className="text-xs text-gray-600">
              {change.startsWith('(+') ? (
                <span className="italic text-gray-500">{change}</span>
              ) : (
                change
              )}
            </p>
          ))}
        </div>
      </div>
    );
  }
  
  // Handle bullet-point format
  if (message.includes('• ')) {
    const lines = message.split('\n').filter(line => line.trim());
    const mainLine = lines[0];
    const detailLines = lines.slice(1);
    
    return (
      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-900">{mainLine}</p>
        {detailLines.length > 0 && (
          <div className="pl-3 border-l-2 border-blue-300 space-y-0.5">
            {detailLines.map((line, idx) => (
              <p key={idx} className="text-xs text-gray-600">
                {line}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }
  
  // Default formatting
  return <p className="text-sm text-gray-900">{message}</p>;
}

/**
 * Get icon emoji based on notification type
 */
function getNotificationIcon(message: string) {
  if (message.includes('✏️') || message.includes('edited')) return '✏️';
  if (message.includes('📋')) return '📋';
  if (message.includes('💰')) return '💰';
  if (message.includes('🧾')) return '🧾';
  if (message.includes('➕')) return '➕';
  if (message.includes('➖')) return '➖';
  if (message.includes('✅') || message.includes('Accepted')) return '✅';
  if (message.includes('🏭') || message.includes('Production')) return '🏭';
  if (message.includes('🔧') || message.includes('Installation')) return '🔧';
  if (message.includes('🎉') || message.includes('Complete')) return '🎉';
  if (message.includes('🚚') || message.includes('Delivery')) return '🚚';
  return '📌';
}

/**
 * Determine notification priority based on content
 */
function getNotificationPriority(notification: Notification): 'high' | 'medium' | 'low' {
  const msg = notification.message.toLowerCase();
  
  // High priority: Approvals, rejections, major changes
  if (msg.includes('approval') || msg.includes('rejected') || msg.includes('approved')) {
    return 'high';
  }
  
  // Medium priority: Updates and edits
  if (msg.includes('updated') || msg.includes('edited') || msg.includes('modified')) {
    return 'medium';
  }
  
  // Low priority: General notifications
  return 'low';
}

export function NotificationSidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousUnreadCountRef = useRef<number>(0);
  
  // Use shared notification context
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    dismissNotification,  // ✅ ADDED
    deleteNotification,
    clearAllNotifications,
  } = useNotifications();

  // Initialize audio element for notification sound
  useEffect(() => {
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3');
    audioRef.current.volume = 0.5; // Set volume to 50%
  }, []);

  // Play sound when new unread notifications appear
  useEffect(() => {
    if (unreadCount > previousUnreadCountRef.current && previousUnreadCountRef.current > 0) {
      if (audioRef.current) {
        audioRef.current.play().catch(error => {
          console.log('Audio play failed:', error);
        });
      }
    }
    previousUnreadCountRef.current = unreadCount;
  }, [unreadCount]);

  /**
   * Handle clear all with confirmation
   */
  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear all notifications? This action cannot be undone.')) {
      return;
    }
    await clearAllNotifications();
  };

  /**
   * Navigate to full notifications page
   */
  const handleViewAll = () => {
    setIsOpen(false);
    router.push('/dashboard/notifications');
  };

  // ✅ Filter out dismissed notifications from sidebar
  const displayedNotifications = notifications
    .filter(n => !n.dismissed)
    .slice(0, 10); // Show only first 10 in sidebar

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs animate-pulse"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      
      <SheetContent side="right" className="w-full sm:w-[600px] p-0">
        <div className="flex h-full flex-col">
          {/* Header */}
          <SheetHeader className="border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <SheetTitle className="text-xl">Activity Feed</SheetTitle>
                <SheetDescription>
                  {unreadCount > 0 
                    ? `${unreadCount} new notification${unreadCount !== 1 ? 's' : ''}` 
                    : 'All caught up!'}
                </SheetDescription>
              </div>
              
              {/* View All Button */}
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

            {/* Action buttons */}
            <div className="flex items-center space-x-2 mt-3">
              {unreadCount > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={markAllAsRead}
                        className="flex items-center space-x-1 flex-1"
                      >
                        <CheckCheck className="h-4 w-4" />
                        <span className="hidden sm:inline">Mark all read</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Mark all notifications as read
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {displayedNotifications.length > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        onClick={handleClearAll}
                        className="flex items-center space-x-1 flex-1"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="hidden sm:inline">Clear all</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Permanently delete all notifications
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </SheetHeader>

          {/* Notifications List */}
          <ScrollArea className="flex-1">
            {displayedNotifications.length === 0 ? (
              // Empty state
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <Bell className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No notifications</h3>
                <p className="text-sm text-gray-500">
                  You're all caught up! Check back later for updates.
                </p>
              </div>
            ) : (
              // Notification items
              <div className="divide-y">
                {displayedNotifications.map((notification) => {
                  const priority = getNotificationPriority(notification);
                  const icon = getNotificationIcon(notification.message);
                  
                  return (
                    <div
                      key={notification.id}
                      className={`group relative px-6 py-4 transition-colors hover:bg-gray-50 ${
                        !notification.read ? 'bg-blue-50/50 border-l-4 border-l-blue-500' : ''
                      } ${
                        priority === 'high' ? 'border-l-4 border-l-red-400' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between space-x-3">
                        <div className="flex-1 min-w-0">
                          {/* Icon and unread indicator */}
                          <div className="flex items-start space-x-2 mb-2">
                            <span className="text-xl flex-shrink-0">{icon}</span>
                            <div className="flex-1">
                              {/* Notification message with enhanced formatting */}
                              <div className={!notification.read ? 'font-semibold' : ''}>
                                {formatNotificationMessage(notification.message)}
                              </div>
                            </div>
                          </div>
                          
                          {/* Metadata (timestamp and moved_by) */}
                          <div className="mt-2 flex items-center space-x-3 text-xs text-gray-500 ml-7">
                            <span>
                              {new Date(notification.created_at).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            {notification.moved_by && (
                              <span className="flex items-center">
                                <span className="mr-1">•</span>
                                By: {notification.moved_by}
                              </span>
                            )}
                            {priority === 'high' && (
                              <Badge variant="destructive" className="text-xs">
                                Important
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Action buttons (mark as read, dismiss) */}
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
                            title="Dismiss from sidebar"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Optional: Links to related entities (customer/job) */}
                      {(notification.job_id || notification.customer_id) && (
                        <div className="mt-2 ml-7 flex items-center space-x-2 text-xs">
                          {notification.customer_id && (
                            <Link
                              href={`/dashboard/clients/${notification.customer_id}`}
                              className="text-blue-600 hover:underline font-medium"
                              onClick={() => setIsOpen(false)}
                            >
                              View Customer →
                            </Link>
                          )}
                          {notification.job_id && (
                            <Link
                              href={`/dashboard/jobs/${notification.job_id}`}
                              className="text-blue-600 hover:underline font-medium"
                              onClick={() => setIsOpen(false)}
                            >
                              View Job →
                            </Link>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Footer - Show "View All" if more than 10 notifications */}
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