"use client";

import { useEffect, useState } from "react";
import { format, addDays, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth, isSameDay, parseISO, differenceInCalendarDays } from "date-fns";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface CalEvent {
  documentId: string;
  documentType: string;
  entityRef: string;
  customerName: string;
  date: string;
  kind: "expiry" | "renewal";
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Date | null>(null);
  const [filters, setFilters] = useState({ customerType: "", customer: "", cityId: "" });
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const from = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const to = format(endOfMonth(addMonths(currentMonth, 0)), "yyyy-MM-dd");
    const params = new URLSearchParams({ from, to, ...filters });
    setLoading(true);
    fetch(`/api/calendar?${params}`)
      .then((r) => r.json())
      .then(setEvents)
      .finally(() => setLoading(false));
  }, [currentMonth, filters]);

  function eventsForDay(day: Date) {
    const str = format(day, "yyyy-MM-dd");
    return events.filter((e) => e.date === str);
  }

  function urgencyColor(dateStr: string, kind: string) {
    const days = differenceInCalendarDays(parseISO(dateStr), new Date());
    if (days < 0) return "bg-red-500";
    if (days <= 7) return kind === "expiry" ? "bg-red-500" : "bg-red-300";
    if (days <= 14) return "bg-orange-400";
    if (days <= 30) return "bg-yellow-400";
    return "bg-green-400";
  }

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth);
  const startDay = monthStart.getDay(); // 0=Sun
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const days: (Date | null)[] = [
    ...Array(startDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i + 1)),
  ];
  // Pad to full weeks
  while (days.length % 7 !== 0) days.push(null);

  const selectedEvents = selected ? eventsForDay(selected) : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Expiry Calendar</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn("flex items-center gap-1.5 px-3 py-2 border rounded-lg text-sm", showFilters ? "bg-blue-50 border-blue-300 text-blue-700" : "border-slate-300 text-slate-600 hover:bg-slate-50")}
          >
            <Filter className="w-3.5 h-3.5" /> Filters
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-3 gap-3">
          <select
            value={filters.customerType}
            onChange={(e) => setFilters((f) => ({ ...f, customerType: e.target.value }))}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">All Customer Types</option>
            <option value="INDIVIDUAL">Individual</option>
            <option value="AGENCY">Agency</option>
          </select>
          <input
            type="text"
            placeholder="Search customer name / phone..."
            value={filters.customer}
            onChange={(e) => setFilters((f) => ({ ...f, customer: e.target.value }))}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <button
            onClick={() => setFilters({ customerType: "", customer: "", cityId: "" })}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-500 hover:bg-white"
          >
            Clear Filters
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Month navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <button onClick={() => setCurrentMonth((m) => subMonths(m, 1))} className="p-1 hover:bg-slate-100 rounded-lg">
            <ChevronLeft className="w-5 h-5 text-slate-500" />
          </button>
          <h2 className="font-semibold text-slate-900">{format(currentMonth, "MMMM yyyy")}</h2>
          <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className="p-1 hover:bg-slate-100 rounded-lg">
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-slate-400">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const dayEvents = day ? eventsForDay(day) : [];
            const isToday = day ? isSameDay(day, new Date()) : false;
            const isSelected = day && selected ? isSameDay(day, selected) : false;
            return (
              <div
                key={i}
                onClick={() => day && setSelected(day)}
                className={cn(
                  "min-h-[80px] p-2 border-b border-r border-slate-100 text-sm",
                  day ? "cursor-pointer hover:bg-slate-50" : "bg-slate-50/50",
                  isSelected ? "bg-blue-50" : ""
                )}
              >
                {day && (
                  <>
                    <span className={cn(
                      "inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-medium mb-1",
                      isToday ? "bg-blue-600 text-white" : "text-slate-700"
                    )}>
                      {format(day, "d")}
                    </span>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((e, j) => (
                        <div key={j} className={`${urgencyColor(e.date, e.kind)} text-white text-xs px-1.5 py-0.5 rounded truncate`}>
                          {e.documentType}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-slate-400">+{dayEvents.length - 3} more</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selected day events */}
      {selected && selectedEvents.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-900 mb-3">
            {format(selected, "dd MMMM yyyy")} — {selectedEvents.length} document{selectedEvents.length !== 1 ? "s" : ""}
          </h3>
          <div className="space-y-2">
            {selectedEvents.map((e, i) => {
              const days = differenceInCalendarDays(parseISO(e.date), new Date());
              return (
                <div key={i} className="flex items-center justify-between px-4 py-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{e.documentType} — {e.entityRef}</p>
                    <p className="text-xs text-slate-500">{e.customerName}</p>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full",
                      days < 0 ? "bg-red-100 text-red-700" :
                      days <= 7 ? "bg-red-100 text-red-700" :
                      days <= 14 ? "bg-orange-100 text-orange-700" :
                      "bg-yellow-100 text-yellow-700"
                    )}>
                      {e.kind === "renewal" ? "Renewal" : "Expiry"}
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {days < 0 ? `${Math.abs(days)}d ago` : days === 0 ? "Today" : `${days}d away`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="font-medium">Legend:</span>
        {[
          { color: "bg-red-500", label: "≤7 days / expired" },
          { color: "bg-orange-400", label: "8–14 days" },
          { color: "bg-yellow-400", label: "15–30 days" },
          { color: "bg-green-400", label: ">30 days" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-sm ${l.color}`} />
            <span>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
