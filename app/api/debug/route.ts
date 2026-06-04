import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/coupa";

// Temporary debug route — shows exactly what Coupa returns for an invoice and its attachments
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const invoiceId = searchParams.get("invoiceId");
  if (!invoiceId) return NextResponse.json({ error: "Pass ?invoiceId=1239" });

  const base = process.env.COUPA_INSTANCE_URL!;
  const token = await getAccessToken();
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };

  // 1. Fetch the invoice
  const invRes = await fetch(`${base}/api/invoices/${invoiceId}`, { headers });
  const invData = await invRes.json();
  const attachments = invData?.attachments ?? [];

  // Check image scan fields
  const paymentFields = {
    "image-scans": invData?.["image-scans"],
    "scanned-invoice": invData?.["scanned-invoice"],
    "image-scan": invData?.["image-scan"],
    "document-image": invData?.["document-image"],
    attachments: invData?.attachments,
    "gross-total": invData?.["gross-total"],
  };

  // Try every plausible image scan URL pattern
  const imagePath = invData?.["image-scan"] ?? "";
  const candidates = [
    `${base}/api/invoices/${invoiceId}/image_scan`,
    `${base}/api/invoices/${invoiceId}/image_scans`,
    `https://${imagePath}`,
    `${base}/invoice_headers/${invoiceId}/image_scan`,
    `${base}/invoice_headers/${invoiceId}/image_scan.pdf`,
  ];
  const scanResults: any[] = [];
  for (const url of candidates) {
    const r = await fetch(url, { headers });
    const ct = r.headers.get("content-type") ?? "";
    const preview = ct.includes("html") || ct.includes("json")
      ? (await r.text().catch(() => "")).slice(0, 120)
      : "(binary)";
    scanResults.push({ url, status: r.status, contentType: ct, preview });
  }
  const scanData = scanResults;


  // 3. For each attachment, try fetching via file-url with Bearer token
  const attachmentResults = await Promise.all(
    attachments.map(async (a: any) => {
      const fileUrl = a["file-url"];
      if (!fileUrl) return { attachmentId: a.id, error: "no file-url" };
      const r = await fetch(fileUrl, { headers });
      let body: any = "(binary)";
      const ct = r.headers.get("content-type") ?? "";
      if (ct.includes("json") || ct.includes("html")) body = await r.text().catch(() => "(could not parse)").then(t => t.slice(0, 300));
      return {
        attachmentId: a.id,
        fileUrl,
        fetchStatus: r.status,
        responseContentType: ct,
        bodyPreview: body,
      };
    })
  );

  // 3. Also try the dedicated attachments list endpoint
  const listRes = await fetch(`${base}/api/invoices/${invoiceId}/attachments`, { headers });
  const listData = listRes.ok ? await listRes.json().catch(() => "(not json)") : `HTTP ${listRes.status}`;

  return NextResponse.json({
    invoiceId,
    imageScansFromInvoiceObject: paymentFields,
    imageScansEndpoint: scanData,
    attachmentCount: attachments.length,
  }, { status: 200 });
}
