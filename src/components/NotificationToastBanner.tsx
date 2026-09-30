"use client";

import { useEffect } from "react";
import { X, UserCheck, Clock, FileText, ExternalLink } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";

function stripEmojis(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|\u{200D}|\u{FE0F}/gu, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/^ /gm, '')
    .trim();
}

function extractDisplayId(message: string): string | null {
  const match = message.match(/(?:🆔 )?ID:\s*(\d+)/);
  return match ? match[1] : null;
}

export function NotificationToastBanner() {
  const { newToasts, dismissToast } = useNotifications();

  useEffect(() => {
    if (newToasts.length === 0) return;
    const timers = newToasts.map((n) =>
      setTimeout(() => dismissToast(n.id), 6000)
    );
    return () => timers.forEach(clearTimeout);
  }, [newToasts, dismissToast]);

  if (newToasts.length === 0) return null;

  return (
    <div className="fixed top-14 right-4 z-[9999] flex flex-col gap-2 w-80 pointer-events-none">
      {newToasts.slice(0, 3).map((n) => {
        const isAssignment = n.notification_type === "assignment";
        const isExpiry = n.notification_type?.includes("expiry");
        const isUrgent = n.priority === "urgent";
        const displayId = extractDisplayId(n.message);

        const IconComponent = isAssignment ? UserCheck : isExpiry ? Clock : FileText;
        const accentColor = isAssignment ? "bg-blue-500" : isUrgent ? "bg-red-500" : "bg-gray-500";
        const label = isAssignment ? "Assignment" : isUrgent ? "Urgent" : "Notification";

        const lines = stripEmojis(n.message).split("\n").filter(Boolean);
        const title = lines[0] ?? "New notification";
        const details = lines.slice(1, 4); // up to 3 detail lines

        return (
          <div
            key={n.id}
            className="pointer-events-auto bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden animate-in slide-in-from-right-4 duration-200"
          >
            {/* Coloured top stripe */}
            <div className={`h-1 w-full ${accentColor}`} />

            <div className="p-3 flex gap-3">
              {/* Icon */}
              <div className={`flex-shrink-0 rounded-md p-2 ${accentColor} bg-opacity-10`}
                style={{ backgroundColor: isAssignment ? '#eff6ff' : isUrgent ? '#fef2f2' : '#f3f4f6' }}>
                <IconComponent className={`h-4 w-4 ${isAssignment ? 'text-blue-600' : isUrgent ? 'text-red-600' : 'text-gray-500'}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-gray-900 leading-snug">{title}</p>
                    {details.length > 0 && (
                      <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                        {details.join(" · ")}
                      </p>
                    )}
                    {n.client_id && (
                      <button
                        onClick={() => {
                          const urlId = displayId || n.client_id;
                          window.open(`/dashboard/renewals/${urlId}`, "_blank");
                          dismissToast(n.id);
                        }}
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                      >
                        View customer
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => dismissToast(n.id)}
                    className="flex-shrink-0 p-0.5 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 cursor-pointer transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
