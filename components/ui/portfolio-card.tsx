import * as React from "react";
import { cn } from "@/lib/utils";

interface PortfolioCardProps {
    balance: number;
    currency?: string;
    changePercent?: number;
    changeAmount?: number;
}

export function PortfolioCard({
    balance,
    currency = "USD",
    changePercent,
    changeAmount,
}: PortfolioCardProps) {
    const isPositive = (changePercent ?? 0) >= 0;

    return (
        <div className="rounded-xl border bg-card p-6 shadow-card">
            <p className="text-sm font-medium text-muted-foreground">Portfolio Value</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight">
                {currency === "USD" ? "$" : ""}
                {balance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                })}
                {currency !== "USD" && ` ${currency}`}
            </p>
            {changePercent !== undefined && (
                <div className="mt-2 flex items-center gap-2">
                    <span
                        className={cn(
                            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                            isPositive ? "bg-gain text-gain" : "bg-loss text-loss"
                        )}
                    >
                        {isPositive ? "+" : ""}
                        {changePercent.toFixed(2)}%
                    </span>
                    {changeAmount !== undefined && (
                        <span className={cn("text-sm", isPositive ? "text-gain" : "text-loss")}>
                            {isPositive ? "+" : ""}${Math.abs(changeAmount).toFixed(2)}
                        </span>
                    )}
                    <span className="text-xs text-muted-foreground">24h</span>
                </div>
            )}
        </div>
    );
}
