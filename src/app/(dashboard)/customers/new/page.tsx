"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AutocompleteSelect } from "@/components/shared/AutocompleteSelect";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewCustomerPage() {
  const router = useRouter();
  const [customerType, setCustomerType] = useState<"INDIVIDUAL" | "AGENCY">("INDIVIDUAL");
  const [name, setName] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [cityId, setCityId] = useState("");
  const [suburbId, setSuburbId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function fetchCities(q: string) {
    const res = await fetch(`/api/admin/cities?q=${encodeURIComponent(q)}`);
    return res.json();
  }

  async function createCity(name: string) {
    const res = await fetch("/api/admin/cities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    return res.json();
  }

  async function fetchSuburbs(q: string) {
    if (!cityId) return [];
    const res = await fetch(`/api/admin/cities?q=${encodeURIComponent(q)}&cityId=${cityId}`);
    const all: { id: string; name: string; cityId: string }[] = await res.json();
    return all.filter((s) => s.cityId === cityId);
  }

  async function createSuburb(name: string) {
    const res = await fetch("/api/admin/cities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, cityId }),
    });
    return res.json();
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerType,
          name,
          tel,
          email: email || undefined,
          location: location || undefined,
          cityId: cityId || undefined,
          suburbId: suburbId || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.fieldErrors ? "Please check all fields." : "Failed to create customer");
      }
      const customer = await res.json();
      router.push(`/customers/${customer.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error creating customer");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/customers" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Customer</h1>
          <p className="text-sm text-slate-500 mt-0.5">Create a customer profile</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Customer type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Customer Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(["INDIVIDUAL", "AGENCY"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCustomerType(t)}
                  className={`py-2.5 px-4 rounded-lg text-sm font-medium border transition-colors ${
                    customerType === t
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-slate-300 text-slate-600 hover:border-slate-400"
                  }`}
                >
                  {t === "INDIVIDUAL" ? "Individual" : "Agency"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Full Name / Company Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Kwame Mensah"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={tel}
                onChange={(e) => setTel(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0244 123 456"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="optional"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Street Address / Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. No. 5, Ring Road Central"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <AutocompleteSelect
              label="City"
              value={cityId}
              onChange={(id) => { setCityId(id); setSuburbId(""); }}
              fetchOptions={fetchCities}
              onCreateNew={createCity}
              placeholder="Type city name..."
            />
            <AutocompleteSelect
              label="Suburb"
              value={suburbId}
              onChange={(id) => setSuburbId(id)}
              fetchOptions={fetchSuburbs}
              onCreateNew={cityId ? createSuburb : undefined}
              placeholder={cityId ? "Type suburb..." : "Select city first"}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Link
              href="/customers"
              className="flex-1 text-center px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium"
            >
              {saving ? "Creating..." : "Create Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
