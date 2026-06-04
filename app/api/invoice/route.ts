import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/coupa";

// Fetches a single invoice with full attachment metadata
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    const token = await getAccessToken();
    const res = await fetch(
      `${process.env.COUPA_INSTANCE_URL}/api/invoices/${id}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
    );
    if (!res.ok) return NextResponse.json({ error: `Coupa error ${res.status}` }, { status: res.status });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
