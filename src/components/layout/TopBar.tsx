"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { LogOut, User, KeyRound, X, Eye, EyeOff } from "lucide-react";

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.next !== form.confirm) { setError("New passwords do not match."); return; }
    if (form.next.length < 8) { setError("New password must be at least 8 characters."); return; }
    setSaving(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setError(data.error ?? "Failed to change password."); return; }
    setSuccess(true);
    setTimeout(onClose, 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-900">Change Password</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
        </div>

        {success ? (
          <p className="text-green-600 text-sm text-center py-4 font-medium">Password updated successfully!</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Current Password</label>
              <input
                required
                type={showPwd ? "text" : "password"}
                value={form.current}
                onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                placeholder="Your current password"
              />
            </div>
            <div className="relative">
              <label className="block text-xs font-medium text-slate-600 mb-1">New Password (min 8 chars)</label>
              <input
                required
                type={showPwd ? "text" : "password"}
                value={form.next}
                onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm pr-9"
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-2.5 top-7 text-slate-400 hover:text-slate-600">
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Confirm New Password</label>
              <input
                required
                type={showPwd ? "text" : "password"}
                value={form.confirm}
                onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                placeholder="••••••••"
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg text-sm font-medium"
              >
                {saving ? "Saving..." : "Update Password"}
              </button>
              <button type="button" onClick={onClose} className="flex-1 border border-slate-300 rounded-lg text-sm py-2 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function TopBar() {
  const { data: session } = useSession();
  const [showChangePwd, setShowChangePwd] = useState(false);

  return (
    <>
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
        <div />
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <span className="font-medium">{session?.user?.name ?? "Staff"}</span>
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
              {(session?.user as { role?: string } | undefined)?.role ?? ""}
            </span>
          </div>
          <button
            onClick={() => setShowChangePwd(true)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            title="Change password"
          >
            <KeyRound className="w-4 h-4" />
          </button>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>
      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}
    </>
  );
}
