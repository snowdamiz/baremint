import * as React from "react";
import { cn } from "@/lib/utils";
import { ArrowUpRight, ArrowDownLeft, RefreshCw } from "lucide-react";

type ActivityType = "send" | "receive" | "swap";

interface ActivityItemProps {
    type: ActivityType;
    title: string;
    description?: string;
    amount: string;
    timestamp: string;
    status?: "completed" | "pending";
}

const iconMap = {
    send: ArrowUpRight,
    receive: ArrowDownLeft,
    swap: RefreshCw,
};

const iconColorMap = {
    send: "text-destructive bg-loss",
    receive: "text-success bg-gain",
    swap: "text-primary bg-primary/10",
};

export function ActivityItem({
    type,
    title,
    description,
    amount,
    timestamp,
    status = "completed",
}: ActivityItemProps) {
    const Icon = iconMap[type];

    return (
        <div className="flex items-center gap-4 py-3">
            <div
                className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full",
                    iconColorMap[type]
                )}
            >
                <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{title}</p>
                {description && (
                    <p className="text-sm text-muted-foreground truncate">{description}</p>
                )}
            </div>
            <div className="text-right">
                <p
                    className={cn(
                        "font-medium",
                        type === "receive" ? "text-gain" : "text-foreground"
                    )}
                >
                    {type === "receive" ? "+" : type === "send" ? "-" : ""}
                    {amount}
                </p>
                <p className="text-xs text-muted-foreground">
                    {status === "pending" ? (
                        <span className="text-amber-600">Pending</span>
                    ) : (
                        timestamp
                    )}
                </p>
            </div>
        </div>
    );
}
