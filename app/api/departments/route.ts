import { NextResponse } from "next/server";
import { getAccessToken } from "@/lib/coupa";

export const dynamic = "force-dynamic";

// In-memory cache — departments are stable, no need to refetch every page load
let cache: { departments: string[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function GET() {
  // Return cached result if still fresh
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cache.departments);
  }

  const base = process.env.COUPA_INSTANCE_URL!;
  const token = await getAccessToken();
  const depts = new Set<string>();

  // Paginate through up to 1,000 invoices to find all department names
  for (let offset = 0; offset < 1000; offset += 50) {
    const res = await fetch(
      `${base}/api/invoices?limit=50&offset=${offset}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
    );
    if (!res.ok) break;
    const page = await res.json();
    if (!page?.length) break;

    for (const inv of page) {
      const lines: any[] = inv["invoice-lines"] ?? [];
      for (const line of lines) {
        // Account name format: "Change.org, PBC.-{Department}-{Category}-{Location}"
        const name: string = line?.account?.name ?? "";
        const parts = name.split("-");
        if (parts.length >= 2) {
          const dept = parts[1].trim();
          if (dept) depts.add(dept);
        }
      }
    }

    if (depts.size > 0 && page.length < 50) break; // last page
  }

  const departments = Array.from(depts).sort();
  cache = { departments, fetchedAt: Date.now() };

  return NextResponse.json(departments);
}
