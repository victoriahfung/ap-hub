export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const CODES: Record<string, string | undefined> = {
  finance:    process.env.FINANCE_CODE,
  restricted: process.env.RESTRICTED_CODE,
};

// POST — verify a passcode and set an httpOnly cookie if correct
export async function POST(req: NextRequest) {
  const { type, code } = await req.json();
  const expected = CODES[type];

  if (!expected) return NextResponse.json({ error: "Unknown type" }, { status: 400 });

  if (code?.trim().toLowerCase() !== expected.trim().toLowerCase()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(`auth_${type}`, "1", {
    httpOnly: true,   // not readable by JS — the whole point
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 12, // 12 hours
    path: "/",
  });
  return res;
}

// GET — check if the cookie is present
export async function GET(req: NextRequest) {
  const type = new URL(req.url).searchParams.get("type");
  if (!type) return NextResponse.json({ ok: false });
  const jar = await cookies();
  const ok = jar.get(`auth_${type}`)?.value === "1";
  return NextResponse.json({ ok });
}
