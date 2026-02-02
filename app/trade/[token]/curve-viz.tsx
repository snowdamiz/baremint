"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface CurveVizProps {
  virtualSolReserves: string;
  virtualTokenReserves: string;
  realSolReserves: string;
  realTokenReserves: string;
  tokenTotalSupply: string;
}

/** Format lamports as SOL with appropriate precision */
function formatSol(lamports: bigint): string {
  const sol = Number(lamports) / 1e9;
  if (sol < 0.01) return sol.toFixed(6);
  if (sol < 1) return sol.toFixed(4);
  if (sol < 1000) return sol.toFixed(2);
  return sol.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** Format raw token amount (9 decimals) as human-readable */
function formatTokens(raw: bigint): string {
  const whole = Number(raw / BigInt(1e9));
  if (whole >= 1_000_000_000) return `${(whole / 1e9).toFixed(1)}B`;
  if (whole >= 1_000_000) return `${(whole / 1e6).toFixed(1)}M`;
  if (whole >= 1_000) return `${(whole / 1e3).toFixed(1)}K`;
  return whole.toLocaleString();
}

export function CurveViz({
  virtualSolReserves,
  virtualTokenReserves,
  realSolReserves,
  realTokenReserves,
  tokenTotalSupply,
}: CurveVizProps) {
  const [isOpen, setIsOpen] = useState(false);

  const {
    points,
    currentX,
    currentY,
    progressPct,
    solInReserves,
    tokensInCirculation,
  } = useMemo(() => {
    const vSol = BigInt(virtualSolReserves);
    const vToken = BigInt(virtualTokenReserves);
    const rSol = BigInt(realSolReserves);
    const rToken = BigInt(realTokenReserves);
    const totalSupply = BigInt(tokenTotalSupply);

    // Constant product: k = vSol * vToken
    const k = Number(vSol) * Number(vToken);

    // Circulating tokens = totalSupply - realTokenReserves
    const circulating = totalSupply - rToken;
    const circulatingNum = Number(circulating);
    const totalSupplyNum = Number(totalSupply);

    // Progress percentage
    const progress =
      totalSupplyNum > 0 ? (circulatingNum / totalSupplyNum) * 100 : 0;

    // Generate curve points
    // X-axis: token supply in circulation (0 to totalSupply)
    // Y-axis: price at that point = vSol / vToken where we shift reserves
    // At supply S in circulation: virtualTokenReserves' = vToken - S (approx)
    // price = k / (vToken - S)^2 ... actually price = vSol' / vToken'
    // Using constant product: vSol' * vToken' = k, vToken' = vToken - S
    // So vSol' = k / vToken', price = vSol' / vToken' = k / vToken'^2
    const NUM_POINTS = 50;
    const maxSupply = totalSupplyNum;
    // Don't go all the way to totalSupply as that would make vToken' = 0
    const safeMax = maxSupply * 0.95;
    const step = safeMax / NUM_POINTS;

    const pts: { x: number; y: number }[] = [];
    let maxPrice = 0;

    for (let i = 0; i <= NUM_POINTS; i++) {
      const supply = i * step;
      const vTokenPrime = Number(vToken) - supply;
      if (vTokenPrime <= 0) break;
      const price = k / (vTokenPrime * vTokenPrime);
      pts.push({ x: supply, y: price });
      if (price > maxPrice) maxPrice = price;
    }

    // Current position
    const currentVTokenPrime = Number(vToken) - circulatingNum;
    const currentPrice =
      currentVTokenPrime > 0 ? k / (currentVTokenPrime * currentVTokenPrime) : 0;

    return {
      points: pts,
      currentX: circulatingNum,
      currentY: currentPrice,
      progressPct: progress,
      solInReserves: rSol,
      tokensInCirculation: circulating,
    };
  }, [
    virtualSolReserves,
    virtualTokenReserves,
    realSolReserves,
    realTokenReserves,
    tokenTotalSupply,
  ]);

  // SVG dimensions
  const svgWidth = 500;
  const svgHeight = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const plotW = svgWidth - padding.left - padding.right;
  const plotH = svgHeight - padding.top - padding.bottom;

  // Scale functions
  const maxX = points.length > 0 ? points[points.length - 1].x : 1;
  const maxY = points.length > 0 ? Math.max(...points.map((p) => p.y)) : 1;

  const scaleX = (val: number) => padding.left + (val / maxX) * plotW;
  const scaleY = (val: number) =>
    padding.top + plotH - (val / (maxY * 1.1)) * plotH;

  // Build SVG path for the curve
  const curvePath =
    points.length > 0
      ? `M ${scaleX(points[0].x)},${scaleY(points[0].y)} ` +
        points
          .slice(1)
          .map((p) => `L ${scaleX(p.x)},${scaleY(p.y)}`)
          .join(" ")
      : "";

  // Build filled area path (under curve up to current position)
  const filledPoints = points.filter((p) => p.x <= currentX);
  const filledPath =
    filledPoints.length > 0
      ? `M ${scaleX(filledPoints[0].x)},${scaleY(0)} ` +
        filledPoints.map((p) => `L ${scaleX(p.x)},${scaleY(p.y)}`).join(" ") +
        ` L ${scaleX(currentX)},${scaleY(currentY)}` +
        ` L ${scaleX(currentX)},${scaleY(0)} Z`
      : "";

  const currentDotCx = scaleX(currentX);
  const currentDotCy = scaleY(currentY);

  return (
    <div className="rounded-xl border bg-card shadow-card">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
      >
        <div className="flex items-center gap-2">
          <span>Bonding Curve</span>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-500">
            {progressPct.toFixed(1)}%
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div className="border-t px-4 pb-4 pt-3">
          {/* SVG curve visualization */}
          <svg
            viewBox={`0 0 ${svgWidth} ${svgHeight}`}
            className="w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Filled area under curve */}
            {filledPath && (
              <path
                d={filledPath}
                fill="currentColor"
                className="text-emerald-500/20"
              />
            )}

            {/* Curve line */}
            {curvePath && (
              <path
                d={curvePath}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-muted-foreground/50"
              />
            )}

            {/* Filled portion of curve (up to current) */}
            {filledPoints.length > 0 && (
              <path
                d={
                  `M ${scaleX(filledPoints[0].x)},${scaleY(filledPoints[0].y)} ` +
                  filledPoints
                    .slice(1)
                    .map((p) => `L ${scaleX(p.x)},${scaleY(p.y)}`)
                    .join(" ") +
                  ` L ${scaleX(currentX)},${scaleY(currentY)}`
                }
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="text-emerald-500"
              />
            )}

            {/* Current position dot */}
            <circle
              cx={currentDotCx}
              cy={currentDotCy}
              r="5"
              fill="currentColor"
              className="text-emerald-500"
            />
            <circle
              cx={currentDotCx}
              cy={currentDotCy}
              r="8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-emerald-500/40"
            />

            {/* X-axis label */}
            <text
              x={svgWidth / 2}
              y={svgHeight - 5}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              Token Supply
            </text>

            {/* Y-axis label */}
            <text
              x={12}
              y={svgHeight / 2}
              textAnchor="middle"
              transform={`rotate(-90, 12, ${svgHeight / 2})`}
              className="fill-muted-foreground text-[11px]"
            >
              Price
            </text>
          </svg>

          {/* Stats */}
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">SOL in Reserves</p>
              <p className="text-sm font-semibold">
                {formatSol(solInReserves)} SOL
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">In Circulation</p>
              <p className="text-sm font-semibold">
                {formatTokens(tokensInCirculation)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Curve Progress</p>
              <p className="text-sm font-semibold">
                {progressPct.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
