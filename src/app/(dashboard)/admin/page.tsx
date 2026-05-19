"use client";

import { useEffect, useState } from "react";
import { Settings, FileText, DollarSign, MessageSquare, Mail, Users, Eye, EyeOff, Plus, X } from "lucide-react";

interface Setting {
  key: string;
  value: string;
}

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface DocType {
  id: string;
  name: string;
  slug: string;
  appliesTo: string;
  isActive: boolean;
  sortOrder: number;
}

const SETTING_LABELS: Record<string, { label: string; type: string; section: string }> = {
  price_new_vehicle: { label: "New Vehicle Package (GHC)", type: "number", section: "pricing" },
  price_new_driver: { label: "New Driver License (GHC)", type: "number", section: "pricing" },
  price_renewal: { label: "Renewal Upload (GHC)", type: "number", section: "pricing" },
  sms_provider: { label: "SMS Provider (arkesel / mnotify)", type: "text", section: "sms" },
  sms_api_key: { label: "SMS API Key", type: "password", section: "sms" },
  sms_sender_id: { label: "SMS Sender ID (Business Name)", type: "text", section: "sms" },
  sms_enabled: { label: "SMS Notifications Enabled", type: "toggle", section: "sms" },
  email_from_name: { label: "Email Sender Name", type: "text", section: "email" },
  email_from_address: { label: "Gmail Address", type: "email", section: "email" },
  email_app_password: { label: "Gmail App Password", type: "password", section: "email" },
  email_enabled: { label: "Email Notifications Enabled", type: "toggle", section: "email" },
  notify_days_before: { label: "Alert Days Before (comma-separated, e.g. 5,1)", type: "text", section: "notifications" },
};

export default function AdminPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newDocType, setNewDocType] = useState({ name: "", appliesTo: "vehicle" });
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ name: "", email: "", password: "", confirm: "" });
  const [newUserError, setNewUserError] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [resetTarget, setResetTarget] = useState<StaffUser | null>(null);
  const [resetPwd, setResetPwd] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/settings").then((r) => r.json()).catch(() => []),
      fetch("/api/admin/document-types?active=false").then((r) => r.json()).catch(() => []),
      fetch("/api/admin/users").then((r) => r.json()).catch(() => []),
    ]).then(([s, dt, users]) => {
      if (Array.isArray(s)) {
        const map: Record<string, string> = {};
        for (const row of s as Setting[]) map[row.key] = row.value;
        setSettings(map);
      }
      if (Array.isArray(dt)) setDocTypes(dt);
      if (Array.isArray(users)) setStaffList(users);
    });
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setNewUserError("");
    if (newUser.password !== newUser.confirm) {
      setNewUserError("Passwords do not match.");
      return;
    }
    if (newUser.password.length < 8) {
      setNewUserError("Password must be at least 8 characters.");
      return;
    }
    setCreatingUser(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newUser.name, email: newUser.email, password: newUser.password }),
    });
    const data = await res.json();
    setCreatingUser(false);
    if (!res.ok) {
      setNewUserError(data.error?.fieldErrors?.email?.[0] ?? "Failed to create user.");
      return;
    }
    setStaffList((prev) => [...prev, data]);
    setNewUser({ name: "", email: "", password: "", confirm: "" });
    setShowCreateUser(false);
  }

  async function toggleUserActive(user: StaffUser) {
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, isActive: !user.isActive }),
    });
    setStaffList((prev) => prev.map((u) => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
  }

  async function resetPassword() {
    if (!resetTarget || resetPwd.length < 8) return;
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: resetTarget.id, password: resetPwd }),
    });
    setResetTarget(null);
    setResetPwd("");
  }

  async function saveSettings() {
    setSaving(true);
    await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function addDocType() {
    if (!newDocType.name.trim()) return;
    const res = await fetch("/api/admin/document-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newDocType, sortOrder: docTypes.length + 1 }),
    });
    const dt = await res.json();
    setDocTypes((prev) => [...prev, dt]);
    setNewDocType({ name: "", appliesTo: "vehicle" });
  }

  async function toggleDocType(id: string, isActive: boolean) {
    await fetch("/api/admin/document-types", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: !isActive }),
    });
    setDocTypes((prev) => prev.map((dt) => dt.id === id ? { ...dt, isActive: !isActive } : dt));
  }

  function renderSetting(key: string) {
    const meta = SETTING_LABELS[key];
    if (!meta) return null;
    const value = settings[key] ?? "";

    if (meta.type === "toggle") {
      return (
        <div key={key} className="flex items-center justify-between py-2">
          <span className="text-sm text-slate-700">{meta.label}</span>
          <button
            onClick={() => setSettings((s) => ({ ...s, [key]: value === "true" ? "false" : "true" }))}
            className={`relative w-10 h-6 rounded-full transition-colors ${value === "true" ? "bg-blue-600" : "bg-slate-300"}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${value === "true" ? "translate-x-5" : "translate-x-1"}`} />
          </button>
        </div>
      );
    }

    return (
      <div key={key} className="space-y-1">
        <label className="block text-sm font-medium text-slate-700">{meta.label}</label>
        <input
          type={meta.type === "password" ? "password" : meta.type === "email" ? "email" : "text"}
          value={value}
          onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.value }))}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={meta.type === "password" ? "Enter to update..." : ""}
        />
      </div>
    );
  }

  const sections = [
    { id: "pricing", label: "Pricing", icon: DollarSign, keys: ["price_new_vehicle", "price_new_driver", "price_renewal"] },
    { id: "sms", label: "SMS Gateway", icon: MessageSquare, keys: ["sms_provider", "sms_api_key", "sms_sender_id", "sms_enabled"] },
    { id: "email", label: "Email", icon: Mail, keys: ["email_from_name", "email_from_address", "email_app_password", "email_enabled"] },
    { id: "notifications", label: "Notification Schedule", icon: Settings, keys: ["notify_days_before"] },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Configure pricing, SMS, email, and document types</p>
      </div>

      {/* Staff Users */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-900">Staff Users</h2>
          </div>
          <button
            onClick={() => setShowCreateUser((v) => !v)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            {showCreateUser ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add User</>}
          </button>
        </div>

        {showCreateUser && (
          <form onSubmit={createUser} className="mb-5 p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
            <p className="text-xs font-medium text-blue-800">New staff user — role is Clerk (no admin access)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Full Name</label>
                <input
                  required
                  value={newUser.name}
                  onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="Ama Owusu"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Email Address</label>
                <input
                  required
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="ama@example.com"
                />
              </div>
              <div className="relative">
                <label className="block text-xs text-slate-600 mb-1">Password (min 8 chars)</label>
                <input
                  required
                  type={showPwd ? "text" : "password"}
                  value={newUser.password}
                  onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm pr-9"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-2.5 top-7 text-slate-400 hover:text-slate-600">
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Confirm Password</label>
                <input
                  required
                  type={showPwd ? "text" : "password"}
                  value={newUser.confirm}
                  onChange={(e) => setNewUser((u) => ({ ...u, confirm: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>
            {newUserError && <p className="text-xs text-red-600">{newUserError}</p>}
            <button
              type="submit"
              disabled={creatingUser}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium"
            >
              {creatingUser ? "Creating..." : "Create User"}
            </button>
          </form>
        )}

        <div className="space-y-2">
          {staffList.map((user) => (
            <div key={user.id} className="flex items-center justify-between py-2.5 px-3 bg-slate-50 rounded-lg">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{user.name}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    user.role === "ADMIN" ? "bg-purple-100 text-purple-700" : "bg-slate-200 text-slate-600"
                  }`}>{user.role}</span>
                  {!user.isActive && <span className="text-xs text-red-500">Inactive</span>}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setResetTarget(user); setResetPwd(""); }}
                  className="text-xs text-slate-500 hover:text-blue-600 px-2 py-1 rounded border border-slate-200 hover:border-blue-300"
                >
                  Reset PW
                </button>
                {user.role !== "ADMIN" && (
                  <button
                    onClick={() => toggleUserActive(user)}
                    className={`text-xs px-2 py-1 rounded-full font-medium border transition-colors ${
                      user.isActive
                        ? "bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                        : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                    }`}
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </button>
                )}
              </div>
            </div>
          ))}
          {staffList.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-3">No staff users yet.</p>
          )}
        </div>
      </div>

      {/* Reset password modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-slate-900 mb-1">Reset Password</h3>
            <p className="text-xs text-slate-500 mb-4">Set a new password for <strong>{resetTarget.name}</strong></p>
            <input
              type="password"
              placeholder="New password (min 8 chars)"
              value={resetPwd}
              onChange={(e) => setResetPwd(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={resetPassword}
                disabled={resetPwd.length < 8}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 rounded-lg text-sm font-medium"
              >
                Update Password
              </button>
              <button onClick={() => setResetTarget(null)} className="flex-1 border border-slate-300 rounded-lg text-sm py-2 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings sections */}
      {sections.map((section) => (
        <div key={section.id} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <section.icon className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-900">{section.label}</h2>
          </div>
          <div className="space-y-3">
            {section.keys.map(renderSetting)}
          </div>
        </div>
      ))}

      <div className="flex justify-end">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium"
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save All Settings"}
        </button>
      </div>

      {/* Document Types */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-4">
          <FileText className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-slate-900">Document Types</h2>
        </div>

        <div className="space-y-2 mb-4">
          {docTypes.map((dt) => (
            <div key={dt.id} className="flex items-center justify-between py-2 px-3 bg-slate-50 rounded-lg">
              <div>
                <span className={`text-sm font-medium ${dt.isActive ? "text-slate-900" : "text-slate-400 line-through"}`}>{dt.name}</span>
                <span className="ml-2 text-xs text-slate-400">({dt.appliesTo})</span>
              </div>
              <button
                onClick={() => toggleDocType(dt.id, dt.isActive)}
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${dt.isActive ? "bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-700" : "bg-slate-100 text-slate-500 hover:bg-green-100 hover:text-green-700"}`}
              >
                {dt.isActive ? "Active" : "Inactive"}
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-2 border-t border-slate-100">
          <input
            type="text"
            placeholder="New document type name"
            value={newDocType.name}
            onChange={(e) => setNewDocType((f) => ({ ...f, name: e.target.value }))}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
          <select
            value={newDocType.appliesTo}
            onChange={(e) => setNewDocType((f) => ({ ...f, appliesTo: e.target.value }))}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="vehicle">Vehicle</option>
            <option value="driver">Driver</option>
            <option value="both">Both</option>
          </select>
          <button onClick={addDocType} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700">
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
