"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { FinanceDashboardData, SlimInvoice, SlimExpenseReport } from "@/lib/finance";

// ─── Design tokens — matches the Invoice Status portal aesthetic ─────────────

const BASE_VARS: Record<string, string> = {
  "--bg-main": "#FDFCFB",
  "--bg-card": "#FFFFFF",
  "--bg-sidebar": "#FFFFFF",
  "--bg-sidebar-hover": "#FDF0EF",
  "--bg-sidebar-active": "#FDF0EF",
  "--sidebar-text": "#1A1614",
  "--sidebar-muted": "#A09A96",
  "--sidebar-section": "#B0AAA6",
  "--sidebar-active-border": "#E8251A",
  "--text-primary": "#1A1614",
  "--text-secondary": "#3D3330",
  "--text-muted": "#9A9490",
  "--accent-primary": "#E8251A",
  "--accent-danger": "#E8251A",
  "--accent-warn": "#D97706",
  "--accent-success": "#16A34A",
  "--border": "#EDE9E6",
  "--border-strong": "#D5CFCC",
  "--kanban-col-bg": "#F7F4F2",
  "--kanban-card-bg": "#FFFFFF",
  "--kanban-aged-bg": "#FFFBEB",
  "--kanban-aged-border": "#F59E0B",
  "--kanban-overdue-bg": "#FFF8F7",
  "--kanban-overdue-border": "#E8251A",
};

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
}
function ago(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Small components ─────────────────────────────────────────────────────────

function EntityPill({ entity }: { entity: string }) {
  const colors: Record<string, string> = {
    PBC: "background:#EEF2FF;color:#3730A3", UK: "background:#ECFDF5;color:#065F46",
    Foundation: "background:#FFF7ED;color:#C2410C", Australia: "background:#F0F9FF;color:#0369A1",
    Canada: "background:#FDF4FF;color:#7E22CE", Spain: "background:#FFF1F2;color:#BE123C",
  };
  const style = colors[entity] ?? "background:#F3F4F6;color:#374151";
  return (
    <span style={{ ...Object.fromEntries(style.split(";").map(s => s.split(":") as [string,string])), borderRadius: 6, padding: "1px 6px", fontSize: 11, fontWeight: 600 } as any}>
      {entity}
    </span>
  );
}

function NavBadge({ count, danger }: { count: number; danger?: boolean }) {
  if (!count) return null;
  return (
    <span style={{
      marginLeft: "auto", minWidth: 20, textAlign: "center",
      background: danger ? "var(--accent-danger)" : "rgba(255,255,255,0.15)",
      color: danger ? "white" : "var(--sidebar-muted)",
      borderRadius: 10, padding: "1px 6px", fontSize: 11, fontWeight: 700,
    }}>
      {count}
    </span>
  );
}

// ─── Invoice Table ────────────────────────────────────────────────────────────

function InvoiceTable({ invs, showBatch = false }: { invs: SlimInvoice[]; showBatch?: boolean }) {
  const [q, setQ] = useState("");
  const filtered = q
    ? invs.filter(i =>
        i.supplier.toLowerCase().includes(q.toLowerCase()) ||
        i.invoiceNumber.toLowerCase().includes(q.toLowerCase()) ||
        i.departments.some(d => d.toLowerCase().includes(q.toLowerCase()))
      )
    : invs;

  const totals = filtered.reduce((acc, i) => {
    acc[i.currency] = (acc[i.currency] ?? 0) + i.amount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <input
          value={q} onChange={e => setQ(e.target.value)}
          placeholder="Filter by supplier, invoice #, or department…"
          style={{
            flex: 1, minWidth: 200, border: "1px solid var(--border)", borderRadius: 8,
            padding: "7px 12px", fontSize: 13, background: "var(--bg-card)", color: "var(--text-primary)", outline: "none",
          }}
        />
        {Object.entries(totals).map(([cur, total]) => (
          <span key={cur} style={{
            background: "var(--bg-main)", border: "1px solid var(--border)",
            borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)",
          }}>
            {cur}: {new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(total)}
          </span>
        ))}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Invoice #", "Supplier", "Department", "Entity", "Amount", "Inv Date", "Due Date", "Age", showBatch ? "Batch #" : null, "Approver", ""].filter(Boolean).map(h => (
                <th key={h!} style={{ padding: "8px 10px", textAlign: h === "Amount" ? "right" : "left", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(inv => {
              const overdue = inv.daysPastDue !== null && inv.daysPastDue > 0;
              const aged = inv.ageDays > 14;
              return (
                <tr key={inv.id} style={{ borderBottom: "1px solid var(--border)", background: overdue ? "var(--kanban-overdue-bg)" : aged ? "var(--kanban-aged-bg)" : undefined }}>
                  <td style={{ padding: "8px 10px", fontFamily: "monospace", fontSize: 12, color: "var(--accent-primary)", whiteSpace: "nowrap" }}>{inv.invoiceNumber}</td>
                  <td style={{ padding: "8px 10px", fontWeight: 500, color: "var(--text-primary)" }}>{inv.supplier}</td>
                  <td style={{ padding: "8px 10px", color: "var(--text-muted)", fontSize: 12 }}>{inv.departments.join(", ") || "—"}</td>
                  <td style={{ padding: "8px 10px" }}><EntityPill entity={inv.entity} /></td>
                  <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{money(inv.amount, inv.currency)}</td>
                  <td style={{ padding: "8px 10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmt(inv.invoiceDate)}</td>
                  <td style={{ padding: "8px 10px", color: overdue ? "var(--accent-danger)" : "var(--text-muted)", fontWeight: overdue ? 600 : undefined, whiteSpace: "nowrap" }}>{fmt(inv.dueDate)}</td>
                  <td style={{ padding: "8px 10px", color: aged ? "var(--accent-warn)" : "var(--text-muted)", whiteSpace: "nowrap" }}>{inv.ageDays}d</td>
                  {showBatch && <td style={{ padding: "8px 10px", color: "var(--text-muted)", fontSize: 12 }}>{inv.batchNumber ?? "—"}</td>}
                  <td style={{ padding: "8px 10px", color: "var(--text-muted)", fontSize: 12 }}>{inv.currentApprover ?? "—"}</td>
                  <td style={{ padding: "8px 10px" }}>
                    <a href={`${process.env.NEXT_PUBLIC_COUPA_URL ?? "https://changeorg.coupahost.com"}/invoices/${inv.id}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-primary)", fontSize: 11 }}>↗</a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px 0", fontSize: 13 }}>No invoices match your filter.</p>}
      </div>
    </div>
  );
}

// ─── Expense Report Table ─────────────────────────────────────────────────────

function ERTable({ ers }: { ers: SlimExpenseReport[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {["Title", "Submitter", "Status", "Amount", "Submitted", "Age", "Audit", ""].map(h => (
              <th key={h} style={{ padding: "8px 10px", textAlign: h === "Amount" ? "right" : "left", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-muted)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ers.map(er => (
            <tr key={er.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "8px 10px", fontWeight: 500, color: "var(--text-primary)" }}>{er.title}</td>
              <td style={{ padding: "8px 10px", color: "var(--text-secondary)" }}>{er.submitter}</td>
              <td style={{ padding: "8px 10px", color: "var(--text-muted)", fontSize: 12 }}>{er.status}</td>
              <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap" }}>{money(er.total, er.currency)}</td>
              <td style={{ padding: "8px 10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{fmt(er.submittedAt)}</td>
              <td style={{ padding: "8px 10px", color: "var(--text-muted)" }}>{er.ageDays}d</td>
              <td style={{ padding: "8px 10px" }}>
                {er.policyViolations > 0
                  ? <span style={{ color: "var(--accent-danger)", fontWeight: 600 }}>⚠️ {er.policyViolations}</span>
                  : <span style={{ color: "var(--accent-success)" }}>✓</span>}
              </td>
              <td style={{ padding: "8px 10px" }}>
                <a href={`https://changeorg.coupahost.com/expense_reports/${er.id}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent-primary)", fontSize: 11 }}>↗</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {ers.length === 0 && <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px 0", fontSize: 13 }}>None.</p>}
    </div>
  );
}

// ─── DM Draft Card ────────────────────────────────────────────────────────────

function DmCard({ name, invs }: { name: string; invs: SlimInvoice[] }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const first = name.split(" ")[0];
  const oldest = Math.max(...invs.map(i => i.ageDays));
  const currencies = Array.from(new Set(invs.map(i => i.currency)));
  const totals = currencies.map(c => money(invs.filter(i => i.currency === c).reduce((s, i) => s + i.amount, 0), c)).join(" + ");

  const dmText = invs.length === 1
    ? `hi ${first}! 👀 friendly nudge — got an invoice pending your approval in coupa:\n\n• ${invs[0].supplier} — ${money(invs[0].amount, invs[0].currency)} (${invs[0].ageDays}d waiting)\n\nwhen you get a chance? 🙏\nhttps://changeorg.coupahost.com/invoice_approvals\n\nthanks!!`
    : `hi ${first}! 👀 friendly nudge — got ${invs.length} invoices pending your approval in coupa${oldest >= 3 ? ` (oldest has been waiting ${oldest}d 😬)` : ""}:\n\n${invs.map(i => `• ${i.supplier} — ${money(i.amount, i.currency)} (${i.ageDays}d waiting)`).join("\n")}\n\nwhen you get a chance? 🙏\nhttps://changeorg.coupahost.com/invoice_approvals\n\nthanks!!`;

  function copyMessage() {
    navigator.clipboard.writeText(dmText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 14 }}>{name}</span>
          <span style={{ marginLeft: 8, background: "var(--accent-danger)", color: "white", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{invs.length}</span>
          <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>{totals}</span>
        </div>
        <button onClick={copyMessage} style={{ fontSize: 12, padding: "6px 14px", border: "none", borderRadius: 6, background: copied ? "var(--accent-success)" : "var(--accent-primary)", color: "white", cursor: "pointer", fontWeight: 600, transition: "background 0.2s" }}>
          {copied ? "✓ Copied!" : "Copy message"}
        </button>
      </div>

      <div style={{ padding: "0 16px 14px" }}>
        <pre style={{
          background: "var(--bg-main)", border: "1px solid var(--border)", borderRadius: 8,
          padding: "12px 14px", fontSize: 12, lineHeight: 1.6, whiteSpace: "pre-wrap",
          color: "var(--text-secondary)", fontFamily: "ui-monospace, monospace",
        }}>{dmText}</pre>
      </div>

      <div style={{ borderTop: "1px solid var(--border)" }}>
        <button onClick={() => setOpen(!open)} style={{ width: "100%", padding: "8px 16px", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "var(--text-muted)", textAlign: "left" }}>
          {open ? "▾" : "▸"} {invs.length} invoice{invs.length !== 1 ? "s" : ""}
        </button>
        {open && <div style={{ padding: "0 8px 8px" }}><InvoiceTable invs={invs} /></div>}
      </div>
    </div>
  );
}

// ─── Kanban ───────────────────────────────────────────────────────────────────

function KanbanCol({ title, invs, count, onNavigate }: { title: string; invs: SlimInvoice[]; count: number; onNavigate: () => void }) {
  const top = [...invs].sort((a, b) => b.ageDays - a.ageDays).slice(0, 6);
  return (
    <div style={{ flex: 1, minWidth: 140, background: "var(--kanban-col-bg)", borderRadius: 10, padding: "10px 8px", cursor: "pointer" }} onClick={onNavigate}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>{count}</div>
      {top.map(inv => {
        const overdue = inv.daysPastDue !== null && inv.daysPastDue > 0;
        const aged = inv.ageDays > 14;
        return (
          <div key={inv.id} style={{
            background: overdue ? "var(--kanban-overdue-bg)" : aged ? "var(--kanban-aged-bg)" : "var(--kanban-card-bg)",
            borderLeft: `3px solid ${overdue ? "var(--kanban-overdue-border)" : aged ? "var(--kanban-aged-border)" : "var(--border)"}`,
            borderRadius: 6, padding: "6px 8px", marginBottom: 5, fontSize: 11,
          }}>
            <div style={{ fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.supplier}</div>
            <div style={{ color: "var(--text-muted)", marginTop: 2 }}>{money(inv.amount, inv.currency)} · {inv.ageDays}d</div>
          </div>
        );
      })}
      {count === 0 && <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", padding: "12px 0" }}>—</div>}
    </div>
  );
}

// ─── Views ────────────────────────────────────────────────────────────────────

function DashboardView({ data, onNavigate }: { data: FinanceDashboardData; onNavigate: (v: string) => void }) {
  const { stats, health } = data;
  const totalExceptions = health.exceptions.duplicateCount + health.exceptions.toleranceFailures +
    health.exceptions.oldInbox + health.exceptions.oldPending + health.exceptions.oldReadyToPay + health.exceptions.erPolicyViolations;

  const statCard = (emoji: string, label: string, value: React.ReactNode, sub?: string, onClick?: () => void) => (
    <div onClick={onClick} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", cursor: onClick ? "pointer" : undefined, flex: 1 }}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLElement).style.borderColor = "var(--accent-primary)")}
      onMouseLeave={e => onClick && ((e.currentTarget as HTMLElement).style.borderColor = "var(--border)")}
    >
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 6 }}>{emoji} {label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "var(--text-primary)" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{sub}</div>}
    </div>
  );

  const pastDueEntries = Object.entries(health.pastDue);
  const cash7dEntries = Object.entries(health.cash7d);

  const exRows = [
    { label: "Possible duplicates", count: health.exceptions.duplicateCount, key: "duplicates" },
    { label: "Tolerance failures", count: health.exceptions.toleranceFailures, key: "toleranceFails" },
    { label: "Stuck in inbox >7d", count: health.exceptions.oldInbox, key: "oldInbox" },
    { label: "Pending approval >14d", count: health.exceptions.oldPending, key: "oldPending" },
    { label: "Ready-to-pay >30d", count: health.exceptions.oldReadyToPay, key: "oldReadyToPay" },
    { label: "ER policy violations", count: health.exceptions.erPolicyViolations, key: "erViolations" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Dashboard</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
        {data.scopeSize} invoices · {data.erScopeSize} expense reports · refreshed {ago(Date.now() - data.generatedAtEpoch)}
      </p>

      {/* Health Pulse */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {statCard("🚨", "Past Due",
          pastDueEntries.length ? pastDueEntries.map(([c, v]) => `${c} ${v.count}`).join(" · ") : "None",
          pastDueEntries.map(([c, v]) => money(v.total, c)).join(" · ") || undefined,
          () => onNavigate("pastDue")
        )}
        {statCard("💰", "Cash Needed 7d",
          cash7dEntries.length ? cash7dEntries.map(([c, v]) => `${c} ${v.count}`).join(" · ") : "None",
          cash7dEntries.map(([c, v]) => money(v.total, c)).join(" · ") || undefined,
          () => onNavigate("cash7d")
        )}
        {statCard("📈", `Today (${health.todayDate})`,
          <div style={{ fontSize: 14, lineHeight: 1.8 }}>
            <div>{health.today.newInvoices} new invoices</div>
            <div>{health.today.paidInvoices} paid · {money(health.today.paidUsdAmount, "USD")}</div>
            <div>{health.today.newExpenseReports} new expense reports</div>
          </div>
        )}
      </div>

      {/* Exceptions */}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Exceptions</h2>
          <span style={{ background: totalExceptions > 0 ? "var(--accent-danger)" : "var(--accent-success)", color: "white", borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{totalExceptions}</span>
        </div>
        {exRows.map(({ label, count, key }) => (
          <div key={key} onClick={() => count > 0 && onNavigate(key)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border)", cursor: count > 0 ? "pointer" : undefined }}>
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
            <span style={{ fontWeight: 700, fontSize: 13, color: count > 0 ? "var(--accent-danger)" : "var(--accent-success)" }}>{count}</span>
          </div>
        ))}
      </div>

      {/* Bottlenecks */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 12 }}>Slowest Approvers</h2>
          {health.bottlenecks.approvers.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No pending approvals.</p>}
          {health.bottlenecks.approvers.map(a => (
            <div key={a.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 500 }}>{a.name}</span>
              <div style={{ textAlign: "right", fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{a.count}</span>
                <span style={{ color: a.maxAge > 14 ? "var(--accent-danger)" : "var(--text-muted)", marginLeft: 6 }}>max {a.maxAge}d</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 12 }}>Departments with Most Pending</h2>
          {health.bottlenecks.departments.length === 0 && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No data.</p>}
          {health.bottlenecks.departments.map(d => (
            <div key={d.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{d.name}</span>
              <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{d.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Kanban */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Invoice Pipeline</h2>
      <div style={{ display: "flex", gap: 10, marginBottom: 20, overflowX: "auto" }}>
        <KanbanCol title="Inbox" invs={data.categories.inbox} count={stats.inbox} onNavigate={() => onNavigate("inbox")} />
        <KanbanCol title="AP Queue" invs={Object.values(data.categories.groupQueues).flat()} count={stats.groupPending} onNavigate={() => onNavigate("groupQueues")} />
        <KanbanCol title="Pending Approval" invs={Object.values(data.categories.personPending).flat()} count={stats.personPending} onNavigate={() => onNavigate("personPending")} />
        <KanbanCol title="Ready to Pay" invs={data.categories.readyToPay} count={stats.readyToPay} onNavigate={() => onNavigate("readyToPay")} />
        <KanbanCol title="Batched" invs={data.categories.batchedPending} count={stats.batchedPending} onNavigate={() => onNavigate("batchedPending")} />
        <div style={{ flex: 1, minWidth: 140, background: "var(--kanban-col-bg)", borderRadius: 10, padding: "10px 8px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 8 }}>Paid</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--accent-success)" }}>{stats.paid}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>in scope</div>
        </div>
      </div>

      {/* Small tiles */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {[
          { emoji: "⚠️", label: "Pending Acct Setup", count: stats.pendingSetup, nav: "pendingSetup" },
          { emoji: "🧾", label: "ER Pending", count: data.expenseReports.stats.personPending + data.expenseReports.stats.groupPending, nav: "erPending" },
          { emoji: "🧾", label: "ER Awaiting Pay", count: data.expenseReports.stats.approvedForPayment, nav: "erApproved" },
          { emoji: "🔄", label: "Partially Paid", count: stats.partiallyPaid, nav: "partiallyPaid" },
        ].map(({ emoji, label, count, nav }) => (
          <div key={nav} onClick={() => onNavigate(nav)} style={{ flex: 1, minWidth: 120, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", cursor: "pointer" }}>
            <div style={{ fontSize: 18, marginBottom: 4 }}>{emoji}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>{count}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
        Excluded: {stats.rejected} rejected, {stats.voided} voided invoices.
      </p>
    </div>
  );
}

function InvoiceListView({ title, description, invs, showBatch = false }: { title: string; description?: string; invs: SlimInvoice[]; showBatch?: boolean }) {
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>{title}</h1>
      {description && <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>{description}</p>}
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
        <InvoiceTable invs={invs} showBatch={showBatch} />
      </div>
    </div>
  );
}

function PendingApprovalView({ personPending }: { personPending: Record<string, SlimInvoice[]> }) {
  const entries = Object.entries(personPending).sort((a, b) => b[1].length - a[1].length);
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>Pending Approval</h1>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>{entries.length} approvers · {entries.reduce((s, [, i]) => s + i.length, 0)} invoices</p>
      {entries.length === 0 && <p style={{ color: "var(--text-muted)" }}>No invoices pending individual approval. 🎉</p>}
      {entries.map(([name, invs]) => <DmCard key={name} name={name} invs={invs} />)}
    </div>
  );
}

function APQueueView({ groupQueues }: { groupQueues: Record<string, SlimInvoice[]> }) {
  const entries = Object.entries(groupQueues);
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>In AP Queue</h1>
      {entries.length === 0 && <p style={{ color: "var(--text-muted)" }}>AP queue is clear.</p>}
      {entries.map(([group, invs]) => (
        <div key={group} style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{group}</h2>
            <span style={{ background: "var(--accent-danger)", color: "white", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{invs.length}</span>
          </div>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px" }}>
            <InvoiceTable invs={invs} />
          </div>
        </div>
      ))}
    </div>
  );
}

function ERView({ title, erBuckets, view }: { title: string; erBuckets: FinanceDashboardData["expenseReports"]; view: "pending" | "approved" }) {
  if (view === "approved") {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>ER — Approved, Awaiting Pay</h1>
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
          <ERTable ers={erBuckets.approvedForPayment} />
        </div>
      </div>
    );
  }
  const groupEntries = Object.entries(erBuckets.pendingGroup);
  const personEntries = Object.entries(erBuckets.pendingPerson).sort((a, b) => b[1].length - a[1].length);
  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>ER — Pending Approval</h1>
      {groupEntries.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 12 }}>In Group Queues</h2>
          {groupEntries.map(([g, ers]) => (
            <div key={g} style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>{g} ({ers.length})</div>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px" }}>
                <ERTable ers={ers} />
              </div>
            </div>
          ))}
        </div>
      )}
      {personEntries.length > 0 && (
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)", marginBottom: 12 }}>Pending with Individuals</h2>
          {personEntries.map(([name, ers]) => (
            <div key={name} style={{ marginBottom: 16, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{name}</span>
                <span style={{ background: "var(--accent-danger)", color: "white", borderRadius: 10, padding: "1px 7px", fontSize: 11, fontWeight: 700 }}>{ers.length}</span>
              </div>
              <ERTable ers={ers} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DrillInView({ title, invs, ers, onBack }: { title: string; invs?: SlimInvoice[]; ers?: SlimExpenseReport[]; onBack: () => void }) {
  return (
    <div>
      <button onClick={onBack} style={{ fontSize: 13, color: "var(--accent-primary)", background: "none", border: "none", cursor: "pointer", marginBottom: 12, padding: 0 }}>← Dashboard</button>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", marginBottom: 20 }}>{title}</h1>
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
        {invs && <InvoiceTable invs={invs} />}
        {ers && <ERTable ers={ers} />}
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const AP_TEAM = (process.env.NEXT_PUBLIC_AP_TEAM ?? "Victoria Fung,Rosalina Lash,Shashank Hebbar").split(",").map(s => s.trim());

function Sidebar({ data, active, onNav, generatedAtEpoch, onRefresh, refreshing }: {
  data: FinanceDashboardData; active: string; onNav: (v: string) => void;
  generatedAtEpoch: number; onRefresh: () => void; refreshing: boolean;
}) {
  const { stats } = data;
  const erStats = data.expenseReports.stats;
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick(t => t + 1), 60000); return () => clearInterval(id); }, []);

  const NavItem = ({ label, view, badge, danger }: { label: string; view: string; badge?: number; danger?: boolean }) => (
    <button onClick={() => onNav(view)} style={{
      display: "flex", alignItems: "center", width: "100%", padding: "7px 12px",
      background: active === view ? "var(--bg-sidebar-active)" : "none",
      borderLeft: active === view ? "3px solid var(--sidebar-active-border)" : "3px solid transparent",
      border: "none", cursor: "pointer", color: active === view ? "var(--sidebar-text)" : "var(--sidebar-muted)",
      fontSize: 13, fontWeight: active === view ? 600 : 400, borderRadius: "0 6px 6px 0", textAlign: "left",
      fontFamily: "inherit",
    }}
    onMouseEnter={e => active !== view && ((e.currentTarget as HTMLElement).style.background = "var(--bg-sidebar-hover)")}
    onMouseLeave={e => active !== view && ((e.currentTarget as HTMLElement).style.background = "none")}
    >
      {label} {badge !== undefined && badge > 0 && <NavBadge count={badge} danger={danger} />}
    </button>
  );

  return (
    <div style={{ width: 260, background: "var(--bg-sidebar)", borderRight: "1px solid var(--border)", display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0, overflowY: "auto", flexShrink: 0 }}>
      {/* Sidebar header — matches invoice portal top bar */}
      <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/change-brandmark-red.png" alt="Change.org" style={{ height: 24, width: "auto" }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Finance Dashboard</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{data.scopeSize} inv · {ago(Date.now() - generatedAtEpoch)}</div>
        </div>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ padding: "4px 16px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--sidebar-section)" }}>Overview</div>
        <NavItem label="📊 Dashboard" view="dashboard" />

        <div style={{ padding: "10px 16px 4px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--sidebar-section)" }}>Invoices — Action Required</div>
        <NavItem label="🚩 Ready to Pay" view="readyToPay" badge={stats.readyToPay} danger={stats.readyToPay > 0} />
        <NavItem label="💳 Batched / In Progress" view="batchedPending" badge={stats.batchedPending} />
        <NavItem label="🔴 Pending Approval" view="personPending" badge={stats.personPending} danger={stats.personPending > 0} />
        <NavItem label="🟡 In AP Queue" view="groupQueues" badge={stats.groupPending} />
        <NavItem label="📥 Inbox" view="inbox" badge={stats.inbox} />
        <NavItem label="⚠️ Pending Acct Setup" view="pendingSetup" badge={stats.pendingSetup} />

        <div style={{ padding: "10px 16px 4px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--sidebar-section)" }}>Expense Reports</div>
        <NavItem label="🧾 Pending Approval" view="erPending" badge={erStats.personPending + erStats.groupPending} />
        <NavItem label="🧾 Approved, Awaiting Pay" view="erApproved" badge={erStats.approvedForPayment} />

        <div style={{ padding: "10px 16px 4px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--sidebar-section)" }}>Invoice Status</div>
        <NavItem label="🔄 Partially Paid" view="partiallyPaid" badge={stats.partiallyPaid} />
      </div>

      <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}>
        <button onClick={onRefresh} disabled={refreshing} style={{
          width: "100%", padding: "9px", background: "#FDF0EF", border: "1.5px solid #F0DEDD",
          borderRadius: 10, color: "#C94040", cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 600,
        }}>
          {refreshing ? "Refreshing…" : "🔄 Refresh data"}
        </button>
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6, textAlign: "center" }}>
          Last refreshed: {ago(Date.now() - generatedAtEpoch)}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FinanceDashboard() {
  const router = useRouter();
  const [data, setData] = useState<FinanceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState("dashboard");
  const [drillIn, setDrillIn] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Verify server-side cookie — passcode never touches the browser
    fetch("/api/verify-code?type=finance")
      .then(r => r.json())
      .then(({ ok }) => { if (!ok) router.replace("/"); else loadData(); })
      .catch(() => router.replace("/"));
  }, []);

  const loadData = useCallback(async (bust = false) => {
    setRefreshing(bust);
    if (!bust) setLoading(true);
    try {
      const res = await fetch(`/api/finance-data${bust ? "?refresh=1" : ""}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      setData(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  function navigate(view: string) {
    setDrillIn(null);
    setActiveView(view);
    window.scrollTo(0, 0);
  }

  if (loading) return (
    <div style={{ ...BASE_VARS as any, minHeight: "100vh", background: "var(--bg-main)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-jakarta, sans-serif)" } as any}>
      <div style={{ textAlign: "center", color: "#6B7280" }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Loading dashboard…</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Fetching invoice data from Coupa</div>
      </div>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: "#DC2626", marginBottom: 12 }}>Error: {error}</p>
        <button onClick={() => loadData(true)} style={{ padding: "8px 16px", background: "#E8251A", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}>Retry</button>
      </div>
    </div>
  );

  if (!data) return null;

  const renderMain = () => {
    if (drillIn) {
      const lists = data.health.lists;
      const drillMap: Record<string, { title: string; invs?: SlimInvoice[]; ers?: SlimExpenseReport[] }> = {
        pastDue: { title: "🚨 Past Due Invoices", invs: lists.pastDue },
        cash7d: { title: "💰 Cash Needed — Next 7 Days", invs: lists.cash7d },
        oldInbox: { title: "📥 Stuck in Inbox >7 Days", invs: lists.oldInbox },
        oldPending: { title: "🔴 Pending Approval >14 Days", invs: lists.oldPending },
        oldReadyToPay: { title: "🚩 Ready-to-Pay >30 Days", invs: lists.oldReadyToPay },
        toleranceFails: { title: "⚠️ Tolerance Failures", invs: lists.toleranceFails },
        erViolations: { title: "🧾 ER Policy Violations", ers: lists.erWithViolations },
      };
      const d = drillMap[drillIn];
      if (d) return <DrillInView title={d.title} invs={d.invs} ers={d.ers} onBack={() => setDrillIn(null)} />;
    }

    const { categories, expenseReports, stats } = data;

    switch (activeView) {
      case "dashboard": return <DashboardView data={data} onNavigate={(v) => { if (["pastDue","cash7d","oldInbox","oldPending","oldReadyToPay","toleranceFails","erViolations"].includes(v)) setDrillIn(v); else navigate(v); }} />;
      case "readyToPay": return <InvoiceListView title="🚩 Ready to Pay" description={`${stats.readyToPay} invoices approved and awaiting payment`} invs={categories.readyToPay} />;
      case "batchedPending": return <InvoiceListView title="💳 Batched / In Progress" description={`${stats.batchedPending} invoices in a payment batch`} invs={categories.batchedPending} showBatch />;
      case "personPending": return <PendingApprovalView personPending={categories.personPending} />;
      case "groupQueues": return <APQueueView groupQueues={categories.groupQueues} />;
      case "inbox": return <InvoiceListView title="📥 Inbox" description={`${stats.inbox} invoices not yet in approval`} invs={categories.inbox} />;
      case "pendingSetup": return <InvoiceListView title="⚠️ Pending Account Setup" description="Approved but supplier payment account not configured" invs={categories.pendingSetup} />;
      case "partiallyPaid": return <InvoiceListView title="🔄 Partially Paid" invs={categories.partiallyPaid} />;
      case "erPending": return <ERView title="ER Pending" erBuckets={expenseReports} view="pending" />;
      case "erApproved": return <ERView title="ER Approved" erBuckets={expenseReports} view="approved" />;
      default: return null;
    }
  };

  return (
    <div style={{ ...BASE_VARS as any, display: "flex", minHeight: "100vh", background: "var(--bg-main)", fontFamily: "var(--font-jakarta, -apple-system, BlinkMacSystemFont, sans-serif)", fontSize: 14 }}>
      <Sidebar
        data={data} active={drillIn ?? activeView} onNav={navigate}
        generatedAtEpoch={data.generatedAtEpoch}
        onRefresh={() => loadData(true)} refreshing={refreshing}
      />
      <main style={{ flex: 1, padding: "32px 36px", overflowY: "auto", maxHeight: "100vh" }}>
        <div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => router.push("/")}
            style={{ fontSize: 12, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
            ← Back to Hub
          </button>
        </div>
        {renderMain()}
      </main>
    </div>
  );
}
