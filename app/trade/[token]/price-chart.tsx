"use client";

import dynamic from "next/dynamic";
import type { ChartData } from "./actions";

const PriceChartInner = dynamic(() => import("./price-chart-inner"), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] w-full animate-pulse rounded-lg bg-muted" />
  ),
});

interface PriceChartProps {
  mintAddress: string;
  initialData?: ChartData;
}

export function PriceChart({ mintAddress, initialData }: PriceChartProps) {
  return <PriceChartInner mintAddress={mintAddress} initialData={initialData} />;
}
