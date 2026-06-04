export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { searchInvoices, isConfidential } from "@/lib/coupa";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;

  if (!q && !dateFrom && !dateTo) {
    return NextResponse.json({ error: "Enter a search term" }, { status: 400 });
  }

  try {
    // Run supplier and invoice-number searches in parallel, then deduplicate
    const [bySupplier, byInvoiceNum] = await Promise.all([
      q ? searchInvoices({ supplier: q, dateFrom, dateTo }) : Promise.resolve([]),
      q ? searchInvoices({ invoiceNumber: q, dateFrom, dateTo }) : searchInvoices({ dateFrom, dateTo }),
    ]);

    const seen = new Set<number>();
    const results = [...bySupplier, ...byInvoiceNum].filter((inv) => {
      if (seen.has(inv.id)) return false;
      seen.add(inv.id);
      // Never expose confidential invoices via the employee portal
      if (isConfidential(inv)) return false;
      return true;
    });

    results.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    return NextResponse.json(results);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
