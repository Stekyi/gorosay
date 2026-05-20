"use client";

import { useEffect, useState } from "react";
import {
  Settings, FileText, DollarSign, MessageSquare, Mail, Users,
  Eye, EyeOff, Plus, X, ScrollText, RefreshCw, CheckCircle2,
  AlertCircle, MinusCircle, ToggleLeft, ToggleRight, ShieldCheck,
} from "lucide-react";

interface Setting { key: string; value: string }
interface StaffUser { id: string; name: string; email: string; role: string; isActive: boolean; createdAt: string }
interface DocType { id: string; name: string; slug: string; appliesTo: string; isActive: boolean; sortOrder: number }
interface LogEntry { id: string; sentAt: string; type: string; channel: "email" | "sms"; recipient: string; subject: string; status: string; errorMessage: string | null }

const SETTING_LABELS: Record<string, { label: string; type: string; hint?: string }> = {
  price_new_vehicle: { label: "New Vehicle Package", type: "number", hint: "GHC" },
  price_new_driver: { label: "New Driver License", type: "number", hint: "GHC" },
  price_renewal: { label: "Renewal Upload", type: "number", hint: "GHC" },
  sms_provider: { label: "SMS Provider", type: "text", hint: "arkesel or mnotify" },
  sms_api_key: { label: "API Key", type: "password" },
  sms_sender_id: { label: "Sender ID", type: "text", hint: "Shown on incoming SMS" },
  sms_enabled: { label: "SMS Enabled", type: "toggle" },
  email_from_name: { label: "Sender Name", type: "text" },
  email_from_address: { label: "Gmail Address", type: "email" },
  email_smtp_username: { label: "SMTP Username", type: "text", hint: "Leave blank to use Gmail address" },
  email_app_password: { label: "App Password", type: "password", hint: "16-char Gmail App Password" },
  email_smtp_host: { label: "SMTP Host", type: "text", hint: "smtp.gmail.com" },
  email_smtp_port: { label: "SMTP Port", type: "text", hint: "587 (STARTTLS) or 465 (SSL)" },
  email_enabled: { label: "Email Enabled", type: "toggle" },
  notify_days_before: { label: "Alert Days Before", type: "text", hint: "Comma-separated, e.g. 5,1" },
};

const TABS = [
  { id: "settings", label: "Settings", icon: Settings },
  { id: "staff", label: "Staff", icon: Users },
  { id: "doctypes", label: "Document Types", icon: FileText },
  { id: "log", label: "Activity Log", icon: ScrollText },
] as const;
type Tab = typeof TABS[number]["id"];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("settings");
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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  function loadLogs() {
    setLogsLoading(true);
    fetch("/api/admin/email-logs?limit=100")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setLogs(data); })
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  }

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
    loadLogs();
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setNewUserError("");
    if (newUser.password !== newUser.confirm) { setNewUserError("Passwords do not match."); return; }
    if (newUser.password.length < 8) { setNewUserError("Password must be at least 8 characters."); return; }
    setCreatingUser(true);
    const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newUser.name, email: newUser.email, password: newUser.password }) });
    const data = await res.json();
    setCreatingUser(false);
    if (!res.ok) { setNewUserError(data.error?.fieldErrors?.email?.[0] ?? "Failed to create user."); return; }
    setStaffList((prev) => [...prev, data]);
    setNewUser({ name: "", email: "", password: "", confirm: "" });
    setShowCreateUser(false);
  }

  async function toggleUserActive(user: StaffUser) {
    await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, isActive: !user.isActive }) });
    setStaffList((prev) => prev.map((u) => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
  }

  async function resetPassword() {
    if (!resetTarget || resetPwd.length < 8) return;
    await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: resetTarget.id, password: resetPwd }) });
    setResetTarget(null); setResetPwd("");
  }

  async function saveSettings() {
    setSaving(true);
    await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  async function addDocType() {
    if (!newDocType.name.trim()) return;
    const res = await fetch("/api/admin/document-types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...newDocType, sortOrder: docTypes.length + 1 }) });
    const dt = await res.json();
    setDocTypes((prev) => [...prev, dt]);
    setNewDocType({ name: "", appliesTo: "vehicle" });
  }

  async function toggleDocType(id: string, isActive: boolean) {
    await fetch("/api/admin/document-types", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, isActive: !isActive }) });
    setDocTypes((prev) => prev.map((dt) => dt.id === id ? { ...dt, isActive: !isActive } : dt));
  }

  function Field({ k }: { k: string }) {
    const meta = SETTING_LABELS[k];
    if (!meta) return null;
    const value = settings[k] ?? "";
    if (meta.type === "toggle") {
      const on = value === "true";
      return (
        <div className="flex items-center justify-between py-1">
          <span className="text-sm text-slate-700">{meta.label}</span>
          <button
            onClick={() => setSettings((s) => ({ ...s, [k]: on ? "false" : "true" }))}
            className="flex items-center gap-1.5 text-sm font-medium"
          >
            {on
              ? <><ToggleRight className="w-8 h-8 text-blue-600" /><span className="text-blue-600">On</span></>
              : <><ToggleLeft className="w-8 h-8 text-slate-400" /><span className="text-slate-400">Off</span></>
            }
          </button>
        </div>
      );
    }
    return (
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wide">{meta.label}</label>
        <div className="relative">
          <input
            type={meta.type === "password" ? "password" : meta.type === "email" ? "email" : meta.type === "number" ? "number" : "text"}
            value={value}
            onChange={(e) => setSettings((s) => ({ ...s, [k]: e.target.value }))}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={meta.hint ?? (meta.type === "password" ? "Enter to update…" : "")}
          />
          {meta.hint && meta.type !== "password" && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{meta.hint}</span>
          )}
        </div>
      </div>
    );
  }

  const settingSections = [
    {
      id: "pricing", icon: DollarSign, color: "bg-emerald-100 text-emerald-700",
      title: "Pricing", desc: "Service fees automatically charged on each action",
      keys: ["price_new_vehicle", "price_new_driver", "price_renewal"],
    },
    {
      id: "email", icon: Mail, color: "bg-blue-100 text-blue-700",
      title: "Email", desc: "Gmail SMTP credentials for outbound notifications",
      keys: ["email_from_name", "email_from_address", "email_smtp_username", "email_app_password", "email_smtp_host", "email_smtp_port", "email_enabled"],
    },
    {
      id: "sms", icon: MessageSquare, color: "bg-purple-100 text-purple-700",
      title: "SMS Gateway", desc: "Arkesel or mNotify credentials for SMS alerts",
      keys: ["sms_provider", "sms_api_key", "sms_sender_id", "sms_enabled"],
    },
    {
      id: "notify", icon: Settings, color: "bg-orange-100 text-orange-700",
      title: "Notifications", desc: "When to send expiry alerts before due dates",
      keys: ["notify_days_before"],
    },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin</h1>
          <p className="text-sm text-slate-500 mt-0.5">System configuration, staff accounts, and activity</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          Admin access only
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-0 -mb-px">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? "border-blue-600 text-blue-600 bg-blue-50/50"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
              {t.id === "log" && logs.some((l) => l.status === "failed") && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ── SETTINGS TAB ── */}
      {tab === "settings" && (
        <div className="space-y-4">
          {settingSections.map((sec) => (
            <div key={sec.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="flex items-start gap-4 p-5 border-b border-slate-100">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${sec.color}`}>
                  <sec.icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">{sec.title}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{sec.desc}</p>
                </div>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sec.keys.map((k) => <Field key={k} k={k} />)}
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <button
              onClick={saveSettings}
              disabled={saving}
              className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                saved
                  ? "bg-green-600 text-white"
                  : "bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white"
              }`}
            >
              {saving ? "Saving…" : saved ? "✓ Saved" : "Save All Settings"}
            </button>
          </div>
        </div>
      )}

      {/* ── STAFF TAB ── */}
      {tab === "staff" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                  <Users className="w-4 h-4 text-slate-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 text-sm">Staff Accounts</h3>
                  <p className="text-xs text-slate-500">{staffList.length} user{staffList.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateUser((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  showCreateUser ? "bg-slate-100 text-slate-600" : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {showCreateUser ? <><X className="w-3.5 h-3.5" /> Cancel</> : <><Plus className="w-3.5 h-3.5" /> Add User</>}
              </button>
            </div>

            {showCreateUser && (
              <form onSubmit={createUser} className="p-5 border-b border-slate-100 bg-blue-50/60">
                <p className="text-xs font-medium text-blue-700 mb-3">New accounts are created as Clerk (no admin access)</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Full Name</label>
                    <input required value={newUser.name} onChange={(e) => setNewUser((u) => ({ ...u, name: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" placeholder="Ama Owusu" />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Email Address</label>
                    <input required type="email" value={newUser.email} onChange={(e) => setNewUser((u) => ({ ...u, email: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" placeholder="ama@example.com" />
                  </div>
                  <div className="relative">
                    <label className="block text-xs text-slate-600 mb-1">Password (min 8 chars)</label>
                    <input required type={showPwd ? "text" : "password"} value={newUser.password} onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white pr-9" placeholder="••••••••" />
                    <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-2.5 top-7 text-slate-400 hover:text-slate-600">
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Confirm Password</label>
                    <input required type={showPwd ? "text" : "password"} value={newUser.confirm} onChange={(e) => setNewUser((u) => ({ ...u, confirm: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white" placeholder="••••••••" />
                  </div>
                </div>
                {newUserError && <p className="text-xs text-red-600 mb-2">{newUserError}</p>}
                <button type="submit" disabled={creatingUser} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium">
                  {creatingUser ? "Creating…" : "Create Account"}
                </button>
              </form>
            )}

            <div className="divide-y divide-slate-100">
              {staffList.map((user) => (
                <div key={user.id} className="flex items-center gap-4 px-5 py-4">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    user.role === "ADMIN" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{user.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        user.role === "ADMIN" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-500"
                      }`}>{user.role}</span>
                      {!user.isActive && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Inactive</span>}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => { setResetTarget(user); setResetPwd(""); }} className="text-xs text-slate-500 hover:text-blue-600 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-blue-300 transition-colors">
                      Reset PW
                    </button>
                    {user.role !== "ADMIN" && (
                      <button
                        onClick={() => toggleUserActive(user)}
                        className={`text-xs px-2.5 py-1.5 rounded-lg font-medium border transition-colors ${
                          user.isActive
                            ? "bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                            : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                        }`}
                      >
                        {user.isActive ? "Active" : "Inactive"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {staffList.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No staff accounts yet.</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── DOCUMENT TYPES TAB ── */}
      {tab === "doctypes" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
              <FileText className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">Document Types</h3>
              <p className="text-xs text-slate-500">Configure which document categories are available for upload</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {docTypes.map((dt) => (
              <div key={dt.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dt.isActive ? "bg-green-500" : "bg-slate-300"}`} />
                <div className="flex-1 min-w-0">
                  <span className={`text-sm font-medium ${dt.isActive ? "text-slate-900" : "text-slate-400 line-through"}`}>{dt.name}</span>
                  <span className="ml-2 text-xs text-slate-400 capitalize">{dt.appliesTo}</span>
                </div>
                <button
                  onClick={() => toggleDocType(dt.id, dt.isActive)}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium border transition-colors ${
                    dt.isActive
                      ? "bg-green-50 text-green-700 border-green-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                      : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                  }`}
                >
                  {dt.isActive ? "Active" : "Inactive"}
                </button>
              </div>
            ))}
            {docTypes.length === 0 && <p className="text-sm text-slate-400 text-center py-6">No document types configured.</p>}
          </div>

          <div className="flex gap-3 p-5 border-t border-slate-100 bg-slate-50/50">
            <input
              type="text"
              placeholder="New document type name"
              value={newDocType.name}
              onChange={(e) => setNewDocType((f) => ({ ...f, name: e.target.value }))}
              className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === "Enter" && addDocType()}
            />
            <select
              value={newDocType.appliesTo}
              onChange={(e) => setNewDocType((f) => ({ ...f, appliesTo: e.target.value }))}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
            >
              <option value="vehicle">Vehicle</option>
              <option value="driver">Driver</option>
              <option value="both">Both</option>
            </select>
            <button onClick={addDocType} className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
              Add
            </button>
          </div>
        </div>
      )}

      {/* ── ACTIVITY LOG TAB ── */}
      {tab === "log" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                <ScrollText className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Email & Alert Log</h3>
                <p className="text-xs text-slate-500">Last 14 days · {logs.length} entries</p>
              </div>
            </div>
            <button
              onClick={loadLogs}
              disabled={logsLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {logs.length === 0 && !logsLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <ScrollText className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No activity logged yet.</p>
              <p className="text-xs mt-1">Emails and alerts will appear here once sent.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left text-xs font-semibold text-slate-500 px-5 py-3 whitespace-nowrap">Time</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-3 py-3">Type</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-3 py-3">Recipient</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-3 py-3">Subject / Details</th>
                    <th className="text-left text-xs font-semibold text-slate-500 px-3 py-3 pr-5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.map((log) => (
                    <tr key={log.id} className={`hover:bg-slate-50/50 transition-colors ${log.status === "failed" ? "bg-red-50/40" : ""}`}>
                      <td className="px-5 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {new Date(log.sentAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${
                          log.type === "welcome" ? "bg-emerald-100 text-emerald-700" :
                          log.type === "doc_upload" ? "bg-blue-100 text-blue-700" :
                          log.type === "sms_alert" ? "bg-purple-100 text-purple-700" :
                          "bg-orange-100 text-orange-700"
                        }`}>
                          {log.type === "welcome" ? "Welcome" :
                           log.type === "doc_upload" ? "Doc Upload" :
                           log.type === "sms_alert" ? "SMS Alert" :
                           "Expiry Alert"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-700 max-w-[160px] truncate">{log.recipient}</td>
                      <td className="px-3 py-3 text-xs text-slate-600 max-w-[260px]">
                        <span className="truncate block" title={log.subject}>{log.subject}</span>
                        {log.errorMessage && (
                          <span className="block text-red-500 mt-0.5 truncate" title={log.errorMessage}>{log.errorMessage}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 pr-5">
                        {log.status === "sent" && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                          </span>
                        )}
                        {log.status === "failed" && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                            <AlertCircle className="w-3.5 h-3.5" /> Failed
                          </span>
                        )}
                        {log.status === "skipped" && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400">
                            <MinusCircle className="w-3.5 h-3.5" /> Skipped
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Reset password modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <h3 className="font-semibold text-slate-900 mb-1">Reset Password</h3>
            <p className="text-xs text-slate-500 mb-4">New password for <strong>{resetTarget.name}</strong></p>
            <input
              type="password"
              placeholder="New password (min 8 chars)"
              value={resetPwd}
              onChange={(e) => setResetPwd(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button onClick={resetPassword} disabled={resetPwd.length < 8} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2 rounded-lg text-sm font-medium">Update</button>
              <button onClick={() => setResetTarget(null)} className="flex-1 border border-slate-200 rounded-lg text-sm py-2 hover:bg-slate-50">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
