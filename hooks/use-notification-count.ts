"use client";

import { useState, useEffect, useCallback } from "react";

export function useNotificationCount() {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/count");
      if (res.ok) {
        const data = await res.json();
        setCount(data.count ?? 0);
      }
    } catch {
      // Silently ignore fetch errors (offline, etc.)
    }
  }, []);

  useEffect(() => {
    fetchCount();

    // Poll with jitter: 25-35 seconds
    const interval = setInterval(
      fetchCount,
      30000 + Math.random() * 10000 - 5000,
    );

    return () => clearInterval(interval);
  }, [fetchCount]);

  return { count, refresh: fetchCount };
}
