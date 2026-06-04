"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Hub() {
  const router = useRouter();
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleFinanceSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(false);
    const res = await fetch("/api/verify-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "finance", code }),
    });
    setSubmitting(false);
    if (res.ok) {
      router.push("/finance");
    } else {
      setError(true);
      setCode("");
    }
  }

  return (
    <div className="min-h-screen bg-[#FDFCFB] font-jakarta flex flex-col">
      {/* Top bar */}
      <header className="w-full bg-white border-b border-[#EDE9E6]" style={{ padding: "13px 24px" }}>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/change-brandmark-red.png" alt="Change.org" style={{ height: 28, width: "auto" }} />
          <span className="text-[#D5CFCC] text-sm select-none">|</span>
          <span className="text-[#A09A96] text-[13px]">Finance · AP Hub</span>
        </div>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center px-6" style={{ paddingBottom: 80 }}>
        {!showCodeEntry ? (
          <>
            {/* Hero */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center mb-5" style={{
                background: "#FDF0EF", color: "#C94040",
                borderRadius: 100, padding: "4px 14px", fontSize: 11.5, fontWeight: 600,
              }}>
                Change.org · Accounts Payable
              </div>
              <h1 style={{ fontSize: 44, fontWeight: 800, color: "#1A1614", lineHeight: 1.1, marginBottom: 12 }}>
                AP Hub
              </h1>
              <p style={{ fontSize: 16, color: "#9A9490", maxWidth: 380 }}>
                Your one-stop for invoice status, payment tracking, and AP workflow.
              </p>
            </div>

            {/* Two cards */}
            <div style={{ display: "flex", gap: 20, width: "100%", maxWidth: 680 }}>
              {/* Employee card */}
              <button
                onClick={() => router.push("/search")}
                style={{
                  flex: 1, background: "white", border: "1.5px solid #EDE9E6",
                  borderRadius: 20, padding: "32px 28px", textAlign: "left",
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "box-shadow 0.2s, border-color 0.2s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.08)";
                  (e.currentTarget as HTMLElement).style.borderColor = "#D0CAC7";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLElement).style.borderColor = "#EDE9E6";
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 14, background: "#FDF0EF",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 16, fontSize: 22,
                }}>
                  🔍
                </div>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#1A1614", marginBottom: 6 }}>
                  Invoice Status
                </p>
                <p style={{ fontSize: 13.5, color: "#9A9490", lineHeight: 1.5 }}>
                  Look up any invoice — check if it's paid, who's approving it, and view the document.
                </p>
                <div style={{
                  marginTop: 20, display: "inline-flex", alignItems: "center", gap: 6,
                  color: "#E8251A", fontSize: 13, fontWeight: 600,
                }}>
                  Open <span>→</span>
                </div>
              </button>

              {/* Finance card */}
              <button
                onClick={() => setShowCodeEntry(true)}
                style={{
                  flex: 1, background: "white", border: "1.5px solid #EDE9E6",
                  borderRadius: 20, padding: "32px 28px", textAlign: "left",
                  cursor: "pointer", fontFamily: "inherit",
                  transition: "box-shadow 0.2s, border-color 0.2s",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(0,0,0,0.08)";
                  (e.currentTarget as HTMLElement).style.borderColor = "#D0CAC7";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLElement).style.borderColor = "#EDE9E6";
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 14, background: "#FDF0EF",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 16, fontSize: 22,
                }}>
                  📊
                </div>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#1A1614", marginBottom: 6 }}>
                  Finance Dashboard
                </p>
                <p style={{ fontSize: 13.5, color: "#9A9490", lineHeight: 1.5 }}>
                  AP pipeline, approver bottlenecks, cash forecasting, and expense reports. Finance team only.
                </p>
                <div style={{
                  marginTop: 20, display: "inline-flex", alignItems: "center", gap: 6,
                  color: "#E8251A", fontSize: 13, fontWeight: 600,
                }}>
                  Finance access →
                </div>
              </button>
            </div>
          </>
        ) : (
          /* Passcode entry */
          <div style={{
            background: "white", border: "1.5px solid #EDE9E6", borderRadius: 24,
            padding: "40px 36px", width: "100%", maxWidth: 400, textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔐</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1A1614", marginBottom: 6 }}>
              Finance access
            </h2>
            <p style={{ fontSize: 13.5, color: "#9A9490", marginBottom: 24 }}>
              Enter the finance team access code to continue.
            </p>
            <form onSubmit={handleFinanceSubmit}>
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
                <p style={{ fontSize: 12.5, color: "#E8251A", marginBottom: 12 }}>
                  Incorrect code. Try again.
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: "100%", background: "#E8251A", color: "white",
                  border: "none", borderRadius: 12, padding: "13px",
                  fontSize: 15, fontWeight: 600, cursor: "pointer",
                  fontFamily: "inherit", marginTop: error ? 0 : 8,
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Verifying…" : "Continue"}
              </button>
              <button
                type="button"
                onClick={() => { setShowCodeEntry(false); setCode(""); setError(false); }}
                style={{
                  width: "100%", background: "transparent", border: "none",
                  color: "#A09A96", fontSize: 13, cursor: "pointer",
                  fontFamily: "inherit", marginTop: 12, padding: "4px",
                }}
              >
                ← Back
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
