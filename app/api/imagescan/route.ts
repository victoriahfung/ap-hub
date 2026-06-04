export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/coupa";

// Proxies the image-scan PDF from Coupa using server-side credentials.
// The "image-scan" field on an invoice is a path like:
//   changeorg.coupahost.com/invoice_headers/image_scans/{id}/original/file.pdf
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path"); // the raw value from the invoice's "image-scan" field

  if (!path) return new NextResponse("Missing path", { status: 400 });

  const token = await getAccessToken();

  // The path may or may not have https:// — normalise it
  const url = path.startsWith("http") ? path : `https://${path}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return new NextResponse(`Coupa error ${res.status}: ${body.slice(0, 200)}`, { status: res.status });
  }

  const contentType = res.headers.get("content-type") ?? "application/pdf";
  const buffer = await res.arrayBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": "inline",
    },
  });
}
