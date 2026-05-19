"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Car, User, FileText, CreditCard, Download, RefreshCw } from "lucide-react";
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
  fileName: string;
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
  const [driverForm, setDriverForm] = useState({ fullName: "", tel: "", dateOfBirth: "" });

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

  useEffect(() => { loadProfile(); }, [id]);

  async function handleAddVehicle(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: id, ...vehicleForm, year: vehicleForm.year ? parseInt(vehicleForm.year) : undefined }),
    });
    if (res.ok) { setAddingVehicle(false); loadProfile(); }
  }

  async function handleAddDriver(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: id, ...driverForm }),
    });
    if (res.ok) { setAddingDriver(false); loadProfile(); }
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

  if (loading || !profile) {
    return <div className="animate-pulse space-y-4"><div className="h-8 w-48 bg-slate-200 rounded" /><div className="h-40 bg-slate-200 rounded-xl" /></div>;
  }

  const { customer, vehicles, drivers, balance } = profile;

  return (
    <div className="space-y-6 max-w-4xl">
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
        <button
          onClick={() => setShowPayment(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium"
        >
          <CreditCard className="w-4 h-4" /> Record Payment
        </button>
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
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Save Vehicle (GHC 50 charged)</button>
              <button type="button" onClick={() => setAddingVehicle(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancel</button>
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
                            <button
                              onClick={() => downloadDoc(doc.fileName)}
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
            <div className="grid grid-cols-3 gap-3 mb-3">
              <input required placeholder="Full Name *" value={driverForm.fullName} onChange={(e) => setDriverForm((f) => ({ ...f, fullName: e.target.value }))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <input placeholder="Phone" value={driverForm.tel} onChange={(e) => setDriverForm((f) => ({ ...f, tel: e.target.value }))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              <input type="date" placeholder="Date of Birth" value={driverForm.dateOfBirth} onChange={(e) => setDriverForm((f) => ({ ...f, dateOfBirth: e.target.value }))} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium">Save Driver (GHC 15 charged)</button>
              <button type="button" onClick={() => setAddingDriver(false)} className="px-4 py-2 border border-slate-300 rounded-lg text-sm">Cancel</button>
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
                    <p className="text-xs text-slate-400">{d.tel} · {d.driverNumber}</p>
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
                            <button onClick={() => downloadDoc(doc.fileName)} className="text-slate-400 hover:text-blue-600"><Download className="w-3.5 h-3.5" /></button>
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
    </div>
  );
}
