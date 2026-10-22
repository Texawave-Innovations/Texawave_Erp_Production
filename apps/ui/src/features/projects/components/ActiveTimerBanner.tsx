"use client";

import { useEffect, useState } from "react";
import { Clock, Square, Loader2 } from "lucide-react";
import { useActiveTimer, useStopTimer } from "../hooks";

function formatElapsed(startedAt: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(startedAt).getTime());
  const totalSecs = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function TimerElapsedDisplay({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(() => formatElapsed(startedAt));

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(formatElapsed(startedAt));
    }, 1000);

    return () => clearInterval(timer);
  }, [startedAt]);

  return (
    <div className="rounded-xl bg-black/25 px-4 py-2 font-mono text-xl font-bold tracking-wider text-cyan-100 backdrop-blur-sm">
      {elapsed}
    </div>
  );
}

export function ActiveTimerBanner() {
  const { data: activeTimer, isLoading } = useActiveTimer();
  const stopTimerMutation = useStopTimer();
  const [isStopping, setIsStopping] = useState(false);

  if (isLoading || !activeTimer) {
    return null;
  }

  const handleStop = async () => {
    setIsStopping(true);
    try {
      await stopTimerMutation.mutateAsync({ taskId: activeTimer.taskId });
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 p-4 text-white shadow-lg shadow-blue-500/20 dark:border-blue-900/50">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Clock className="h-5 w-5 animate-pulse text-white" />
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-cyan-400" />
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-200">
                Stopwatch Active
              </span>
              <span className="text-xs text-white/70">•</span>
              <span className="text-xs font-medium text-white/90">
                {activeTimer.task.project.name}
              </span>
            </div>
            <p className="text-sm font-semibold text-white">
              <span className="font-mono text-cyan-200">
                [{activeTimer.task.taskCode}]
              </span>{" "}
              {activeTimer.task.title}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <TimerElapsedDisplay
            key={activeTimer.startedAt}
            startedAt={activeTimer.startedAt}
          />
          <button
            onClick={handleStop}
            disabled={isStopping}
            className="flex items-center gap-2 rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:bg-rose-600 active:scale-95 disabled:opacity-50"
          >
            {isStopping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Square className="h-4 w-4 fill-white" />
            )}
            Stop Timer
          </button>
        </div>
      </div>
    </div>
  );
}
