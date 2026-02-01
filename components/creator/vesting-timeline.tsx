"use client";

import { useMemo } from "react";
import { Shield } from "lucide-react";

interface VestingTimelineProps {
  launchedAt: Date;
  totalAllocation: number;
  tickerSymbol: string;
}

const CLIFF_DAYS = 30;
const VESTING_DAYS = 90; // 30 cliff + 60 linear

function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function VestingTimeline({
  launchedAt,
  totalAllocation,
  tickerSymbol,
}: VestingTimelineProps) {
  const { cliffEnd, vestingEnd, progress, statusText, vestedPercent } =
    useMemo(() => {
      const launch = new Date(launchedAt);
      const cliff = new Date(launch);
      cliff.setDate(cliff.getDate() + CLIFF_DAYS);
      const end = new Date(launch);
      end.setDate(end.getDate() + VESTING_DAYS);

      const now = new Date();
      const totalMs = end.getTime() - launch.getTime();
      const elapsedMs = now.getTime() - launch.getTime();
      const prog = Math.max(0, Math.min(1, elapsedMs / totalMs));

      let status: string;
      let vested = 0;

      if (now < cliff) {
        const remaining = daysBetween(now, cliff);
        status = `Cliff period \u2014 ${remaining} day${remaining !== 1 ? "s" : ""} remaining until first claim`;
        vested = 0;
      } else if (now < end) {
        const remaining = daysBetween(now, end);
        const linearMs = now.getTime() - cliff.getTime();
        const linearTotalMs = end.getTime() - cliff.getTime();
        vested = Math.round((linearMs / linearTotalMs) * 100);
        status = `Vesting active \u2014 ${vested}% vested, ${remaining} day${remaining !== 1 ? "s" : ""} remaining`;
      } else {
        status = "Fully vested";
        vested = 100;
      }

      return {
        cliffEnd: cliff,
        vestingEnd: end,
        progress: prog,
        statusText: status,
        vestedPercent: vested,
      };
    }, [launchedAt]);

  const launchDate = new Date(launchedAt);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Vesting Schedule</h3>
      </div>

      {/* Timeline bar */}
      <div className="relative">
        <div className="h-2 w-full rounded-full bg-muted">
          <div
            className="h-2 rounded-full bg-primary transition-all"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Markers */}
        <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground">
          <span>
            Launch
            <br />
            {launchDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
          <span className="text-center">
            Cliff End
            <br />
            {cliffEnd.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
          <span className="text-right">
            Fully Vested
            <br />
            {vestingEnd.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </div>

      {/* Status */}
      <p className="text-sm font-medium">{statusText}</p>

      {/* Allocation info */}
      <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        <p>
          {formatNumber(totalAllocation)} ${tickerSymbol} (10% of supply)
        </p>
        <p className="mt-1 text-xs">
          Vesting is enforced on-chain and cannot be bypassed
        </p>
      </div>
    </div>
  );
}
