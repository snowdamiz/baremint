"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Check } from "lucide-react";
import { NotificationItem } from "@/components/notifications/notification-item";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchNotifications = useCallback(async (offset: number) => {
    const res = await fetch(`/api/notifications?offset=${offset}`);
    if (!res.ok) return { notifications: [], hasMore: false };
    return res.json();
  }, []);

  useEffect(() => {
    fetchNotifications(0)
      .then((data) => {
        setNotifications(data.notifications ?? []);
        setHasMore(data.hasMore ?? false);
      })
      .finally(() => setLoading(false));
  }, [fetchNotifications]);

  const loadMore = async () => {
    setLoadingMore(true);
    const data = await fetchNotifications(notifications.length);
    setNotifications((prev) => [...prev, ...(data.notifications ?? [])]);
    setHasMore(data.hasMore ?? false);
    setLoadingMore(false);
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.isRead).map((n) => n.id);
    if (unreadIds.length === 0) return;

    // Batch in groups of 100
    for (let i = 0; i < unreadIds.length; i += 100) {
      const batch = unreadIds.slice(i, i + 100);
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: batch }),
      });
    }

    setNotifications((prev) =>
      prev.map((n) => ({ ...n, isRead: true })),
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bell className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Notifications</h1>
        </div>
        {notifications.some((n) => !n.isRead) && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Check className="h-4 w-4" />
            Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">
          Loading notifications...
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          <Bell className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No notifications yet</p>
          <p className="text-sm mt-1">
            You will be notified when creators you hold tokens for post new
            content or when there is activity on your tokens.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border divide-y overflow-hidden">
          {notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="text-center mt-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="text-sm text-primary hover:underline disabled:opacity-50"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
