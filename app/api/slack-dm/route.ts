export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

// Sends a Slack DM that appears to come from the AP team member who clicked Send.
// Uses chat:write.customize scope so the bot posts with the sender's name + avatar.
// Required env vars: SLACK_BOT_TOKEN
export async function POST(req: NextRequest) {
  const { recipientEmail, message, senderName } = await req.json();
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return NextResponse.json({ error: "SLACK_BOT_TOKEN not configured" }, { status: 500 });

  // 1. Look up recipient's Slack user ID by email
  const lookup = await fetch(
    `https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(recipientEmail)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const { ok, user, error: lookupErr } = await lookup.json();
  if (!ok) return NextResponse.json({ error: lookupErr ?? `Could not find Slack user for ${recipientEmail}` }, { status: 400 });

  // 2. Post DM — displayed as the sender's name (requires chat:write.customize scope)
  const send = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      channel: user.id,
      text: message,
      username: senderName,   // shows as sender's name in Slack, not "bot"
      icon_emoji: ":wave:",   // friendly avatar
    }),
  });
  const result = await send.json();
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true });
}
