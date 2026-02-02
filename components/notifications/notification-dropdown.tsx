"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { NotificationItem } from "./notification-item";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationDropdownProps {
  onClose: () => void;
  onCountChange: () => void;
}

export function NotificationDropdown({
  onClose,
  onCountChange,
}: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications?offset=0")
      .then((res) => res.json())
      .then((data) => {
        setNotifications((data.notifications ?? []).slice(0, 10));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const markAllRead = async () => {
    const unreadIds = notifications
      .filter((n) => !n.isRead)
      .map((n) => n.id);

    if (unreadIds.length === 0) return;

    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: unreadIds }),
    });

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true })),
    );
    onCountChange();
  };

  return (
    <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-hidden rounded-lg border bg-card shadow-lg z-50">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-sm font-semibold">Notifications</span>
        <button
          onClick={markAllRead}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Check className="h-3 w-3" />
          Mark all read
        </button>
      </div>

      <div className="overflow-y-auto max-h-72 divide-y">
        {loading ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        ) : (
          notifications.map((n) => (
            <div key={n.id} onClick={onClose}>
              <NotificationItem notification={n} />
            </div>
          ))
        )}
      </div>

      <div className="border-t px-4 py-2 text-center">
        <Link
          href="/dashboard/notifications"
          onClick={onClose}
          className="text-xs text-primary hover:underline"
        >
          View all notifications
        </Link>
      </div>
    </div>
  );
}
