"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Car, User, FileText, CreditCard, Download, RefreshCw, Pencil, X, Trash2 } from "lucide-react";
import Link from "next/link";
import { ExpiryDateBadge } from "@/components/shared/ExpiryDateBadge";
import { DocumentUploadModal } from "@/components/documents/DocumentUploadModal";
import { PaymentRecordModal } from "@/components/payments/PaymentRecordModal";

interface CustomerProfile {
  customer: {
    id: string;
    customerNumber: string;
    customerType: string;
    name: string;
    tel: string;
    email: string | null;
    location: string | null;
    cityId: string | null;
    suburbId: string | null;
    cityName: string | null;
    suburbName: string | null;
    createdAt: string;
  };
  vehicles: Array<{
    id: string;
    vehicleNumber: string;
    registrationNumber: string | null;
    make: string | null;
    model: string | null;
    year: number | null;
    vehicleType: string | null;
  }>;
  drivers: Array<{
    id: string;
    driverNumber: string;
    fullName: string;
    tel: string | null;
  }>;
  balance: { totalCharged: number; totalPaid: number; outstanding: number };
}

interface Document {
  id: string;
  version: number;
  status: string;
  documentTypeName: string;
  documentTypeSlug: string;
  documentNumber: string | null;
  placeOfIssue: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  renewalDates: string[] | null;
  notes: string | null;
  fileName: string;
  fileKey: string;
  uploadedAt: string;
}

interface DocumentType {
  id: string;
  name: string;
  slug: string;
  appliesTo: string;
}

export default function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [vehicleDocs, setVehicleDocs] = useState<Record<string, Document[]>>({});
  const [driverDocs, setDriverDocs] = useState<Record<string, Document[]>>({});
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [prices, setPrices] = useState<{ newVehicle: number; newDriver: number } | null>(null);
  const [uploadTarget, setUploadTarget] = useState<{
    entityType: "vehicle" | "driver";
    entityId: string;
    entityRef: string;
    isRenewal: boolean;
  } | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [addingDriver, setAddingDriver] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ registrationNumber: "", make: "", model: "", year: "", vehicleType: "car", color: "" });
  const [driverForm, setDriverForm] = useState({ fullName: "" });
  const [vehicleError, setVehicleError] = useState("");
  const [driverError, setDriverError] = useState("");

  // Customer edit modal
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [editCForm, setEditCForm] = useState({ name: "", tel: "", email: "", location: "", customerType: "INDIVIDUAL" as "INDIVIDUAL" | "AGENCY", cityId: "", suburbId: "" });
  const [editCities, setEditCities] = useState<{ id: string; name: string }[]>([]);
  const [editSuburbs, setEditSuburbs] = useState<{ id: string; name: string }[]>([]);
  const [savingCustomer, setSavingCustomer] = useState(false);

  // Document edit modal
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [editDForm, setEditDForm] = useState({ documentNumber: "", placeOfIssue: "", issueDate: "", expiryDate: "", renewalDates: [] as string[], notes: "" });
  const [savingDoc, setSavingDoc] = useState(false);

  async function loadProfile() {
    const [profileRes, dtRes] = await Promise.all([
      fetch(`/api/customers/${id}`),
      fetch("/api/admin/document-types"),
    ]);
    const profileData = await profileRes.json();
    const dtData = await dtRes.json();
    setProfile(profileData);
    setDocTypes(dtData);

    // Load documents for each vehicle and driver
    const vDocs: Record<string, Document[]> = {};
    const dDocs: Record<string, Document[]> = {};
    await Promise.all([
      ...profileData.vehicles.map(async (v: { id: string }) => {
        const res = await fetch(`/api/vehicles/${v.id}/documents`);
        vDocs[v.id] = await res.json();
      }),
      ...profileData.drivers.map(async (d: { id: string }) => {
        const res = await fetch(`/api/drivers/${d.id}/documents`);
        dDocs[d.id] = await res.json();
      }),
    ]);
    setVehicleDocs(vDocs);
    setDriverDocs(dDocs);
    setLoading(false);
  }

  useEffect(() => {
    loadProfile();
    fetch("/api/prices").then((r) => r.ok ? r.json() : null).then((d) => { if (d) setPrices(d); }).catch(() => {});
  }, [id]);

  async function handleAddVehicle(e: React.SyntheticEvent) {
    e.preventDefault();
    setVehicleError("");
    const res = await fetch("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: id, ...vehicleForm, year: vehicleForm.year ? parseInt(vehicleForm.year) : undefined }),
    });
    if (res.ok) { setAddingVehicle(false); loadProfile(); }
    else {
      const d = await res.json().catch(() => ({}));
      setVehicleError(typeof d.error === "string" ? d.error : "Failed to add vehicle");
    }
  }

  async function handleAddDriver(e: React.SyntheticEvent) {
    e.preventDefault();
    setDriverError("");
    const res = await fetch("/api/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: id, ...driverForm }),
    });
    if (res.ok) { setAddingDriver(false); loadProfile(); }
    else {
      const d = await res.json().catch(() => ({}));
      setDriverError(typeof d.error === "string" ? d.error : "Failed to add driver");
    }
  }

  async function downloadDoc(fileKey: string) {
    const res = await fetch("/api/storage/download-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileKey }),
    });
    const { downloadUrl } = await res.json();
    window.open(downloadUrl, "_blank");
  }

  async function openCustomerEdit() {
    if (!profile) return;
    const c = profile.customer;
    setEditCForm({ name: c.name, tel: c.tel, email: c.email ?? "", location: c.location ?? "", customerType: c.customerType as "INDIVIDUAL" | "AGENCY", cityId: c.cityId ?? "", suburbId: c.suburbId ?? "" });
    const [citiesRes, suburbsRes] = await Promise.all([
      fetch("/api/admin/cities").then((r) => r.json()),
      fetch("/api/admin/cities?withSuburbs=true").then((r) => r.json()),
    ]);
    setEditCities(Array.isArray(citiesRes) ? citiesRes : []);
    // Build suburb list for current city
    if (Array.isArray(suburbsRes)) {
      const subs = suburbsRes.filter((row: { city: { id: string }; suburb: { id: string; name: string } | null }) => row.city.id === (c.cityId ?? "") && row.suburb).map((row: { suburb: { id: string; name: string } }) => row.suburb!);
      setEditSuburbs(subs);
    }
    setEditingCustomer(true);
  }

  function onEditCityChange(cityId: string, allRows: { city: { id: string }; suburb: { id: string; name: string } | null }[]) {
    setEditCForm((f) => ({ ...f, cityId, suburbId: "" }));
    const subs = allRows.filter((row) => row.city.id === cityId && row.suburb).map((row) => row.suburb!);
    setEditSuburbs(subs);
  }

  async function saveCustomerEdit(e: React.SyntheticEvent) {
    e.preventDefault();
    setSavingCustomer(true);
    await fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editCForm, email: editCForm.email || null, location: editCForm.location || null, cityId: editCForm.cityId || null, suburbId: editCForm.suburbId || null }),
    });
    setSavingCustomer(false);
    setEditingCustomer(false);
    loadProfile();
  }

  function openDocEdit(doc: Document) {
    setEditDForm({
      documentNumber: doc.documentNumber ?? "",
      placeOfIssue: doc.placeOfIssue ?? "",
      issueDate: doc.issueDate ?? "",
      expiryDate: doc.expiryDate ?? "",
      renewalDates: (doc.renewalDates ?? []).filter(Boolean),
      notes: doc.notes ?? "",
    });
    setEditingDoc(doc);
  }

  async function saveDocEdit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!editingDoc) return;
    setSavingDoc(true);
    await fetch(`/api/documents/${editingDoc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editDForm, documentNumber: editDForm.documentNumber || null, placeOfIssue: editDForm.placeOfIssue || null, issueDate: editDForm.issueDate || null, expiryDate: editDForm.expiryDate || null, notes: editDForm.notes || null, renewalDates: editDForm.renewalDates.filter(Boolean) }),
    });
    setSavingDoc(false);
    setEditingDoc(null);
    loadProfile();
  }

  if (loading || !profile) {
    return <div className="animate-pulse space-y-4"><div className="h-8 w-48 bg-slate-200 rounded" /><div className="h-40 bg-slate-200 rounded-xl" /></div>;
  }

  const { customer, vehicles, drivers, balance } = profile;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/customers" className="text-slate-400 hover:text-slate-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{customer.name}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                customer.customerType === "AGENCY" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
              }`}>{customer.customerType}</span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {customer.customerNumber} · {customer.tel}
              {customer.cityName && ` · ${customer.cityName}`}
              {customer.suburbName && `, ${customer.suburbName}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openCustomerEdit}
            className="flex items-center gap-1.5 border border-slate-300 hover:border-slate-400 text-slate-600 hover:text-slate-800 px-3 py-2 rounded-lg text-sm font-medium"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            onClick={() => setShowPayment(true)}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium"
          >
            <CreditCard className="w-4 h-4" /> Record Payment
          </button>
        </div>
      </div>

      {/* Balance summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Charged", value: balance.totalCharged, color: "text-slate-900" },
          { label: "Total Paid", value: balance.totalPaid, color: "text-green-700" },
          { label: "Outstanding", value: balance.outstanding, color: balance.outstanding > 0 ? "text-red-700" : "text-green-700" },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-xl border border-slate-200 p-4 text-center">
            <p className="text-xs text-slate-500 mb-1">{item.label}</p>
            <p className={`text-xl font-bold ${item.color}`}>GHC {item.value.toFixed(2)}</p>
          </div>
        ))}
      </div>

      {/* Vehicles */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-900">Vehicles ({vehicles.length})</h2>
          </div>
          <button
            onClick={() => setAddingVehicle(true)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <Plus className="w-3.5 h-3.5" /> Add Vehicle
          </button>
        </div>

        {addingVehicle && (
          <form onSubmit={handleAddVehicle} className="p-4 border-b border-slate-100 bg-blue-50">
            <div className="grid grid-cols-3 gap-3 mb-3">
              {[
                { key: "registrationNumber", placeholder: "Plate (GH-1234-23)", required: false },
                { key: "make", placeholder: "Make (Toyota)", required: false },
                { key: "model", placeholder: "Model (Corolla)", required: false },
                { key: "year", placeholder: "Year (2020)", required: false },
                { key: "vehicleType", placeholder: "Type (car, truck...)", required: false },
                { key: "color", placeholder: "Color", required: false },
              ].map(({ key, placeholder }) => (
                <input
                  key={key}
                  type="text"
                  placeholder={placeholder}
                  value={(vehicleForm as Record<string, string>)[key]}
                  onChange={(e) => setVehicleForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              ))}
            </div>
            {vehicleError && <p className="text-xs text-red-600 mb-2">{vehicleError}</p>}
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                Save Vehicle{prices ? ` (GHC ${prices.newVehicle.toFixed(2)} charged)` : ""}
              </button>
              <button type="button" onClick={() => { setAddingVehicle(false); setVehicleError(""); }} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancel</button>
            </div>
          </form>
        )}

        <div className="divide-y divide-slate-100">
          {vehicles.map((v) => {
            const docs = (vehicleDocs[v.id] ?? []).filter((d) => d.version === 1);
            const vDocTypes = docTypes.filter((dt) => dt.appliesTo === "vehicle" || dt.appliesTo === "both");
            return (
              <div key={v.id} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-slate-900">
                      {v.registrationNumber ?? v.vehicleNumber}
                      {v.make && ` — ${v.make} ${v.model ?? ""} ${v.year ? `(${v.year})` : ""}`}
                    </p>
                    <p className="text-xs text-slate-400">{v.vehicleType} · {v.vehicleNumber}</p>
                  </div>
                  <button
                    onClick={() => setUploadTarget({ entityType: "vehicle", entityId: v.id, entityRef: v.registrationNumber ?? v.vehicleNumber, isRenewal: false })}
                    className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded-lg"
                  >
                    <Plus className="w-3 h-3" /> Upload Doc
                  </button>
                </div>

                {/* Document list */}
                <div className="space-y-1.5">
                  {vDocTypes.map((dt) => {
                    const doc = docs.find((d) => d.documentTypeSlug === dt.slug);
                    return (
                      <div key={dt.id} className="flex items-center justify-between text-xs py-1.5 px-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-700 font-medium">{dt.name}</span>
                          {doc?.documentNumber && <span className="text-slate-400">#{doc.documentNumber}</span>}
                        </div>
                        {doc ? (
                          <div className="flex items-center gap-2">
                            <ExpiryDateBadge expiryDate={doc.expiryDate} />
                            <button onClick={() => openDocEdit(doc)} className="text-slate-400 hover:text-blue-600" title="Edit details">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => downloadDoc(doc.fileKey)}
                              className="text-slate-400 hover:text-blue-600"
                              title="Download"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setUploadTarget({ entityType: "vehicle", entityId: v.id, entityRef: v.registrationNumber ?? v.vehicleNumber, isRenewal: true })}
                              className="text-slate-400 hover:text-green-600"
                              title="Renew"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not uploaded</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {vehicles.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-400">No vehicles. Click &ldquo;Add Vehicle&rdquo; above.</div>
          )}
        </div>
      </div>

      {/* Drivers */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-900">Drivers ({drivers.length})</h2>
          </div>
          <button
            onClick={() => setAddingDriver(true)}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <Plus className="w-3.5 h-3.5" /> Add Driver
          </button>
        </div>

        {addingDriver && (
          <form onSubmit={handleAddDriver} className="p-4 border-b border-slate-100 bg-blue-50">
            <div className="mb-3">
              <label className="block text-xs font-medium text-slate-600 mb-1">Licence Holder's Name <span className="text-red-500">*</span></label>
              <input required placeholder="e.g. Kwabena Agyei" value={driverForm.fullName} onChange={(e) => setDriverForm((f) => ({ ...f, fullName: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            {driverError && <p className="text-xs text-red-600 mb-2">{driverError}</p>}
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">
                Save Driver{prices ? ` (GHC ${prices.newDriver.toFixed(2)} charged)` : ""}
              </button>
              <button type="button" onClick={() => { setAddingDriver(false); setDriverError(""); }} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancel</button>
            </div>
          </form>
        )}

        <div className="divide-y divide-slate-100">
          {drivers.map((d) => {
            const docs = (driverDocs[d.id] ?? []).filter((doc) => doc.version === 1);
            const dDocTypes = docTypes.filter((dt) => dt.appliesTo === "driver" || dt.appliesTo === "both");
            return (
              <div key={d.id} className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium text-slate-900">{d.fullName}</p>
                    <p className="text-xs text-slate-400">{d.driverNumber}</p>
                  </div>
                  <button
                    onClick={() => setUploadTarget({ entityType: "driver", entityId: d.id, entityRef: d.fullName, isRenewal: false })}
                    className="flex items-center gap-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded-lg"
                  >
                    <Plus className="w-3 h-3" /> Upload Doc
                  </button>
                </div>
                <div className="space-y-1.5">
                  {dDocTypes.map((dt) => {
                    const doc = docs.find((doc) => doc.documentTypeSlug === dt.slug);
                    return (
                      <div key={dt.id} className="flex items-center justify-between text-xs py-1.5 px-3 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-slate-700 font-medium">{dt.name}</span>
                        </div>
                        {doc ? (
                          <div className="flex items-center gap-2">
                            <ExpiryDateBadge expiryDate={doc.expiryDate} />
                            <button onClick={() => openDocEdit(doc)} className="text-slate-400 hover:text-blue-600" title="Edit details"><Pencil className="w-3.5 h-3.5" /></button>
                            <button onClick={() => downloadDoc(doc.fileKey)} className="text-slate-400 hover:text-blue-600"><Download className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setUploadTarget({ entityType: "driver", entityId: d.id, entityRef: d.fullName, isRenewal: true })} className="text-slate-400 hover:text-green-600"><RefreshCw className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not uploaded</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {drivers.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-400">No drivers registered.</div>
          )}
        </div>
      </div>

      {/* Modals */}
      {uploadTarget && (
        <DocumentUploadModal
          {...uploadTarget}
          customerId={customer.id}
          documentTypes={docTypes.filter((dt) =>
            dt.appliesTo === uploadTarget.entityType || dt.appliesTo === "both"
          )}
          onClose={() => setUploadTarget(null)}
          onSuccess={() => { setUploadTarget(null); loadProfile(); }}
        />
      )}

      {showPayment && (
        <PaymentRecordModal
          customerId={customer.id}
          customerName={customer.name}
          outstanding={balance.outstanding}
          onClose={() => setShowPayment(false)}
          onSuccess={() => { setShowPayment(false); loadProfile(); }}
        />
      )}

      {/* Customer Edit Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Edit Customer Details</h2>
              <button onClick={() => setEditingCustomer(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveCustomerEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                  <input required value={editCForm.name} onChange={(e) => setEditCForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone *</label>
                  <input required value={editCForm.tel} onChange={(e) => setEditCForm((f) => ({ ...f, tel: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input type="email" value={editCForm.email} onChange={(e) => setEditCForm((f) => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Customer Type</label>
                  <select value={editCForm.customerType} onChange={(e) => setEditCForm((f) => ({ ...f, customerType: e.target.value as "INDIVIDUAL" | "AGENCY" }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm">
                    <option value="INDIVIDUAL">Individual</option>
                    <option value="AGENCY">Agency</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Location / Address</label>
                  <input value={editCForm.location} onChange={(e) => setEditCForm((f) => ({ ...f, location: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                  <select
                    value={editCForm.cityId}
                    onChange={(e) => {
                      fetch("/api/admin/cities?withSuburbs=true").then((r) => r.json()).then((rows) => onEditCityChange(e.target.value, rows));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="">— No city —</option>
                    {editCities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Suburb</label>
                  <select value={editCForm.suburbId} onChange={(e) => setEditCForm((f) => ({ ...f, suburbId: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" disabled={!editCForm.cityId}>
                    <option value="">— No suburb —</option>
                    {editSuburbs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingCustomer(false)} className="flex-1 border border-slate-300 rounded-lg text-sm py-2 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={savingCustomer} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm py-2 font-medium">{savingCustomer ? "Saving..." : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Edit Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Edit Document</h2>
                <p className="text-xs text-slate-500 mt-0.5">{editingDoc.documentTypeName}</p>
              </div>
              <button onClick={() => setEditingDoc(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveDocEdit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Document Number</label>
                  <input value={editDForm.documentNumber} onChange={(e) => setEditDForm((f) => ({ ...f, documentNumber: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. POL-2024-001" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Place of Issue</label>
                  <input value={editDForm.placeOfIssue} onChange={(e) => setEditDForm((f) => ({ ...f, placeOfIssue: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="e.g. Accra DVLA" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Issue Date</label>
                  <input type="date" value={editDForm.issueDate} onChange={(e) => setEditDForm((f) => ({ ...f, issueDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date</label>
                  <input type="date" value={editDForm.expiryDate} onChange={(e) => setEditDForm((f) => ({ ...f, expiryDate: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-slate-700">Renewal Date(s)</label>
                  <button type="button" onClick={() => setEditDForm((f) => ({ ...f, renewalDates: [...f.renewalDates, ""] }))} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Add date
                  </button>
                </div>
                <div className="space-y-2">
                  {editDForm.renewalDates.map((rd, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="date" value={rd} onChange={(e) => setEditDForm((f) => ({ ...f, renewalDates: f.renewalDates.map((d, idx) => idx === i ? e.target.value : d) }))} className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                      <button type="button" onClick={() => setEditDForm((f) => ({ ...f, renewalDates: f.renewalDates.filter((_, idx) => idx !== i) }))} className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                <textarea value={editDForm.notes} onChange={(e) => setEditDForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none" placeholder="Any additional notes..." />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingDoc(null)} className="flex-1 border border-slate-300 rounded-lg text-sm py-2 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={savingDoc} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm py-2 font-medium">{savingDoc ? "Saving..." : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
