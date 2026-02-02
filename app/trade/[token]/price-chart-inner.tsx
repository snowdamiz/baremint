"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type SeriesType,
  type UTCTimestamp,
  ColorType,
} from "lightweight-charts";
import { getChartData, type ChartData } from "./actions";
import { cn } from "@/lib/utils";

const INTERVALS = ["5M", "15M", "1H", "4H", "1D", "1W"] as const;

interface PriceChartInnerProps {
  mintAddress: string;
  initialData?: ChartData;
}

export default function PriceChartInner({
  mintAddress,
  initialData,
}: PriceChartInnerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<SeriesType> | null>(null);

  const [selectedInterval, setSelectedInterval] = useState<string>("1H");
  const [chartData, setChartData] = useState<ChartData>(
    initialData ?? { type: "empty" },
  );
  const [isPending, startTransition] = useTransition();

  // Fetch chart data for selected interval
  const fetchData = useCallback(
    (interval: string) => {
      startTransition(async () => {
        const data = await getChartData(mintAddress, interval);
        setChartData(data);
      });
    },
    [mintAddress],
  );

  // Fetch on mount and interval change
  useEffect(() => {
    fetchData(selectedInterval);
  }, [selectedInterval, fetchData]);

  // Create and update chart
  useEffect(() => {
    if (!containerRef.current) return;

    // Detect dark mode
    const isDark = document.documentElement.classList.contains("dark");

    // Create chart if not exists
    if (!chartRef.current) {
      chartRef.current = createChart(containerRef.current, {
        height: 400,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: isDark ? "#a1a1aa" : "#71717a",
        },
        grid: {
          vertLines: { color: isDark ? "#27272a" : "#e4e4e7" },
          horzLines: { color: isDark ? "#27272a" : "#e4e4e7" },
        },
        crosshair: {
          mode: 0, // Normal crosshair
        },
        rightPriceScale: {
          borderColor: isDark ? "#27272a" : "#e4e4e7",
        },
        timeScale: {
          borderColor: isDark ? "#27272a" : "#e4e4e7",
          timeVisible: true,
          secondsVisible: false,
        },
      });
    }

    const chart = chartRef.current;

    // Remove old series
    if (seriesRef.current) {
      chart.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    // Add new series based on data type
    if (chartData.type === "candlestick") {
      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#22c55e",
        downColor: "#ef4444",
        borderUpColor: "#22c55e",
        borderDownColor: "#ef4444",
        wickUpColor: "#22c55e",
        wickDownColor: "#ef4444",
      });
      series.setData(
        chartData.data.map((d) => ({ ...d, time: d.time as UTCTimestamp })),
      );
      seriesRef.current = series;
      chart.timeScale().fitContent();
    } else if (chartData.type === "line") {
      const series = chart.addSeries(LineSeries, {
        color: "#6366f1",
        lineWidth: 2,
      });
      series.setData(
        chartData.data.map((d) => ({ ...d, time: d.time as UTCTimestamp })),
      );
      seriesRef.current = series;
      chart.timeScale().fitContent();
    }

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        chart.applyOptions({ width });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [chartData]);

  // Cleanup chart on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, []);

  const handleIntervalChange = (interval: string) => {
    setSelectedInterval(interval);
  };

  return (
    <div className="rounded-xl border bg-card shadow-card">
      {/* Time interval selector */}
      <div className="flex items-center gap-1 border-b px-4 py-2">
        {INTERVALS.map((interval) => (
          <button
            key={interval}
            onClick={() => handleIntervalChange(interval)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              selectedInterval === interval
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {interval}
          </button>
        ))}
        {isPending && (
          <div className="ml-2 h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        )}
      </div>

      {/* Chart area */}
      <div className="relative">
        {chartData.type === "empty" && !isPending && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">No trades yet</p>
          </div>
        )}
        <div
          ref={containerRef}
          className={cn(
            "h-[400px] w-full",
            chartData.type === "empty" && !isPending && "opacity-20",
          )}
        />
      </div>
    </div>
  );
}
