import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/coupa";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const invoiceId = searchParams.get("invoiceId");
  const attachmentId = searchParams.get("attachmentId");

  if (!invoiceId || !attachmentId) {
    return new NextResponse("Missing params", { status: 400 });
  }

  const base = process.env.COUPA_INSTANCE_URL!;
  const token = await getAccessToken();

  // Use Accept: application/json — this is what makes Coupa serve the binary file
  const res = await fetch(
    `${base}/api/invoices/${invoiceId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } }
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return new NextResponse(`Coupa error ${res.status}: ${body}`, { status: res.status });
  }

  const contentType = res.headers.get("content-type") ?? "application/octet-stream";
  const buffer = await res.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": "inline",
    },
  });
}
