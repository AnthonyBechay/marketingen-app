"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Sparkles, CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProviderGlyph } from "@/components/provider-glyph";
import { fillWeekFromQueueAction } from "../campaign/actions";
import type { SocialProvider, TargetStatus } from "@prisma/client";

export type CalendarEvent = {
  id: string;
  postId: string;
  postName: string;
  topic: string;
  coverUrl: string | null;
  provider: SocialProvider;
  providerName: string;
  providerColor: string;
  status: TargetStatus;
  date: string; // ISO
  providerUrl: string | null;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({
  slug,
  year,
  month,
  events,
}: {
  slug: string;
  year: number;
  month: number;
  events: CalendarEvent[];
}) {
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const d = new Date(e.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [events]);

  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0); // last day of month
  const startWeekday = monthStart.getDay(); // 0 = Sun
  const daysInMonth = monthEnd.getDate();

  // Build a 6-row grid covering all visible cells.
  const cells: Array<{ date: Date; inMonth: boolean }> = [];
  // Leading days from previous month.
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month, -i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false });
    if (cells.length >= 42) break;
  }

  const prevYm = ymString(year, month - 1);
  const nextYm = ymString(year, month + 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" title="Previous month">
            <Link href={`/app/${slug}/calendar?ym=${prevYm}`}>
              <ChevronLeft className="w-4 h-4" />
            </Link>
          </Button>
          <h3 className="text-lg font-semibold min-w-[180px] text-center">
            {MONTHS[month]} {year}
          </h3>
          <Button asChild variant="outline" size="icon" title="Next month">
            <Link href={`/app/${slug}/calendar?ym=${nextYm}`}>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/app/${slug}/calendar`}>Today</Link>
          </Button>
        </div>
        <FillWeekButton slug={slug} />
      </div>

      <div className="card-surface overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border/60">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-xs font-mono uppercase tracking-widest text-muted-foreground text-center"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr">
          {cells.map((cell, i) => {
            const key = `${cell.date.getFullYear()}-${cell.date.getMonth()}-${cell.date.getDate()}`;
            const dayEvents = eventsByDay.get(key) ?? [];
            const isToday = isSameDay(cell.date, new Date());
            return (
              <div
                key={i}
                className={`min-h-[110px] border-b border-r border-border/40 p-1.5 flex flex-col gap-1 ${
                  cell.inMonth ? "" : "bg-secondary/20 text-muted-foreground/60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-mono ${
                      isToday
                        ? "bg-accent text-accent-foreground rounded-full px-1.5 py-0.5 font-bold"
                        : ""
                    }`}
                  >
                    {cell.date.getDate()}
                  </span>
                </div>
                <div className="flex flex-col gap-1 overflow-hidden">
                  {dayEvents.slice(0, 4).map((e) => (
                    <Link
                      key={e.id}
                      href={`/app/${slug}/posts/${e.postId}`}
                      className="block group"
                      title={`${e.providerName} — ${e.topic}`}
                    >
                      <div
                        className="rounded px-1.5 py-1 text-[11px] flex items-center gap-1.5 truncate group-hover:opacity-80"
                        style={{
                          background: `${e.providerColor}1f`,
                          borderLeft: `2px solid ${e.providerColor}`,
                          opacity: e.status === "cancelled" ? 0.5 : 1,
                          textDecoration: e.status === "cancelled" ? "line-through" : "none",
                        }}
                      >
                        <ProviderGlyph
                          provider={e.provider}
                          className="w-3 h-3 flex-shrink-0"
                          style={{ color: e.providerColor }}
                        />
                        <span className="truncate">{e.topic}</span>
                      </div>
                    </Link>
                  ))}
                  {dayEvents.length > 4 && (
                    <div className="text-[10px] text-muted-foreground px-1.5">
                      +{dayEvents.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ymString(year: number, month: number): string {
  // Normalize a year+month (where month may be -1 or 12).
  const d = new Date(year, month, 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function FillWeekButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toLocalDateInput(d);
  });
  const [count, setCount] = useState(3);
  const [hour, setHour] = useState("09:00");
  const [pending, startTransition] = useTransition();

  function onSubmit() {
    startTransition(async () => {
      const res = await fillWeekFromQueueAction(slug, {
        startDate: start,
        timeOfDay: hour,
        count,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      toast.success(`Generated ${res.count} posts and scheduled them.`);
      setOpen(false);
      window.location.reload();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm">
          <Sparkles className="w-3.5 h-3.5" /> Fill week from queue
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="w-4 h-4 text-accent" /> Fill week from queue
          </DialogTitle>
          <DialogDescription>
            Pull the next ideas off your queue, generate posts, and schedule them across
            consecutive days. Each post will go to all currently-connected channels.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Start date</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Time of day</Label>
              <Input type="time" value={hour} onChange={(e) => setHour(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>How many ideas?</Label>
            <Input
              type="number"
              min={1}
              max={7}
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(7, Number(e.target.value))))}
            />
            <p className="text-xs text-muted-foreground">Up to 7. One per day.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={pending}>
            <Sparkles className="w-4 h-4" />
            {pending ? "Generating…" : "Generate & schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toLocalDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
