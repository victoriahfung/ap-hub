import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/coupa";

// Suggests supplier names by searching invoices (works within core.invoice.read scope)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const base = process.env.COUPA_INSTANCE_URL!;
  const token = await getAccessToken();

  const url = new URL(`${base}/api/invoices`);
  url.searchParams.set("supplier[name][contains]", q);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });

  if (!res.ok) return NextResponse.json([]);

  const data = await res.json();

  // Extract unique supplier names
  const seen = new Set<string>();
  const names: string[] = [];
  for (const inv of data ?? []) {
    const name: string = inv?.supplier?.name;
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
      if (names.length >= 8) break;
    }
  }

  return NextResponse.json(names);
}
