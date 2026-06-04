import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/coupa";
import { buildDashboardData } from "@/lib/finance";

let cache: { data: any; fetchedAt: number; day: string } | null = null;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

function todayLA(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
}

async function paginate(base: string, token: string, path: string, limit: number): Promise<any[]> {
  const all: any[] = [];
  for (let offset = 0; offset < limit; offset += 50) {
    const res = await fetch(`${base}/api/${path}?limit=50&offset=${offset}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!res.ok) break;
    const page = await res.json();
    if (!Array.isArray(page) || !page.length) break;
    all.push(...page);
    if (all.length >= limit) break;
  }
  return all;
}

export async function GET(req: NextRequest) {
  const refresh = new URL(req.url).searchParams.get("refresh") === "1";

  const today = todayLA();
  const cacheValid = cache &&
    !refresh &&
    cache.day === today &&                          // same calendar day
    Date.now() - cache.fetchedAt < CACHE_TTL_MS;   // within 6 hours

  if (cacheValid) {
    return NextResponse.json({ ...cache.data, fromCache: true });
  }

  try {
    const base = process.env.COUPA_INSTANCE_URL!;
    const token = await getAccessToken();

    const [rawInvs, rawERs] = await Promise.all([
      paginate(base, token, "invoices", 2000),
      paginate(base, token, "expense_reports", 500),
    ]);

    const data = buildDashboardData(rawInvs, rawERs);
    cache = { data, fetchedAt: Date.now(), day: todayLA() };

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
