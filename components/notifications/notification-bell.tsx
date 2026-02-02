"use client";

import { useState, useRef, useEffect } from "react";
import { Bell } from "lucide-react";
import { useNotificationCount } from "@/hooks/use-notification-count";
import { NotificationDropdown } from "./notification-dropdown";

export function NotificationBell() {
  const { count, refresh } = useNotificationCount();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  const displayCount = count > 99 ? "99+" : String(count);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ""}`}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {displayCount}
          </span>
        )}
      </button>

      {open && (
        <NotificationDropdown
          onClose={() => setOpen(false)}
          onCountChange={refresh}
        />
      )}
    </div>
  );
}
