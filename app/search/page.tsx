"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { InvoiceRow, PaymentStatus } from "@/lib/coupa";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

// ─── Status pills ─────────────────────────────────────────────────────────────

function invoiceStatusPill(status: PaymentStatus) {
  if (status === "pending_approval")
    return { label: "Pending Approval", bg: "#FFF3E0", color: "#C15F00" };
  if (status === "rejected")
    return { label: "Rejected", bg: "#FFEBEE", color: "#C62828" };
  if (status === "voided")
    return { label: "Voided", bg: "#F5F5F5", color: "#757575" };
  return { label: "Fully Approved", bg: "#EDE9FF", color: "#5B21B6" };
}

function paymentStatusPill(inv: InvoiceRow) {
  if (inv.paidAt) return { label: "Fully Paid", bg: "#E8F5E9", color: "#2E7D32" };
  if (inv.status === "payment_pending") return { label: "Payment in Progress", bg: "#FFF3E0", color: "#C15F00" };
  if (inv.status === "approved" || inv.status === "paid") return { label: "Ready to Pay", bg: "#EDE9FF", color: "#5B21B6" };
  return null;
}

function Pill({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}

// ─── Document icon ────────────────────────────────────────────────────────────

function DocThumb() {
  return (
    <div
      className="shrink-0 flex items-center justify-center rounded-[10px]"
      style={{
        width: 42, height: 52,
        background: "linear-gradient(145deg, #FFF0EF 0%, #FFD9D7 100%)",
      }}
    >
      <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
        <path d="M3 0h10l7 7v17H3V0z" fill="white" stroke="#E8251A" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M13 0v7h7" stroke="#E8251A" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M6 11h8M6 14.5h8M6 18h5" stroke="#E8251A" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

function Drawer({ inv, onClose }: { inv: InvoiceRow; onClose: () => void }) {
  const [detail, setDetail] = useState<InvoiceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [imageScanOk, setImageScanOk] = useState<boolean | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch(`/api/invoice?id=${inv.id}`);
        const raw = await r.json();

        const paidAt = raw["payment-date"] ?? null;
        const payments: any[] = raw.payments ?? [];
        const firstPayment = payments[0];
        const paymentNumber =
          firstPayment?.["payment-number"] ??
          firstPayment?.notes ??
          (firstPayment ? `Payment #${firstPayment.id}` : null);

        const attachments = (raw.attachments ?? []).map((a: any) => ({
          id: a.id,
          filename: (a["file"] ?? "").split("/").pop() || a["file-name"] || a.intent || "attachment",
          type: a.type ?? "file",
          url: a["file-url"] ?? a.url ?? null,
        }));

        const scanPath = raw["image-scan"] ?? inv.imageScanPath ?? null;

        if (scanPath) {
          const scanSrc = `/api/imagescan?path=${encodeURIComponent(scanPath)}`;
          const check = await fetch(scanSrc, { method: "HEAD" }).catch(() => null);
          setImageScanOk(check?.ok ?? false);
        }

        setDetail({
          ...inv,
          paidAt,
          attachments,
          imageScanPath: scanPath,
          payment: { ...inv.payment, paymentNumber },
        });
      } catch {
        setDetail(inv);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [inv.id]);

  const invStatus = invoiceStatusPill(inv.status);
  const pymtStatus = paymentStatusPill(detail ?? inv);
  const shownInv = detail ?? inv;

  const pdfs = shownInv.attachments.filter(a =>
    a.filename.toLowerCase().endsWith(".pdf") || a.filename.toLowerCase().endsWith(".eml")
  );
  const mainPdf = pdfs.find(a => !a.filename.toLowerCase().endsWith(".eml")) ?? pdfs[0];
  const imageScanSrc = shownInv.imageScanPath
    ? `/api/imagescan?path=${encodeURIComponent(shownInv.imageScanPath)}`
    : null;

  return (
    <>
      {/* Drawer panel — sits in the flex row, no backdrop */}
      <div className="fixed right-0 top-0 h-full w-[520px] bg-white z-50 border-l border-[#EDE9E6] shadow-[-8px_0_32px_rgba(0,0,0,0.06)] flex flex-col overflow-hidden animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE9E6]">
          <div>
            <p className="text-[13px] text-[#A09A96]">Invoice Details</p>
            <p className="text-[16px] font-bold text-gray-900 mt-0.5">{shownInv.supplier}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#F5F3F1] hover:bg-[#EDE9E6] text-[#6A6360] transition-colors text-lg"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Key details */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Invoice #", value: shownInv.invoiceNumber },
              { label: "Amount", value: money(shownInv.amount, shownInv.currency) },
              { label: "Submitted", value: fmt(shownInv.submittedAt) },
              { label: "Due Date", value: fmt(shownInv.dueAt) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white border border-[#EDE9E6] rounded-xl p-3">
                <p className="text-[11px] text-[#A09A96] uppercase tracking-wide font-semibold">{label}</p>
                <p className="text-[14px] font-semibold text-gray-900 mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Status row */}
          <div className="bg-white border border-[#EDE9E6] rounded-xl p-4 flex items-center gap-6">
            <div>
              <p className="text-[11px] text-[#A09A96] uppercase tracking-wide font-semibold mb-1.5">Invoice Status</p>
              <Pill {...invStatus} />
            </div>
            <div className="w-px h-8 bg-[#EDE9E6]" />
            <div>
              <p className="text-[11px] text-[#A09A96] uppercase tracking-wide font-semibold mb-1.5">Payment Status</p>
              {pymtStatus ? <Pill {...pymtStatus} /> : <span className="text-[#A09A96] text-xs">Awaiting approval</span>}
            </div>
            {inv.nextApprover && (
              <>
                <div className="w-px h-8 bg-[#EDE9E6]" />
                <div>
                  <p className="text-[11px] text-[#A09A96] uppercase tracking-wide font-semibold mb-1">Waiting on</p>
                  <p className="text-[13px] font-medium text-gray-800">{inv.nextApprover}</p>
                </div>
              </>
            )}
          </div>

          {/* Payment reference */}
          {(shownInv.payment.paymentNumber || shownInv.paidAt) && (
            <div className="bg-white border border-[#EDE9E6] rounded-xl p-4 grid grid-cols-2 gap-4">
              {shownInv.payment.paymentNumber && (
                <div>
                  <p className="text-[11px] text-[#A09A96] uppercase tracking-wide font-semibold mb-0.5">Payment Reference</p>
                  <p className="text-[13px] font-semibold text-gray-900 font-mono">{shownInv.payment.paymentNumber}</p>
                </div>
              )}
              {shownInv.paidAt && (
                <div>
                  <p className="text-[11px] text-[#A09A96] uppercase tracking-wide font-semibold mb-0.5">Paid On</p>
                  <p className="text-[13px] font-semibold text-gray-900">{fmt(shownInv.paidAt)}</p>
                </div>
              )}
            </div>
          )}

          {/* Invoice document */}
          {loading && (
            <div className="h-32 flex items-center justify-center text-[#A09A96] text-sm">Loading document…</div>
          )}
          {!loading && (mainPdf || imageScanSrc) && (
            <div>
              <p className="text-[11px] text-[#A09A96] uppercase tracking-wide font-semibold mb-2">Invoice Document</p>
              <div className="border border-[#EDE9E6] rounded-xl overflow-hidden">
                {mainPdf ? (
                  mainPdf.filename.endsWith(".pdf") ? (
                    <iframe
                      src={`/api/attachment?invoiceId=${shownInv.id}&attachmentId=${mainPdf.id}`}
                      className="w-full h-[520px]"
                      title={mainPdf.filename}
                    />
                  ) : (
                    <div className="p-4 text-sm text-[#6A6360]">
                      <a href={`/api/attachment?invoiceId=${shownInv.id}&attachmentId=${mainPdf.id}`}
                        className="text-[#E8251A] underline" target="_blank" rel="noreferrer">
                        {mainPdf.filename}
                      </a>
                    </div>
                  )
                ) : imageScanSrc && imageScanOk ? (
                  <iframe src={imageScanSrc} className="w-full h-[520px]" title="Invoice scan" />
                ) : imageScanSrc && imageScanOk === false ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-10 px-6 text-center">
                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                      <rect width="36" height="36" rx="10" fill="#FDF0EF"/>
                      <path d="M13 10h7l6 6v10H10V10h3z" stroke="#E8251A" strokeWidth="1.5" strokeLinejoin="round" fill="white"/>
                      <path d="M20 10v6h6" stroke="#E8251A" strokeWidth="1.5" strokeLinejoin="round"/>
                      <path d="M18 20v-4M18 22.5v-1" stroke="#E8251A" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                    <p className="text-[13px] font-semibold text-[#1A1614]">Document preview unavailable</p>
                    <p className="text-[12px] text-[#A09A96] max-w-[260px]">
                      This invoice was uploaded as an Image Scan and cannot be displayed here.
                      Please open it directly in Coupa to view.
                    </p>
                  </div>
                ) : null}
              </div>
              {/* Extra attachments + image scan if not already shown as main */}
              <div className="mt-2 space-y-1">
                {shownInv.attachments.filter(a => a.id !== mainPdf?.id).map(a => (
                  <a key={a.id}
                    href={`/api/attachment?invoiceId=${shownInv.id}&attachmentId=${a.id}`}
                    target="_blank" rel="noreferrer"
                    className="block text-[12px] text-[#E8251A] hover:underline">
                    ↓ {a.filename}
                  </a>
                ))}
                {/* Show image scan as a secondary link if we already showed an attachment as main */}
                {mainPdf && imageScanSrc && (
                  <a href={imageScanSrc} target="_blank" rel="noreferrer"
                    className="block text-[12px] text-[#E8251A] hover:underline">
                    ↓ Image Scan (original)
                  </a>
                )}
              </div>
            </div>
          )}
          {!loading && !mainPdf && !imageScanSrc && (
            <p className="text-sm text-[#A09A96] text-center py-4">No document attached to this invoice.</p>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Restricted passcode gate ─────────────────────────────────────────────────

function RestrictedGate({ inv, onUnlock, onCancel }: {
  inv: InvoiceRow;
  onUnlock: () => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(false);
    const res = await fetch("/api/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "restricted", code }),
    });
    setSubmitting(false);
    if (res.ok) {
      onUnlock();
    } else {
      setError(true);
      setCode("");
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{
        background: "white", borderRadius: 24, padding: "36px 32px",
        width: "100%", maxWidth: 380, boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
        textAlign: "center",
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, background: "#FDF0EF",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 14px", fontSize: 24,
        }}>🔒</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1A1614", marginBottom: 6 }}>
          Restricted Invoice
        </h2>
        <p style={{ fontSize: 13, color: "#9A9490", marginBottom: 6, lineHeight: 1.5 }}>
          <strong style={{ color: "#1A1614" }}>{inv.supplier}</strong>
        </p>
        <p style={{ fontSize: 13, color: "#9A9490", marginBottom: 22, lineHeight: 1.5 }}>
          This invoice is restricted. Enter the access code provided by the Finance team to view it.
        </p>
        <form onSubmit={submit}>
          <input
            type="password"
            value={code}
            onChange={e => { setCode(e.target.value); setError(false); }}
            placeholder="Access code"
            autoFocus
            style={{
              width: "100%", border: `1.5px solid ${error ? "#E8251A" : "#EDE9E6"}`,
              borderRadius: 12, padding: "12px 16px", fontSize: 15,
              outline: "none", fontFamily: "inherit", marginBottom: 8,
              boxSizing: "border-box", background: error ? "#FFF8F7" : "white",
            }}
          />
          {error && (
            <p style={{ fontSize: 12, color: "#E8251A", marginBottom: 10 }}>
              Incorrect code. Contact the Finance team.
            </p>
          )}
          <button type="submit" disabled={submitting} style={{
            width: "100%", background: "#E8251A", color: "white",
            border: "none", borderRadius: 12, padding: "13px",
            fontSize: 15, fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit", marginTop: error ? 0 : 8,
            opacity: submitting ? 0.7 : 1,
          }}>
            {submitting ? "Verifying…" : "View Invoice"}
          </button>
          <button type="button" onClick={onCancel} style={{
            width: "100%", background: "none", border: "none",
            color: "#A09A96", fontSize: 13, cursor: "pointer",
            fontFamily: "inherit", marginTop: 10, padding: "4px",
          }}>
            Cancel
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Result row ───────────────────────────────────────────────────────────────

function ResultRow({ inv, onClick }: { inv: InvoiceRow; onClick: () => void }) {
  const pymtStatus = paymentStatusPill(inv);
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-[#EDE9E6] rounded-2xl px-[18px] py-[15px] flex items-center gap-4 hover:shadow-[0_4px_20px_rgba(0,0,0,0.07)] transition-shadow"
      style={{ borderRadius: 16, borderColor: inv.restricted ? "#F0DEDD" : undefined }}
    >
      <DocThumb />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[14px] font-bold text-gray-900 truncate">{inv.supplier}</p>
          {inv.restricted && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: "#C94040",
              background: "#FDF0EF", borderRadius: 100, padding: "1px 8px", whiteSpace: "nowrap",
            }}>
              🔒 Restricted
            </span>
          )}
        </div>
        <p className="text-[11.5px] text-[#B0AAA6] mt-0.5">
          {inv.invoiceNumber} · {fmt(inv.submittedAt)}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[15px] font-bold text-gray-900">{money(inv.amount, inv.currency)}</p>
        <div className="mt-1 flex justify-end">
          {pymtStatus
            ? <Pill {...pymtStatus} />
            : <Pill {...invoiceStatusPill(inv.status)} />}
        </div>
      </div>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<InvoiceRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<InvoiceRow | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [vendorChoices, setVendorChoices] = useState<string[] | null>(null);
  const [pendingRestricted, setPendingRestricted] = useState<InvoiceRow | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // ── Department (self-declare for now; swap for SSO token claim later) ──────
  const [department, setDepartment] = useState<string>("");
  const [deptList, setDeptList] = useState<string[]>([]);
  const [showDeptPicker, setShowDeptPicker] = useState(false);

  useEffect(() => {
    // Read sessionStorage only on client after mount to avoid hydration mismatch
    const saved = sessionStorage.getItem("ap_department") ?? "";
    setDepartment(saved);
    if (!saved) setShowDeptPicker(true);

    fetch("/api/departments").then(r => r.json()).then(setDeptList).catch(() => {});
  }, []);

  function chooseDept(d: string) {
    setDepartment(d);
    sessionStorage.setItem("ap_department", d);
    setShowDeptPicker(false);
  }

  // Fetch suggestions with debounce
  const fetchSuggestions = useCallback((val: string) => {
    if (suggestTimeout.current) clearTimeout(suggestTimeout.current);
    if (val.trim().length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    suggestTimeout.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(val.trim())}`);
        const data = await res.json();
        setSuggestions(data);
        setShowSuggestions(data.length > 0);
        setHighlightedIndex(-1);
      } catch {
        setSuggestions([]);
      }
    }, 280);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleQueryChange(val: string) {
    setQuery(val);
    fetchSuggestions(val);
  }

  function selectSuggestion(name: string) {
    setQuery(name);
    setSuggestions([]);
    setShowSuggestions(false);
    // Auto-search immediately
    setTimeout(() => runSearch(name), 0);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && highlightedIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[highlightedIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  }

  async function runSearch(q: string, skipDisambiguation = false) {
    if (!q.trim()) return;
    setShowSuggestions(false);
    setVendorChoices(null);

    // Check for multiple matching vendors first (unless already disambiguated)
    if (!skipDisambiguation) {
      const suggestRes = await fetch(`/api/suggest?q=${encodeURIComponent(q.trim())}`);
      const vendors: string[] = suggestRes.ok ? await suggestRes.json() : [];

      // If >1 vendor matches and the query isn't an exact match, ask user to pick
      const exactMatch = vendors.length === 1 ||
        vendors.some(v => v.toLowerCase() === q.trim().toLowerCase());

      if (vendors.length > 1 && !exactMatch) {
        setVendorChoices(vendors);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");
      setResults(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    runSearch(query);
  }

  return (
    <div
      className="min-h-screen bg-[#FDFCFB] font-jakarta"
      style={{
        paddingRight: selected ? 520 : 0,
        transition: "padding-right 0.3s cubic-bezier(0.32,0.72,0,1)",
      }}
    >
      {/* Department picker modal */}
      {showDeptPicker && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
          zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }}>
          <div style={{
            background: "white", borderRadius: 24, padding: "36px 32px",
            width: "100%", maxWidth: 420, boxShadow: "0 24px 64px rgba(0,0,0,0.15)",
          }}>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>👋</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1A1614", marginBottom: 6 }}>
                Which department are you in?
              </h2>
              {/* TODO: Replace this self-declare step with OneLogin SSO auto-detection */}
              <p style={{ fontSize: 13.5, color: "#9A9490", lineHeight: 1.5 }}>
                This helps show invoices relevant to your team. You can change it anytime.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
              {deptList.length === 0 ? (
                <p style={{ textAlign: "center", color: "#A09A96", fontSize: 13, padding: "16px 0" }}>Loading departments…</p>
              ) : (
                deptList.map(dept => (
                  <button
                    key={dept}
                    onClick={() => chooseDept(dept)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 16px", border: "1.5px solid #EDE9E6", borderRadius: 12,
                      background: "white", cursor: "pointer", fontFamily: "inherit",
                      fontSize: 14, fontWeight: 500, color: "#1A1614",
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = "#E8251A";
                      (e.currentTarget as HTMLElement).style.background = "#FFF8F7";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = "#EDE9E6";
                      (e.currentTarget as HTMLElement).style.background = "white";
                    }}
                  >
                    {dept}
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 4l4 4-4 4" stroke="#B0AAA6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                ))
              )}
            </div>

            <p style={{ fontSize: 12, color: "#B0AAA6", textAlign: "center", marginTop: 16 }}>
              Department selection is required to use this portal.
            </p>
          </div>
        </div>
      )}

      {/* Top bar */}
      <header className="w-full bg-white border-b border-[#EDE9E6]" style={{ padding: "13px 24px" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/change-brandmark-red.png" alt="Change.org" height={28} style={{ height: 28, width: "auto" }} />
            <span className="text-[#D5CFCC] text-sm select-none">|</span>
            <span className="text-[#A09A96] text-[13px]">Finance · Invoice Portal</span>
          </div>
          {/* Department badge + change button */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {department ? (
              <>
                <span style={{
                  background: "#FDF0EF", color: "#C94040", borderRadius: 100,
                  padding: "3px 10px", fontSize: 12, fontWeight: 600,
                }}>
                  {department}
                </span>
                <button
                  onClick={() => setShowDeptPicker(true)}
                  style={{ fontSize: 12, color: "#A09A96", background: "none", border: "none", cursor: "pointer" }}
                >
                  Change
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowDeptPicker(true)}
                style={{
                  fontSize: 12, color: "#E8251A", background: "#FDF0EF",
                  border: "none", borderRadius: 100, padding: "4px 12px",
                  cursor: "pointer", fontWeight: 600,
                }}
              >
                Select your department
              </button>
            )}
            <span style={{ color: "#EDE9E6", fontSize: 16 }}>|</span>
            <button
              onClick={() => router.push("/")}
              style={{ fontSize: 12, color: "#A09A96", background: "none", border: "none", cursor: "pointer" }}
            >
              ← Hub
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="mx-auto" style={{ maxWidth: 620, paddingTop: 64, paddingLeft: 20, paddingRight: 20 }}>
        <div className="text-center mb-8">
          {/* Pill tag */}
          <div className="inline-flex items-center mb-4" style={{
            background: "#FDF0EF", color: "#C94040",
            borderRadius: 100, padding: "4px 12px", fontSize: 11.5, fontWeight: 600,
          }}>
            Employee Self-Service
          </div>

          {/* H1 */}
          <h1 style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.15, color: "#1A1614", marginBottom: 12 }}>
            Look up any{" "}
            <span style={{ color: "#E8251A" }}>invoice</span>
            , anytime.
          </h1>

          {/* Subtext */}
          <p style={{ fontSize: 15, color: "#9A9490", marginBottom: 28 }}>
            Search by vendor, invoice number, date, or amount.
          </p>
        </div>

        {/* Search bar with autocomplete */}
        <form onSubmit={handleSearch}>
          <div ref={wrapperRef} style={{ position: "relative" }}>
            <div style={{
              display: "flex", alignItems: "center",
              border: "2px solid #E8251A", borderRadius: showSuggestions ? "20px 20px 0 0" : 100,
              background: "white", boxShadow: "0 4px 28px rgba(232,37,26,0.10)",
              padding: "6px 6px 6px 22px",
              transition: "border-radius 0.15s",
            }}>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="e.g. Salesforce, INV-2026-04821, $12,400…"
                style={{
                  flex: 1, border: "none", outline: "none", background: "transparent",
                  fontSize: 14, color: "#1A1614", fontFamily: "inherit",
                }}
              />
              <button
                type="submit"
                disabled={!query.trim() || loading}
                style={{
                  background: query.trim() ? "#E8251A" : "#F0DEDD",
                  color: "white", border: "none", borderRadius: 100,
                  padding: "10px 24px", fontSize: 14, fontWeight: 600,
                  cursor: query.trim() ? "pointer" : "default",
                  fontFamily: "inherit", transition: "background 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {loading ? "Searching…" : "Search"}
              </button>
            </div>

            {/* Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0,
                background: "white",
                border: "2px solid #E8251A", borderTop: "1px solid #F0DEDD",
                borderRadius: "0 0 20px 20px",
                boxShadow: "0 8px 28px rgba(232,37,26,0.10)",
                zIndex: 50, overflow: "hidden",
              }}>
                {suggestions.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectSuggestion(name); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      width: "100%", textAlign: "left",
                      padding: "10px 22px",
                      background: highlightedIndex === i ? "#FDF0EF" : "transparent",
                      border: "none", cursor: "pointer",
                      fontSize: 14, color: "#1A1614", fontFamily: "inherit",
                      borderBottom: i < suggestions.length - 1 ? "1px solid #F5F0EE" : "none",
                    }}
                    onMouseEnter={() => setHighlightedIndex(i)}
                    onMouseLeave={() => setHighlightedIndex(-1)}
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
                      <circle cx="6" cy="6" r="4.5" stroke="#6A6360" strokeWidth="1.5" />
                      <path d="M10 10l2.5 2.5" stroke="#6A6360" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Results / welcome area */}
        <div className="mt-6 pb-16">
          {/* Error */}
          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 mb-4">
              {error}
            </div>
          )}

          {/* Vendor disambiguation */}
          {vendorChoices && !loading && (
            <div>
              <p style={{ fontSize: 12, color: "#A09A96", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, fontWeight: 600 }}>
                Multiple vendors match "{query}" — which one?
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {vendorChoices.map((name) => (
                  <button
                    key={name}
                    onClick={() => { setQuery(name); runSearch(name, true); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      background: "white", border: "1.5px solid #EDE9E6", borderRadius: 16,
                      padding: "14px 18px", cursor: "pointer", textAlign: "left",
                      fontFamily: "inherit", transition: "box-shadow 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.07)")}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: "#FDF0EF", display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="6" r="3" stroke="#E8251A" strokeWidth="1.4"/>
                          <path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="#E8251A" strokeWidth="1.4" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1614" }}>{name}</span>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 4l4 4-4 4" stroke="#B0AAA6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Welcome card — shown before first search */}
          {results === null && !loading && !error && !vendorChoices && (
            <div style={{
              background: "#FFF8F7", border: "1.5px solid #F0DEDD",
              borderRadius: 20, padding: "28px 32px",
            }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#1A1614", marginBottom: 16 }}>
                👋 Welcome to the Invoice Portal
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[
                  { icon: "🔍", text: "Search by vendor name, invoice number, or keyword" },
                  { icon: "🏷️", text: "Use the quick filters to narrow by status or time period" },
                  { icon: "📄", text: "Click any result to view the full invoice image" },
                ].map(({ icon, text }) => (
                  <div key={text} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8,
                      background: "white", border: "1px solid #F0DEDD",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 14, flexShrink: 0,
                    }}>
                      {icon}
                    </div>
                    <span style={{ fontSize: 13.5, color: "#6A6360" }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && !vendorChoices && (
            <div className="text-center py-16 text-[#A09A96] text-sm">Searching…</div>
          )}

          {/* No results */}
          {results !== null && results.length === 0 && (
            <p className="text-center text-[#A09A96] text-sm py-12">No invoices found for "{query}".</p>
          )}

          {/* Results — filtered by department if one is selected */}
          {results && results.length > 0 && (() => {
            const filtered = department
              ? results.filter(inv =>
                  inv.departments.length === 0 || // show if no dept info available
                  inv.departments.some(d => d.toLowerCase().includes(department.toLowerCase()))
                )
              : results;
            return (
              <>
                <p style={{ fontSize: 12, color: "#A09A96", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12, fontWeight: 600 }}>
                  {filtered.length} result{filtered.length !== 1 ? "s" : ""} for "{query}"
                  {department && <span> in department <span style={{ color: "#E8251A" }}>{department}</span></span>}
                </p>
                {filtered.length === 0 && (
                  <p className="text-center text-[#A09A96] text-sm py-8">
                    No invoices found for "{query}"{department ? ` in ${department}` : ""}. Try a different search term.
                  </p>
                )}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {filtered.map((inv) => (
                    <ResultRow
                      key={inv.id}
                      inv={inv}
                      onClick={() => inv.restricted ? setPendingRestricted(inv) : setSelected(inv)}
                    />
                  ))}
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Restricted gate — shown before opening a restricted invoice */}
      {pendingRestricted && (
        <RestrictedGate
          inv={pendingRestricted}
          onUnlock={() => { setSelected(pendingRestricted); setPendingRestricted(null); }}
          onCancel={() => setPendingRestricted(null)}
        />
      )}

      {/* Drawer */}
      {selected && <Drawer inv={selected} onClose={() => setSelected(null)} />}

      <style jsx global>{`
        @keyframes slide-in {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.25s cubic-bezier(0.32, 0.72, 0, 1);
        }
      `}</style>
    </div>
  );
}
