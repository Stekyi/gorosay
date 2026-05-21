"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface Props {
  customerId: string;
  customerName: string;
  outstanding: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function PaymentRecordModal({
  customerId,
  customerName,
  outstanding,
  onClose,
  onSuccess,
}: Props) {
  const [amount, setAmount] = useState(outstanding > 0 ? String(outstanding.toFixed(2)) : "");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState<"CASH" | "MOBILE_MONEY" | "BANK_TRANSFER">("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          amountGhs: parseFloat(amount),
          paidAt,
          method,
          reference: reference || undefined,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to record payment");
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error saving payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Record Payment</h2>
            <p className="text-xs text-slate-500 mt-0.5">{customerName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {outstanding > 0 && (
          <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            <p className="text-xs text-amber-600">Outstanding balance</p>
            <p className="text-xl font-bold text-amber-800">GHC {outstanding.toFixed(2)}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-0.5">
                Amount Received (GHC) <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-slate-400 mb-1">How much cash/transfer was collected</p>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-0.5">
                Date of Payment <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-slate-400 mb-1">When the money was actually received</p>
              <input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-0.5">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-slate-400 mb-1.5">How the customer paid</p>
            <div className="grid grid-cols-3 gap-2">
              {(["CASH", "MOBILE_MONEY", "BANK_TRANSFER"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`px-3 py-2.5 rounded-lg text-xs font-medium border transition-colors ${
                    method === m
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-slate-300 text-slate-600 hover:border-slate-400"
                  }`}
                >
                  {m === "MOBILE_MONEY" ? "Mobile Money" : m === "BANK_TRANSFER" ? "Bank Transfer" : "Cash"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-0.5">
              Reference / Transaction ID
            </label>
            <p className="text-xs text-slate-400 mb-1">MoMo transaction code, bank reference, receipt number, etc.</p>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. GH-1234567890"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium"
            >
              {saving ? "Saving..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
