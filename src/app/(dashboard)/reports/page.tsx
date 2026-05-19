"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, Search, X, ChevronDown, ChevronUp } from "lucide-react";
import { ExpiryDateBadge } from "@/components/shared/ExpiryDateBadge";
import { differenceInCalendarDays, parseISO, format } from "date-fns";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";

interface DocType {
  id: string;
  name: string;
  slug: string;
}

interface ReportRow {
  docId: string;
  docTypeName: string;
  documentNumber: string | null;
  placeOfIssue: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  renewalDates: string[];
  fileKey: string;
  fileName: string;
  status: string;
  entityRef: string | null;
  entityType: "vehicle" | "driver";
  vehicleType: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  customerId: string;
  customerName: string;
  customerNumber: string | null;
  customerType: string;
  customerTel: string;
}

interface Filters {
  q: string;
  tel: string;
  dateType: string;
  dateFrom: string;
  dateTo: string;
  docTypes: string[];
  vehicleType: string;
  make: string;
  year: string;
  placeOfIssue: string;
  status: string;
  entityType: string;
  customerType: string;
}

const defaultFilters: Filters = {
  q: "",
  tel: "",
  dateType: "expiry",
  dateFrom: "",
  dateTo: "",
  docTypes: [],
  vehicleType: "",
  make: "",
  year: "",
  placeOfIssue: "",
  status: "all",
  entityType: "all",
  customerType: "all",
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return differenceInCalendarDays(parseISO(dateStr), new Date());
}

function rowUrgency(row: ReportRow): "overdue" | "urgent" | "normal" {
  const days = daysUntil(row.expiryDate);
  if (days === null) return "normal";
  if (days < 0) return "overdue";
  if (days <= 7) return "urgent";
  return "normal";
}

export default function ReportsPage() {
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [applied, setApplied] = useState<Filters>(defaultFilters);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(true);
  const limit = 50;

  useEffect(() => {
    fetch("/api/admin/document-types")
      .then((r) => r.json())
      .then(setDocTypes);
  }, []);

  const fetchReports = useCallback(
    async (f: Filters, p: number) => {
      setLoading(true);
      const params = new URLSearchParams();
      if (f.q) params.set("q", f.q);
      if (f.tel) params.set("tel", f.tel);
      params.set("dateType", f.dateType);
      if (f.dateFrom) params.set("dateFrom", f.dateFrom);
      if (f.dateTo) params.set("dateTo", f.dateTo);
      if (f.docTypes.length > 0) params.set("docTypes", f.docTypes.join(","));
      if (f.vehicleType) params.set("vehicleType", f.vehicleType);
      if (f.make) params.set("make", f.make);
      if (f.year) params.set("year", f.year);
      if (f.placeOfIssue) params.set("placeOfIssue", f.placeOfIssue);
      if (f.status !== "all") params.set("status", f.status);
      if (f.entityType !== "all") params.set("entityType", f.entityType);
      if (f.customerType !== "all") params.set("customerType", f.customerType);
      params.set("page", String(p));
      params.set("limit", String(limit));

      const res = await fetch(`/api/reports?${params}`);
      const data = await res.json();
      setRows(data.data ?? []);
      setTotal(data.total ?? 0);
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    fetchReports(applied, page);
  }, [applied, page, fetchReports]);

  function applyFilters() {
    setPage(1);
    setApplied({ ...filters });
  }

  function clearFilters() {
    setFilters(defaultFilters);
    setPage(1);
    setApplied(defaultFilters);
  }

  function toggleDocType(id: string) {
    setFilters((f) => ({
      ...f,
      docTypes: f.docTypes.includes(id)
        ? f.docTypes.filter((d) => d !== id)
        : [...f.docTypes, id],
    }));
  }

  async function downloadDoc(fileKey: string, fileName: string) {
    const res = await fetch("/api/storage/download-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileKey }),
    });
    const { downloadUrl } = await res.json();
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = fileName;
    a.target = "_blank";
    a.click();
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="flex gap-0 -m-6 h-[calc(100vh-3.5rem)] min-h-0">
      {/* ── Filter Sidebar ── */}
      <aside className="w-72 shrink-0 bg-white border-r border-slate-200 overflow-y-auto flex flex-col">
        <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 text-sm">Filters</h2>
          <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-red-600 flex items-center gap-1">
            <X className="w-3 h-3" /> Clear
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-sm">
          {/* Customer search */}
          <div className="space-y-2">
            <p className="font-medium text-slate-700">Customer</p>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm placeholder:text-slate-400"
              placeholder="Name or ID..."
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            />
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm placeholder:text-slate-400"
              placeholder="Phone number..."
              value={filters.tel}
              onChange={(e) => setFilters((f) => ({ ...f, tel: e.target.value }))}
            />
            <div className="flex gap-1.5">
              {(["all", "INDIVIDUAL", "AGENCY"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilters((f) => ({ ...f, customerType: t }))}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    filters.customerType === t
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-slate-300 text-slate-600 hover:border-blue-400"
                  )}
                >
                  {t === "all" ? "All" : t === "INDIVIDUAL" ? "Individual" : "Agency"}
                </button>
              ))}
            </div>
          </div>

          {/* Entity type */}
          <div className="space-y-2">
            <p className="font-medium text-slate-700">Entity Type</p>
            <div className="flex gap-1.5">
              {(["all", "vehicle", "driver"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilters((f) => ({ ...f, entityType: t }))}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    filters.entityType === t
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-slate-300 text-slate-600 hover:border-blue-400"
                  )}
                >
                  {t === "all" ? "All" : t === "vehicle" ? "Vehicles" : "Drivers"}
                </button>
              ))}
            </div>
          </div>

          {/* Date filter */}
          <div className="space-y-2">
            <p className="font-medium text-slate-700">Date Range</p>
            <div className="flex gap-1.5">
              {(["expiry", "issue", "renewal"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilters((f) => ({ ...f, dateType: t }))}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    filters.dateType === t
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-slate-300 text-slate-600 hover:border-blue-400"
                  )}
                >
                  {t === "expiry" ? "Expiry" : t === "issue" ? "Issue" : "Renewal"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-500 mb-1 block">From</label>
                <input
                  type="date"
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1 block">To</label>
                <input
                  type="date"
                  className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {/* Document types */}
          <div className="space-y-2">
            <p className="font-medium text-slate-700">Document Types</p>
            <div className="space-y-1.5">
              {docTypes.map((dt) => (
                <label key={dt.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.docTypes.includes(dt.id)}
                    onChange={() => toggleDocType(dt.id)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span className="text-slate-700 text-xs">{dt.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Vehicle filters */}
          {filters.entityType !== "driver" && (
            <div className="space-y-2">
              <button
                onClick={() => setVehicleOpen((v) => !v)}
                className="flex items-center justify-between w-full font-medium text-slate-700"
              >
                <span>Vehicle Details</span>
                {vehicleOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {vehicleOpen && (
                <div className="space-y-2">
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm placeholder:text-slate-400"
                    placeholder="Vehicle type (car, truck...)"
                    value={filters.vehicleType}
                    onChange={(e) => setFilters((f) => ({ ...f, vehicleType: e.target.value }))}
                  />
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm placeholder:text-slate-400"
                    placeholder="Make (Toyota, Ford...)"
                    value={filters.make}
                    onChange={(e) => setFilters((f) => ({ ...f, make: e.target.value }))}
                  />
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm placeholder:text-slate-400"
                    placeholder="Year (2020)"
                    type="number"
                    value={filters.year}
                    onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
                  />
                </div>
              )}
            </div>
          )}

          {/* Place of issue */}
          <div className="space-y-2">
            <p className="font-medium text-slate-700">Place of Issue</p>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm placeholder:text-slate-400"
              placeholder="Issuing authority..."
              value={filters.placeOfIssue}
              onChange={(e) => setFilters((f) => ({ ...f, placeOfIssue: e.target.value }))}
            />
          </div>

          {/* Status */}
          <div className="space-y-2">
            <p className="font-medium text-slate-700">Status</p>
            <div className="flex gap-1.5">
              {(["all", "ACTIVE", "EXPIRED"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilters((f) => ({ ...f, status: s }))}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                    filters.status === s
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-slate-300 text-slate-600 hover:border-blue-400"
                  )}
                >
                  {s === "all" ? "All" : s === "ACTIVE" ? "Active" : "Expired"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100">
          <button
            onClick={applyFilters}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" /> Search
          </button>
        </div>
      </aside>

      {/* ── Results Table ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-lg font-bold text-slate-900">Document Search</h1>
            {!loading && (
              <p className="text-xs text-slate-500 mt-0.5">
                {total} result{total !== 1 ? "s" : ""}
                {total > limit && ` — page ${page} of ${totalPages}`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {total > 0 && (
              <span className="text-xs text-amber-600 font-medium">
                {rows.filter((r) => rowUrgency(r) !== "normal").length} urgent / overdue on this page
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="p-8 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Search className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No documents found. Adjust filters and click Search.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Entity</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Doc Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Doc #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Place of Issue</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Issue Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Expiry Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-xs font-semibold text-slate-500 whitespace-nowrap">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const urgency = rowUrgency(row);
                  return (
                    <tr
                      key={row.docId}
                      className={cn(
                        "hover:bg-slate-50 transition-colors",
                        urgency === "overdue" && "bg-red-50 hover:bg-red-100",
                        urgency === "urgent" && "bg-red-50 hover:bg-red-100"
                      )}
                    >
                      <td className="px-4 py-3 max-w-[160px]">
                        <Link href={`/customers/${row.customerId}`} className="font-medium text-slate-900 hover:text-blue-600 truncate block">
                          {row.customerName}
                        </Link>
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded-full font-medium",
                          row.customerType === "AGENCY" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                        )}>
                          {row.customerType}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[160px]">
                        <p className="font-medium text-slate-800 truncate">{row.entityRef ?? "—"}</p>
                        {row.entityType === "vehicle" && (
                          <p className="text-xs text-slate-400 truncate">
                            {[row.vehicleType, row.make, row.model, row.year].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        {row.entityType === "driver" && (
                          <p className="text-xs text-slate-400">Driver</p>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{row.docTypeName}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{row.documentNumber ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs max-w-[120px] truncate">{row.placeOfIssue ?? "—"}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                        {row.issueDate ? format(parseISO(row.issueDate), "dd MMM yyyy") : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <ExpiryDateBadge expiryDate={row.expiryDate} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn(
                          "inline-block text-xs px-2 py-0.5 rounded-full font-medium",
                          row.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                        )}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => downloadDoc(row.fileKey, row.fileName)}
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                          title="Download document"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
            <p className="text-xs text-slate-500">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg disabled:opacity-40 hover:border-blue-400"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-xs border border-slate-300 rounded-lg disabled:opacity-40 hover:border-blue-400"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
