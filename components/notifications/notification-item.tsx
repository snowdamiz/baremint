import Link from "next/link";
import { Bell, ArrowUpCircle, ArrowDownCircle, Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationItemProps {
  notification: {
    id: string;
    type: string;
    title: string;
    body: string | null;
    linkUrl: string | null;
    isRead: boolean;
    createdAt: string;
  };
}

function getIcon(type: string) {
  switch (type) {
    case "trade_buy":
      return <ArrowUpCircle className="h-5 w-5 text-green-500" />;
    case "trade_sell":
      return <ArrowDownCircle className="h-5 w-5 text-red-500" />;
    case "token_burn":
      return <Flame className="h-5 w-5 text-orange-500" />;
    case "new_content":
    default:
      return <Bell className="h-5 w-5 text-primary" />;
  }
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const content = (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 transition-colors",
        notification.isRead
          ? "bg-background"
          : "bg-primary/5",
        notification.linkUrl && "hover:bg-accent cursor-pointer",
      )}
    >
      <div className="mt-0.5 shrink-0">{getIcon(notification.type)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{notification.title}</p>
        {notification.body && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {notification.body}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          {relativeTime(notification.createdAt)}
        </p>
      </div>
      {!notification.isRead && (
        <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </div>
  );

  if (notification.linkUrl) {
    return <Link href={notification.linkUrl}>{content}</Link>;
  }

  return content;
}
