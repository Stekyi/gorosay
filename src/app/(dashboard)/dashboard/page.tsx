"use client";

import { useEffect, useState } from "react";
import { Users, Car, FileText, AlertTriangle } from "lucide-react";
import { ExpiryDateBadge } from "@/components/shared/ExpiryDateBadge";
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

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [expiring, setExpiring] = useState<ExpiringDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats);
        setExpiring(data.expiringDocs);
      })
      .finally(() => setLoading(false));
  }, []);

  const cards = stats
    ? [
        { label: "Customers", value: stats.customers, icon: Users, color: "bg-blue-500" },
        { label: "Vehicles", value: stats.vehicles, icon: Car, color: "bg-purple-500" },
        { label: "Active Docs", value: stats.activeDocuments, icon: FileText, color: "bg-green-500" },
        { label: "Expiring (30d)", value: stats.expiringIn30Days, icon: AlertTriangle, color: "bg-amber-500" },
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
              <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-slate-500 font-medium">{card.label}</p>
                  <div className={`w-8 h-8 ${card.color} rounded-lg flex items-center justify-center`}>
                    <card.icon className="w-4 h-4 text-white" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-slate-900">{card.value}</p>
              </div>
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
    </div>
  );
}
