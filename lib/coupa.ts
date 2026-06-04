/**
 * Server-side Coupa API client.
 * Credentials come from environment variables — never sent to the browser.
 */

const COUPA_BASE = process.env.COUPA_INSTANCE_URL!;
const COUPA_CLIENT_ID = process.env.COUPA_CLIENT_ID!;
const COUPA_CLIENT_SECRET = process.env.COUPA_CLIENT_SECRET!;

let _token: { value: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (_token && Date.now() < _token.expiresAt - 60_000) return _token.value;
  const res = await fetch(`${COUPA_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: COUPA_CLIENT_ID,
      client_secret: COUPA_CLIENT_SECRET,
      scope: "core.invoice.read",
    }),
  });
  if (!res.ok) throw new Error(`Coupa auth failed: ${res.status}`);
  const data = await res.json();
  _token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return _token.value;
}

async function coupaGet(path: string, params: Record<string, string> = {}) {
  const token = await getAccessToken();
  const url = new URL(`${COUPA_BASE}/api${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Coupa API error ${res.status}`);
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentStatus = "paid" | "payment_pending" | "approved" | "pending_approval" | "rejected" | "voided" | "other";

export interface Attachment {
  id: number;
  filename: string;
  type: string; // "url" | "file"
  url: string | null; // external URL if type=url
}

export interface PaymentInfo {
  paymentNumber: string | null;
  batchNumber: string | null;
  batchStatus: string | null;
  paymentApprovalStatus: string | null;
  paymentApprover: string | null;
}

export interface InvoiceRow {
  id: number;
  invoiceNumber: string;
  supplier: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  submittedAt: string;
  dueAt: string | null;
  paidAt: string | null;
  nextApprover: string | null;
  payment: PaymentInfo;
  attachments: Attachment[];
  imageScanPath: string | null;
  departments: string[]; // parsed from invoice line GL account names
  restricted: boolean;   // true if any GL account matches a restricted keyword
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function resolveStatus(raw: string): PaymentStatus {
  const s = (raw ?? "").toLowerCase().replace(/[^a-z_]/g, "_");
  if (s === "paid") return "paid";
  if (s === "payment_pending" || s === "payment_hold") return "payment_pending";
  if (s === "approved") return "approved";
  if (s.includes("pending") || s === "draft" || s === "submitted" || s === "on_hold") return "pending_approval";
  if (s === "rejected" || s === "cancelled") return "rejected";
  if (s === "voided") return "voided";
  return "other";
}

function findNextApprover(approvals: any[]): string | null {
  if (!Array.isArray(approvals)) return null;
  const pending = approvals.find((a: any) => a.status === "pending_approval");
  return pending?.approver?.email ?? pending?.approver?.name ?? null;
}

function parsePayment(inv: any): PaymentInfo {
  const payments: any[] = inv.payments ?? [];
  const firstPayment = payments[0];
  const batch = firstPayment?.["payment-batch"] ?? null;
  const paymentApprovals: any[] = batch?.approvals ?? firstPayment?.approvals ?? [];
  const pendingPaymentApproval = paymentApprovals.find((a: any) => a.status === "pending_approval");

  // Coupa Pay puts the reference in "notes" (e.g. "Coupa Pay 1175")
  // Traditional payments put it in "payment-number"
  const paymentNumber =
    firstPayment?.["payment-number"] ??
    firstPayment?.notes ??
    (firstPayment ? `Payment #${firstPayment.id}` : null);

  return {
    paymentNumber,
    batchNumber: batch?.["batch-number"] ?? null,
    batchStatus: batch?.status ?? null,
    paymentApprovalStatus: pendingPaymentApproval ? "pending_approval" : (paymentApprovals.length > 0 ? "approved" : null),
    paymentApprover: pendingPaymentApproval?.approver?.email ?? pendingPaymentApproval?.approver?.name ?? null,
  };
}

// Keywords from env var RESTRICTED_GL_KEYWORDS (comma-separated, server-side only)
// Any invoice whose GL account name contains one of these words is marked restricted.
function getRestrictedKeywords(): string[] {
  return (process.env.RESTRICTED_GL_KEYWORDS ?? "contractor,legal,contract labor,contract services")
    .split(",")
    .map(k => k.trim().toLowerCase())
    .filter(Boolean);
}

function checkRestricted(inv: any): boolean {
  const keywords = getRestrictedKeywords();
  const lines: any[] = inv["invoice-lines"] ?? inv.lines ?? [];
  for (const line of lines) {
    const accountName = (line?.account?.name ?? "").toLowerCase();
    const accountCode = (line?.account?.code ?? "").toLowerCase();
    if (keywords.some(k => accountName.includes(k) || accountCode.includes(k))) return true;
  }
  return false;
}

// Account names follow the pattern: "Change.org, PBC.-{Department}-{Category}-{Location}"
// We extract the segment after the first "-" that follows the entity name.
function parseDepartments(inv: any): string[] {
  const lines: any[] = inv["invoice-lines"] ?? inv.lines ?? [];
  const depts = new Set<string>();
  for (const line of lines) {
    const name: string = line?.account?.name ?? "";
    // Split on "-" and take the second token (index 1) — that's the department
    const parts = name.split("-");
    if (parts.length >= 2) {
      const dept = parts[1].trim();
      if (dept) depts.add(dept);
    }
  }
  return Array.from(depts);
}

function parseAttachments(inv: any): Attachment[] {
  const raw: any[] = inv.attachments ?? inv["attachments"] ?? [];
  return raw.map((a: any) => ({
    id: a.id,
    filename: a.filename ?? a["file-name"] ?? "attachment",
    type: a.type ?? "file",
    url: a.url ?? null,
  }));
}

function calcDueDate(inv: any): string | null {
  // Coupa sometimes has explicit due-date; otherwise calculate from invoice date + payment term days
  if (inv["due-date"]) return inv["due-date"];
  const days: number | null = inv["payment-term"]?.["days-for-net-payment"] ?? null;
  const base = inv["invoice-date"] ?? inv["created-at"] ?? null;
  if (!days || !base) return null;
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function isConfidential(inv: any): boolean {
  return inv?.confidential === true || inv?.confidential === "true";
}

function mapInvoice(inv: any): InvoiceRow {
  const paidAt = inv["payment-date"] ?? inv.payment_date ?? null;
  const status = paidAt ? "paid" : resolveStatus(inv.status);
  return {
    id: inv.id,
    invoiceNumber: inv["invoice-number"] ?? inv.invoice_number ?? String(inv.id),
    supplier: inv.supplier?.name ?? "—",
    amount: parseFloat(inv["invoice-total"] ?? inv["gross-total"] ?? inv.total ?? "0"),
    currency: inv.currency?.code ?? inv.currency_code ?? "USD",
    status,
    submittedAt: inv["created-at"] ?? inv.created_at ?? "",
    dueAt: calcDueDate(inv),
    paidAt,
    nextApprover: findNextApprover(inv.approvals ?? []),
    payment: parsePayment(inv),
    attachments: parseAttachments(inv),
    imageScanPath: inv["image-scan"] ?? null,
    departments: parseDepartments(inv),
    restricted: checkRestricted(inv),
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SearchParams {
  supplier?: string;
  invoiceNumber?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function searchInvoices(params: SearchParams): Promise<InvoiceRow[]> {
  const query: Record<string, string> = {};
  if (params.supplier) query["supplier[name][contains]"] = params.supplier;
  if (params.invoiceNumber) query["invoice-number[contains]"] = params.invoiceNumber;
  if (params.dateFrom) query["created-at[gt_or_eq]"] = params.dateFrom;
  if (params.dateTo) query["created-at[lt_or_eq]"] = params.dateTo;

  if (Object.keys(query).length === 0) return [];

  const data = await coupaGet("/invoices", query);
  return (data ?? []).map(mapInvoice);
}
