import { generateText } from "ai";
import { NextResponse } from "next/server";
import { createComposioClient } from "~/server/clients/composio";
import { gmailWebhookPayload } from "./_agent-webhook.schema";

// Vercel default is 10s — AI call + Composio tool execution can easily exceed that.
export const maxDuration = 60;

// Composio polls Gmail every ~15–60 min and fires the webhook once per new message found,
// but can deliver the same message_id multiple times within a single poll burst.
// This Set deduplicates within a single serverless instance lifetime.
// It does NOT persist across cold starts — acceptable for this demo; a production
// implementation would use a DB-backed seen-IDs store.
const processed = new Set<string>();

export async function POST(request: Request) {
  const raw: unknown = await request.json();

  const parsed = gmailWebhookPayload.safeParse(raw);
  if (!parsed.success) {
    console.warn("[agent] schema mismatch:", JSON.stringify(parsed.error.issues));
    // Always return 200 — a non-2xx response causes Composio to retry delivery,
    // which would re-trigger the agent on malformed payloads indefinitely.
    return NextResponse.json({ ok: true });
  }

  const { user_id: userId, connected_account_id: connectedAccountId } = parsed.data.metadata;
  const { message_id: messageId, thread_id: threadId, sender, subject, message_text: messageText } = parsed.data.data;

  if (processed.has(messageId)) {
    console.warn("[agent] skipping duplicate messageId:", messageId);
    return NextResponse.json({ ok: true });
  }
  processed.add(messageId);

  // Composio rejects RFC 2822 "Name <email>" format as recipient_email.
  // Extract the bare address; fall back to the raw string if no angle brackets.
  const recipientEmail = /<([^>]+)>/.exec(sender)?.[1] ?? sender;

  console.warn("[agent] incoming email | messageId:", messageId, "| from:", sender, "| recipientEmail:", recipientEmail, "| subject:", subject, "| threadId:", threadId);

  // Guard against processing our own replies — GMAIL_SEND_EMAIL creates a new
  // message in the connected inbox, which the trigger can pick up on the next poll.
  if (subject.startsWith("AGENT SUMMARY")) {
    console.warn("[agent] skipping: agent-generated email (subject starts with AGENT SUMMARY)");
    return NextResponse.json({ ok: true });
  }

  if (!messageText) {
    console.warn("[agent] skipping: empty message_text");
    return NextResponse.json({ ok: true });
  }

  const isHtml = /<[a-z][\s\S]*>/i.test(messageText);
  const stripped = isHtml ? messageText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : messageText;
  // Composio includes the full Gmail thread in message_text. Strip quoted replies
  // ("On [date] [name] wrote:" chains and --- separators) so the body doesn't
  // snowball with each round-trip.
  const plainText = stripped
    .replace(/\s*On .{1,200}wrote:[\s\S]*/i, "")
    .replace(/\s*-{3,}[\s\S]*/g, "")
    .trim();

  const { text: summary } = await generateText({
    // Plain string = Vercel AI Gateway routing. No Anthropic API key required —
    // auth uses VERCEL_OIDC_TOKEN on Vercel deployments, AI_GATEWAY_API_KEY locally.
    model: "anthropic/claude-haiku-4-5-20251001",
    system:
      "Summarize the following email into a single concise line. Reply with only the summary, no trailing punctuation.",
    messages: [
      {
        role: "user",
        // Cap at 3000 chars to stay within Anthropic free-tier token rate limits.
        content: `Subject: ${subject}\n\n${plainText.slice(0, 3000)}`,
      },
    ],
  });

  console.warn("[agent] summary generated:", summary.trim());

  const replySubject = `AGENT SUMMARY ${summary.trim()}`;
  console.warn("[agent] sending reply | to:", recipientEmail, "| subject:", replySubject);

  const composio = createComposioClient();
  const result = await composio.tools.execute("GMAIL_SEND_EMAIL", {
    userId,
    connectedAccountId,
    // SDK v0.6.3 requires an explicit toolkit version when executing tools.
    // This flag bypasses that check. The alternative is upgrading to v0.10+,
    // which has breaking API changes not yet reflected in TrustClaw's client wrapper.
    dangerouslySkipVersionCheck: true,
    arguments: {
      recipient_email: recipientEmail,
      subject: replySubject,
      body: `AGENT SUMMARY: ${summary.trim()}\n\n---\n\n${plainText}`,
      // Must be false — we stripped HTML above. Composio validates that HTML bodies
      // have is_html: true and will error if the flag doesn't match the content.
      is_html: false,
    },
  });

  console.warn("[agent] Composio result:", JSON.stringify(result));

  return NextResponse.json({ ok: true });
}
