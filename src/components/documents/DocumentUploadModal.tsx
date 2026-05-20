"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, FileText, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface DocumentType {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  entityType: "vehicle" | "driver";
  entityId: string;
  customerId: string;
  entityRef: string;
  documentTypes: DocumentType[];
  onClose: () => void;
  onSuccess: () => void;
  isRenewal?: boolean;
}

export function DocumentUploadModal({
  entityType,
  entityId,
  customerId,
  entityRef,
  documentTypes,
  onClose,
  onSuccess,
  isRenewal = false,
}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [selectedDocType, setSelectedDocType] = useState(documentTypes[0]?.id ?? "");
  const [documentNumber, setDocumentNumber] = useState("");
  const [placeOfIssue, setPlaceOfIssue] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [renewalDates, setRenewalDates] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "application/pdf": [".pdf"],
      "image/*": [".jpg", ".jpeg", ".png", ".webp"],
    },
    maxSize: 20 * 1024 * 1024, // 20 MB
  });

  function addRenewalDate() {
    setRenewalDates((prev) => [...prev, ""]);
  }

  function updateRenewalDate(i: number, v: string) {
    setRenewalDates((prev) => prev.map((d, idx) => (idx === i ? v : d)));
  }

  function removeRenewalDate(i: number) {
    setRenewalDates((prev) => prev.filter((_, idx) => idx !== i));
  }

  const selectedSlug = documentTypes.find((d) => d.id === selectedDocType)?.slug ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !selectedDocType) return;

    const today = new Date().toISOString().slice(0, 10);

    if (expiryDate) {
      if (issueDate && expiryDate < issueDate) {
        setError("Expiry date cannot be before the issue date.");
        return;
      }
      if (expiryDate < today) {
        setError("Expiry date cannot be in the past.");
        return;
      }
    }

    for (const rd of renewalDates.filter(Boolean)) {
      if (issueDate && rd < issueDate) {
        setError("Renewal dates cannot be before the issue date.");
        return;
      }
      if (rd < today) {
        setError("Renewal dates cannot be in the past.");
        return;
      }
    }

    setUploading(true);
    setError("");

    try {
      // 1. Get presigned upload URL
      const urlRes = await fetch("/api/storage/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId,
          customerId,
          docTypeSlug: selectedSlug,
          mimeType: file.type,
        }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadUrl, fileKey } = await urlRes.json();

      // 2. Upload directly to R2
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) throw new Error("File upload failed");

      // 3. Save document record
      const docRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentTypeId: selectedDocType,
          vehicleId: entityType === "vehicle" ? entityId : undefined,
          driverId: entityType === "driver" ? entityId : undefined,
          documentNumber: documentNumber || undefined,
          placeOfIssue: placeOfIssue || undefined,
          issueDate: issueDate || undefined,
          expiryDate: expiryDate || undefined,
          renewalDates: renewalDates.filter(Boolean),
          entityRef,
          fileKey,
          fileName: file.name,
          fileSizeBytes: file.size,
          mimeType: file.type,
          notes: notes || undefined,
          isRenewal,
        }),
      });
      if (!docRes.ok) {
        const errData = await docRes.json().catch(() => ({}));
        throw new Error(typeof errData.error === "string" ? errData.error : "Failed to save document");
      }

      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {isRenewal ? "Upload Renewal Document" : "Upload Document"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">{entityRef}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Document type selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Document Type <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              {documentTypes.map((dt) => (
                <option key={dt.id} value={dt.id}>
                  {dt.name}
                </option>
              ))}
            </select>
          </div>

          {/* File drop zone */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Document File <span className="text-red-500">*</span>
            </label>
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                isDragActive
                  ? "border-blue-400 bg-blue-50"
                  : file
                  ? "border-green-400 bg-green-50"
                  : "border-slate-300 hover:border-slate-400"
              )}
            >
              <input {...getInputProps()} />
              {file ? (
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <FileText className="w-5 h-5" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-green-500">
                    ({(file.size / 1024).toFixed(0)} KB)
                  </span>
                </div>
              ) : (
                <div className="text-slate-400">
                  <Upload className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">Drop file here or click to browse</p>
                  <p className="text-xs mt-1">PDF, JPG, PNG up to 20 MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Key fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Document Number
              </label>
              <input
                type="text"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. POL-2024-001"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Place of Issue
              </label>
              <input
                type="text"
                value={placeOfIssue}
                onChange={(e) => setPlaceOfIssue(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Accra DVLA"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Issue Date
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Expiry Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Expiry date highlight */}
          {expiryDate && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-center">
              <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Expiry Date</p>
              <p className="text-2xl font-bold text-amber-800 mt-0.5">
                {new Date(expiryDate).toLocaleDateString("en-GH", {
                  day: "2-digit", month: "short", year: "numeric",
                })}
              </p>
            </div>
          )}

          {/* Renewal dates */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700">
                Renewal Date(s) <span className="text-xs text-slate-400">(optional)</span>
              </label>
              <button
                type="button"
                onClick={addRenewalDate}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add date
              </button>
            </div>
            <div className="space-y-2">
              {renewalDates.map((rd, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="date"
                    value={rd}
                    onChange={(e) => updateRenewalDate(i, e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeRenewalDate(i)}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Any additional notes..."
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {uploading ? "Uploading..." : isRenewal ? "Upload Renewal" : "Upload Document"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
