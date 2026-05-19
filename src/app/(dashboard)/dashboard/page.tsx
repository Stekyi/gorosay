"use client";

import { useEffect, useState, useCallback } from "react";
import { Users, Car, FileText, AlertTriangle, X, Download, Search } from "lucide-react";
import { ExpiryDateBadge } from "@/components/shared/ExpiryDateBadge";
import { differenceInCalendarDays, parseISO, format, addDays } from "date-fns";
import { cn } from "@/lib/utils/cn";
import Link from "next/link";

interface Stats {
  customers: number;
  vehicles: number;
  drivers: number;
  activeDocuments: number;
  expiringIn30Days: number;
}

interface ExpiringDoc {
  id: string;
  expiryDate: string;
  entityRef: string;
  documentTypeName: string;
  vehicleId: string | null;
  driverId: string | null;
}

interface Customer {
  id: string;
  customerNumber: string | null;
  customerType: string;
  name: string;
  tel: string;
  cityName: string | null;
}

interface ReportRow {
  docId: string;
  docTypeName: string;
  documentNumber: string | null;
  expiryDate: string | null;
  fileKey: string;
  fileName: string;
  status: string;
  entityRef: string | null;
  entityType: "vehicle" | "driver";
  customerId: string;
  customerName: string;
  customerType: string;
}

type ModalType = "customers" | "vehicles" | "activeDocs" | "expiring" | null;

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

async function downloadDoc(fileKey: string, fileName: string) {
  const res = await fetch("/api/storage/download-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileKey }),
  });
  const { downloadUrl } = await res.json();
  window.open(downloadUrl, "_blank");
}

function CustomersModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [rows, setRows] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const debouncedQ = useDebounce(q);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    if (type !== "all") params.set("type", type);
    params.set("limit", "100");
    fetch(`/api/customers?${params}`)
      .then((r) => r.json())
      .then((d) => { setRows(d.data ?? []); setTotal(d.total ?? 0); });
  }, [debouncedQ, type]);

  return (
    <Modal title={`Customers (${total})`} onClose={onClose}>
      <div className="p-4 border-b border-slate-100 flex gap-3">
        <input
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          placeholder="Search name, phone, ID..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex gap-1.5">
          {["all", "INDIVIDUAL", "AGENCY"].map((t) => (
            <button key={t} onClick={() => setType(t)}
              className={cn("px-3 py-2 rounded-lg text-xs font-medium border",
                type === t ? "bg-blue-600 text-white border-blue-600" : "border-slate-300 text-slate-600 hover:border-blue-400"
              )}>
              {t === "all" ? "All" : t === "INDIVIDUAL" ? "Individual" : "Agency"}
            </button>
          ))}
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Name</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">ID</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Phone</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Type</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">City</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((c) => (
            <tr key={c.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link href={`/customers/${c.id}`} className="font-medium text-blue-600 hover:underline">{c.name}</Link>
              </td>
              <td className="px-4 py-3 text-slate-500 text-xs">{c.customerNumber ?? "—"}</td>
              <td className="px-4 py-3 text-slate-600">{c.tel}</td>
              <td className="px-4 py-3">
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                  c.customerType === "AGENCY" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                )}>{c.customerType}</span>
              </td>
              <td className="px-4 py-3 text-slate-500 text-xs">{c.cityName ?? "—"}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">No customers found.</td></tr>
          )}
        </tbody>
      </table>
    </Modal>
  );
}

function DocsModal({ title, baseParams, onClose }: { title: string; baseParams: string; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const debouncedQ = useDebounce(q);

  useEffect(() => {
    const params = new URLSearchParams(baseParams);
    if (debouncedQ) params.set("q", debouncedQ);
    params.set("limit", "100");
    fetch(`/api/reports?${params}`)
      .then((r) => r.json())
      .then((d) => { setRows(d.data ?? []); setTotal(d.total ?? 0); });
  }, [debouncedQ, baseParams]);

  return (
    <Modal title={`${title} (${total})`} onClose={onClose}>
      <div className="p-4 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm"
            placeholder="Search by customer name..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-slate-50 border-b border-slate-100">
          <tr>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Customer</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Entity</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Doc Type</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Expiry</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500">DL</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const days = r.expiryDate ? differenceInCalendarDays(parseISO(r.expiryDate), new Date()) : null;
            const urgent = days !== null && days <= 7;
            return (
              <tr key={r.docId} className={cn("hover:bg-slate-50", urgent && "bg-red-50 hover:bg-red-100")}>
                <td className="px-4 py-3">
                  <Link href={`/customers/${r.customerId}`} className="font-medium text-blue-600 hover:underline text-sm">
                    {r.customerName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-700 text-sm">{r.entityRef ?? "—"}</td>
                <td className="px-4 py-3 text-slate-700 text-sm">{r.docTypeName}</td>
                <td className="px-4 py-3"><ExpiryDateBadge expiryDate={r.expiryDate} /></td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => downloadDoc(r.fileKey, r.fileName)} className="text-slate-400 hover:text-blue-600">
                    <Download className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">No documents found.</td></tr>
          )}
        </tbody>
      </table>
    </Modal>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [expiring, setExpiring] = useState<ExpiringDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats);
        setExpiring(data.expiringDocs);
      })
      .finally(() => setLoading(false));
  }, []);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const in30DaysStr = format(addDays(new Date(), 30), "yyyy-MM-dd");

  const modalParamsMap: Record<string, string> = {
    vehicles: "entityType=vehicle",
    activeDocs: "status=ACTIVE",
    expiring: `dateType=expiry&dateFrom=${todayStr}&dateTo=${in30DaysStr}&status=ACTIVE`,
  };

  const cards = stats
    ? [
        { key: "customers", label: "Customers", value: stats.customers, icon: Users, color: "bg-blue-500" },
        { key: "vehicles", label: "Vehicles", value: stats.vehicles, icon: Car, color: "bg-purple-500" },
        { key: "activeDocs", label: "Active Docs", value: stats.activeDocuments, icon: FileText, color: "bg-green-500" },
        { key: "expiring", label: "Expiring (30d)", value: stats.expiringIn30Days, icon: AlertTriangle, color: "bg-amber-500" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Overview of all documents and customers</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
                <div className="h-4 w-20 bg-slate-200 rounded mb-3" />
                <div className="h-8 w-12 bg-slate-200 rounded" />
              </div>
            ))
          : cards.map((card) => (
              <button
                key={card.key}
                onClick={() => setActiveModal(card.key as ModalType)}
                className="bg-white rounded-xl border border-slate-200 p-5 text-left hover:border-blue-400 hover:shadow-sm transition-all group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-slate-500 font-medium">{card.label}</p>
                  <div className={`w-8 h-8 ${card.color} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <card.icon className="w-4 h-4 text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-slate-900">{card.value}</p>
                <p className="text-xs text-blue-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">Click to view →</p>
              </button>
            ))}
      </div>

      {/* Expiry alerts */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Expiring in Next 30 Days</h2>
          <Link href="/calendar" className="text-xs text-blue-600 hover:underline">
            View calendar
          </Link>
        </div>
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        ) : expiring.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            No documents expiring in the next 30 days.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {expiring.map((doc) => (
              <div key={doc.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{doc.documentTypeName}</p>
                  <p className="text-xs text-slate-500">{doc.entityRef}</p>
                </div>
                <ExpiryDateBadge expiryDate={doc.expiryDate} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {activeModal === "customers" && <CustomersModal onClose={() => setActiveModal(null)} />}
      {activeModal === "vehicles" && (
        <DocsModal title="Vehicle Documents" baseParams={modalParamsMap.vehicles} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === "activeDocs" && (
        <DocsModal title="Active Documents" baseParams={modalParamsMap.activeDocs} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === "expiring" && (
        <DocsModal title="Expiring in 30 Days" baseParams={modalParamsMap.expiring} onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
}
