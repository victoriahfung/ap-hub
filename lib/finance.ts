// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApprovalEntry {
  status: string;
  position: number;
  name: string;
  isGroup: boolean;
}

export interface SlimInvoice {
  id: number;
  invoiceNumber: string;
  supplier: string;
  supplierId: number;
  entity: string;
  departments: string[];
  amount: number;
  currency: string;
  status: string;
  paid: boolean;
  piStatus: "ready_to_pay" | "payment_in_progress" | "pending_pay_to_account_creation" | "partially_paid" | null;
  createdAt: string;
  invoiceDate: string | null;
  dueDate: string | null;
  paymentDate: string | null;
  ageDays: number;
  daysPastDue: number | null;
  approvals: ApprovalEntry[];
  currentApprover: string | null;
  currentApproverIsGroup: boolean;
  toleranceFailures: number;
  batchNumber: string | null;
}

export interface SlimExpenseReport {
  id: number;
  title: string;
  submitter: string;
  submitterEmail: string;
  status: string;
  total: number;
  currency: string;
  submittedAt: string | null;
  createdAt: string;
  ageDays: number;
  paid: boolean;
  pastDue: boolean;
  auditScore: number | null;
  policyViolations: number;
  approvals: ApprovalEntry[];
  currentApprover: string | null;
  currentApproverIsGroup: boolean;
}

export interface InvoiceBuckets {
  inbox: SlimInvoice[];
  groupQueues: Record<string, SlimInvoice[]>;
  personPending: Record<string, SlimInvoice[]>;
  readyToPay: SlimInvoice[];
  batchedPending: SlimInvoice[];
  pendingSetup: SlimInvoice[];
  partiallyPaid: SlimInvoice[];
  paid: SlimInvoice[];
  rejected: SlimInvoice[];
  voided: SlimInvoice[];
}

export interface ERBuckets {
  pendingPerson: Record<string, SlimExpenseReport[]>;
  pendingGroup: Record<string, SlimExpenseReport[]>;
  approvedForPayment: SlimExpenseReport[];
  paid: SlimExpenseReport[];
  working: SlimExpenseReport[];
  draft: SlimExpenseReport[];
}

export interface CurrencyTotal { count: number; total: number; }

export interface FinanceDashboardData {
  generatedAt: string;
  generatedAtEpoch: number;
  scopeSize: number;
  erScopeSize: number;
  stats: Record<string, number>;
  categories: InvoiceBuckets;
  expenseReports: ERBuckets & { stats: Record<string, number> };
  health: {
    todayDate: string;
    pastDue: Record<string, CurrencyTotal>;
    cash7d: Record<string, CurrencyTotal>;
    today: { newInvoices: number; paidInvoices: number; paidUsdAmount: number; newExpenseReports: number };
    exceptions: {
      duplicates: { supplier: string; amount: number; currency: string; count: number; invoiceIds: number[] }[];
      duplicateCount: number;
      toleranceFailures: number;
      toleranceFailureIds: number[];
      oldInbox: number;
      oldPending: number;
      oldReadyToPay: number;
      erPolicyViolations: number;
    };
    bottlenecks: {
      approvers: { name: string; count: number; usdAmount: number; maxAge: number; avgAge: number }[];
      departments: { name: string; count: number }[];
    };
    lists: {
      pastDue: SlimInvoice[];
      cash7d: SlimInvoice[];
      todayNew: SlimInvoice[];
      todayPaid: SlimInvoice[];
      oldInbox: SlimInvoice[];
      oldPending: SlimInvoice[];
      oldReadyToPay: SlimInvoice[];
      toleranceFails: SlimInvoice[];
      erWithViolations: SlimExpenseReport[];
    };
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a: string | null, b: Date = new Date()): number {
  if (!a) return 0;
  return Math.floor((b.getTime() - new Date(a).getTime()) / 86400000);
}

function extractEntity(inv: any): string {
  const name: string = inv["account-type"]?.name ?? inv?.["invoice-lines"]?.[0]?.account?.["account-type"]?.name ?? "";
  if (name.includes("UK")) return "UK";
  if (name.includes("Foundation")) return "Foundation";
  if (name.includes("Australia")) return "Australia";
  if (name.includes("Canada")) return "Canada";
  if (name.includes("Spain")) return "Spain";
  if (name.includes("PBC")) return "PBC";
  return "PBC"; // default
}

function extractDepartments(inv: any): string[] {
  const lines: any[] = inv["invoice-lines"] ?? [];
  const depts = new Set<string>();
  for (const line of lines) {
    const name: string = line?.account?.name ?? "";
    const parts = name.split("-");
    if (parts.length >= 2) {
      const d = parts[1].trim();
      if (d) depts.add(d);
    }
  }
  return Array.from(depts);
}

function extractApprovals(inv: any): ApprovalEntry[] {
  const raw: any[] = inv.approvals ?? [];
  return raw.map((a: any) => {
    const isGroup = !a.approver?.email && !!(a.approver?.name || a["approval-chain"]);
    return {
      status: a.status ?? "unknown",
      position: a.position ?? 999,
      name: a.approver?.fullname ?? a.approver?.name ?? a["approval-chain"]?.name ?? "Unknown",
      isGroup,
    };
  }).sort((a, b) => a.position - b.position);
}

function getCurrentApprover(approvals: ApprovalEntry[]): { name: string; isGroup: boolean } | null {
  const pending = approvals.filter(a => a.status === "pending_approval");
  if (!pending.length) return null;
  const min = pending.reduce((a, b) => a.position <= b.position ? a : b);
  return { name: min.name, isGroup: min.isGroup };
}

function extractPiStatus(inv: any): SlimInvoice["piStatus"] {
  const payments: any[] = inv.payments ?? [];
  const paymentDate: string | null = inv["payment-date"] ?? null;
  if (paymentDate) return null; // already paid, piStatus not relevant
  if (!payments.length) return "ready_to_pay";
  const totalPaid = payments.reduce((s, p) => s + parseFloat(p["amount-paid"] ?? "0"), 0);
  const invoiceTotal = parseFloat(inv["invoice-total"] ?? inv["gross-total"] ?? "0");
  if (totalPaid > 0 && totalPaid < invoiceTotal) return "partially_paid";
  if (payments.length > 0) return "payment_in_progress";
  return "ready_to_pay";
}

// ─── Main transform functions ─────────────────────────────────────────────────

export function makeSlimInvoice(raw: any): SlimInvoice {
  const now = new Date();
  const paymentDate: string | null = raw["payment-date"] ?? null;
  const dueDate: string | null = raw["due-date"] ?? (() => {
    const days = raw["payment-term"]?.["days-for-net-payment"];
    const base = raw["invoice-date"] ?? raw["created-at"];
    if (!days || !base) return null;
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d.toISOString();
  })();
  const status = (raw.status ?? "").toLowerCase();
  const paid = !!paymentDate;
  const approvals = extractApprovals(raw);
  const currentApproverObj = getCurrentApprover(approvals);

  return {
    id: raw.id,
    invoiceNumber: raw["invoice-number"] ?? String(raw.id),
    supplier: raw.supplier?.name ?? "—",
    supplierId: raw.supplier?.id ?? 0,
    entity: extractEntity(raw),
    departments: extractDepartments(raw),
    amount: parseFloat(raw["invoice-total"] ?? raw["gross-total"] ?? raw.total ?? "0"),
    currency: raw.currency?.code ?? "USD",
    status,
    paid,
    piStatus: paid ? null : (status === "approved" ? extractPiStatus(raw) : null),
    createdAt: raw["created-at"] ?? "",
    invoiceDate: raw["invoice-date"] ?? null,
    dueDate,
    paymentDate,
    ageDays: daysBetween(raw["created-at"], now),
    daysPastDue: dueDate ? daysBetween(dueDate, now) : null,
    approvals,
    currentApprover: currentApproverObj?.name ?? null,
    currentApproverIsGroup: currentApproverObj?.isGroup ?? false,
    toleranceFailures: (raw["failed-tolerances"] ?? []).length,
    batchNumber: raw.payments?.[0]?.["payment-number"] ?? raw.payments?.[0]?.notes ?? null,
  };
}

export function makeSlimExpenseReport(raw: any): SlimExpenseReport {
  const now = new Date();
  const status = (raw.status ?? "").toLowerCase();
  const approvals = extractApprovals(raw);
  const currentApproverObj = getCurrentApprover(approvals);
  return {
    id: raw.id,
    title: raw.title ?? raw["report-number"] ?? `Report #${raw.id}`,
    submitter: raw["submitted-by"]?.fullname ?? raw["submitted-by"]?.name ?? "Unknown",
    submitterEmail: raw["submitted-by"]?.email ?? "",
    status,
    total: parseFloat(raw.total ?? "0"),
    currency: raw.currency?.code ?? "USD",
    submittedAt: raw["submitted-at"] ?? null,
    createdAt: raw["created-at"] ?? "",
    ageDays: daysBetween(raw["created-at"], now),
    paid: status === "paid",
    pastDue: false,
    auditScore: raw["audit-score"] ?? null,
    policyViolations: (raw["policy-violations"] ?? []).length,
    approvals,
    currentApprover: currentApproverObj?.name ?? null,
    currentApproverIsGroup: currentApproverObj?.isGroup ?? false,
  };
}

// ─── Bucketing ────────────────────────────────────────────────────────────────

export function bucketInvoices(invs: SlimInvoice[]): InvoiceBuckets {
  const b: InvoiceBuckets = {
    inbox: [], groupQueues: {}, personPending: {},
    readyToPay: [], batchedPending: [], pendingSetup: [],
    partiallyPaid: [], paid: [], rejected: [], voided: [],
  };

  for (const inv of invs) {
    if (inv.paid) { b.paid.push(inv); continue; }
    if (inv.status === "voided") { b.voided.push(inv); continue; }
    if (inv.status === "rejected" || inv.status === "cancelled") { b.rejected.push(inv); continue; }
    if (inv.piStatus === "partially_paid") { b.partiallyPaid.push(inv); continue; }
    if (inv.piStatus === "payment_in_progress") { b.batchedPending.push(inv); continue; }
    if (inv.piStatus === "pending_pay_to_account_creation") { b.pendingSetup.push(inv); continue; }
    if (inv.piStatus === "ready_to_pay") { b.readyToPay.push(inv); continue; }
    if (inv.status === "new" || inv.status === "draft") { b.inbox.push(inv); continue; }
    if (inv.status === "pending_approval" || inv.status === "submitted") {
      if (inv.currentApprover) {
        if (inv.currentApproverIsGroup) {
          if (!b.groupQueues[inv.currentApprover]) b.groupQueues[inv.currentApprover] = [];
          b.groupQueues[inv.currentApprover].push(inv);
        } else {
          if (!b.personPending[inv.currentApprover]) b.personPending[inv.currentApprover] = [];
          b.personPending[inv.currentApprover].push(inv);
        }
      } else {
        b.inbox.push(inv);
      }
      continue;
    }
    if (inv.status === "approved") { b.readyToPay.push(inv); continue; }
    b.inbox.push(inv);
  }

  return b;
}

export function bucketExpenseReports(ers: SlimExpenseReport[]): ERBuckets {
  const b: ERBuckets = { pendingPerson: {}, pendingGroup: {}, approvedForPayment: [], paid: [], working: [], draft: [] };
  for (const er of ers) {
    if (er.paid) { b.paid.push(er); continue; }
    if (er.status === "approved_for_payment" || er.status === "approved") { b.approvedForPayment.push(er); continue; }
    if (er.status === "pending_approval") {
      if (er.currentApprover) {
        if (er.currentApproverIsGroup) {
          if (!b.pendingGroup[er.currentApprover]) b.pendingGroup[er.currentApprover] = [];
          b.pendingGroup[er.currentApprover].push(er);
        } else {
          if (!b.pendingPerson[er.currentApprover]) b.pendingPerson[er.currentApprover] = [];
          b.pendingPerson[er.currentApprover].push(er);
        }
      }
      continue;
    }
    if (er.status === "working") { b.working.push(er); continue; }
    b.draft.push(er);
  }
  return b;
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export function computeHealth(
  allInvs: SlimInvoice[],
  buckets: InvoiceBuckets,
  allERs: SlimExpenseReport[],
): FinanceDashboardData["health"] {
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

  // Past due: approved+unpaid where daysPastDue > 0
  const pastDueInvs = [...buckets.readyToPay, ...buckets.batchedPending]
    .filter(i => i.daysPastDue !== null && i.daysPastDue > 0);
  const cash7dInvs = [...buckets.readyToPay, ...buckets.batchedPending]
    .filter(i => i.daysPastDue !== null && i.daysPastDue > -8);

  function groupByCurrency(invs: SlimInvoice[]): Record<string, CurrencyTotal> {
    const out: Record<string, CurrencyTotal> = {};
    for (const inv of invs) {
      if (!out[inv.currency]) out[inv.currency] = { count: 0, total: 0 };
      out[inv.currency].count++;
      out[inv.currency].total += inv.amount;
    }
    return out;
  }

  // Today (LA time)
  const todayNew = allInvs.filter(i => i.createdAt.startsWith(todayStr));
  const todayPaid = allInvs.filter(i => i.paymentDate?.startsWith(todayStr));
  const paidUsdAmount = todayPaid.filter(i => i.currency === "USD").reduce((s, i) => s + i.amount, 0);
  const newERs = allERs.filter(e => e.createdAt.startsWith(todayStr));

  // Duplicates: same supplier + amount + currency, ≤30 days apart
  const dupMap = new Map<string, SlimInvoice[]>();
  for (const inv of allInvs) {
    const key = `${inv.supplierId}|${Math.round(inv.amount * 100)}|${inv.currency}`;
    if (!dupMap.has(key)) dupMap.set(key, []);
    dupMap.get(key)!.push(inv);
  }
  const duplicates: FinanceDashboardData["health"]["exceptions"]["duplicates"] = [];
  for (const [, group] of dupMap) {
    if (group.length < 2) continue;
    const dates = group.map(i => new Date(i.createdAt).getTime()).sort();
    if (dates[dates.length - 1] - dates[0] <= 30 * 86400000) {
      duplicates.push({
        supplier: group[0].supplier,
        amount: group[0].amount,
        currency: group[0].currency,
        count: group.length,
        invoiceIds: group.map(i => i.id),
      });
    }
  }

  const toleranceFails = allInvs.filter(i => i.toleranceFailures > 0);
  const oldInbox = buckets.inbox.filter(i => i.ageDays > 7);
  const oldPending = [...Object.values(buckets.personPending), ...Object.values(buckets.groupQueues)]
    .flat().filter(i => i.ageDays > 14);
  const oldReadyToPay = buckets.readyToPay.filter(i => i.ageDays > 30);
  const erViolations = allERs.filter(e => e.policyViolations > 0);

  // Bottlenecks
  const approverMap = new Map<string, SlimInvoice[]>();
  for (const inv of [...Object.values(buckets.personPending)].flat()) {
    if (!approverMap.has(inv.currentApprover!)) approverMap.set(inv.currentApprover!, []);
    approverMap.get(inv.currentApprover!)!.push(inv);
  }
  const approverBottlenecks = Array.from(approverMap.entries())
    .map(([name, invs]) => ({
      name,
      count: invs.length,
      usdAmount: invs.filter(i => i.currency === "USD").reduce((s, i) => s + i.amount, 0),
      maxAge: Math.max(...invs.map(i => i.ageDays)),
      avgAge: invs.reduce((s, i) => s + i.ageDays, 0) / invs.length,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const deptMap = new Map<string, number>();
  for (const inv of allInvs.filter(i => i.status === "pending_approval")) {
    for (const d of inv.departments) {
      deptMap.set(d, (deptMap.get(d) ?? 0) + 1);
    }
  }
  const deptBottlenecks = Array.from(deptMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    todayDate: todayStr,
    pastDue: groupByCurrency(pastDueInvs),
    cash7d: groupByCurrency(cash7dInvs),
    today: { newInvoices: todayNew.length, paidInvoices: todayPaid.length, paidUsdAmount, newExpenseReports: newERs.length },
    exceptions: {
      duplicates,
      duplicateCount: duplicates.length,
      toleranceFailures: toleranceFails.length,
      toleranceFailureIds: toleranceFails.map(i => i.id),
      oldInbox: oldInbox.length,
      oldPending: oldPending.length,
      oldReadyToPay: oldReadyToPay.length,
      erPolicyViolations: erViolations.length,
    },
    bottlenecks: { approvers: approverBottlenecks, departments: deptBottlenecks },
    lists: {
      pastDue: pastDueInvs,
      cash7d: cash7dInvs,
      todayNew,
      todayPaid,
      oldInbox,
      oldPending,
      oldReadyToPay,
      toleranceFails,
      erWithViolations: erViolations,
    },
  };
}

export function buildDashboardData(rawInvs: any[], rawERs: any[]): FinanceDashboardData {
  const allInvs = rawInvs.map(makeSlimInvoice);
  const allERs = rawERs.map(makeSlimExpenseReport);
  const buckets = bucketInvoices(allInvs);
  const erBuckets = bucketExpenseReports(allERs);
  const health = computeHealth(allInvs, buckets, allERs);

  const personPendingCount = Object.values(buckets.personPending).flat().length;
  const groupPendingCount = Object.values(buckets.groupQueues).flat().length;
  const erPersonPending = Object.values(erBuckets.pendingPerson).flat().length;
  const erGroupPending = Object.values(erBuckets.pendingGroup).flat().length;

  return {
    generatedAt: new Date().toISOString(),
    generatedAtEpoch: Date.now(),
    scopeSize: rawInvs.length,
    erScopeSize: rawERs.length,
    stats: {
      inbox: buckets.inbox.length,
      personPending: personPendingCount,
      personCount: Object.keys(buckets.personPending).length,
      groupPending: groupPendingCount,
      groupCount: Object.keys(buckets.groupQueues).length,
      batchedPending: buckets.batchedPending.length,
      readyToPay: buckets.readyToPay.length,
      pendingSetup: buckets.pendingSetup.length,
      partiallyPaid: buckets.partiallyPaid.length,
      paid: buckets.paid.length,
      rejected: buckets.rejected.length,
      voided: buckets.voided.length,
    },
    categories: buckets,
    expenseReports: {
      ...erBuckets,
      stats: {
        personPending: erPersonPending,
        personCount: Object.keys(erBuckets.pendingPerson).length,
        groupPending: erGroupPending,
        approvedForPayment: erBuckets.approvedForPayment.length,
        paid: erBuckets.paid.length,
        working: erBuckets.working.length,
        draft: erBuckets.draft.length,
      },
    },
    health,
  };
}
