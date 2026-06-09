import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { createComposioClient } from "~/server/clients/composio";
import { gmailWebhookPayload } from "./_agent-webhook.schema";

export const maxDuration = 60;

const processed = new Set<string>();

export async function POST(request: Request) {
  const raw: unknown = await request.json();

  const parsed = gmailWebhookPayload.safeParse(raw);
  if (!parsed.success) {
    console.warn("[agent] schema mismatch:", JSON.stringify(parsed.error.issues));
    return NextResponse.json({ ok: true });
  }

  const { user_id: userId, connected_account_id: connectedAccountId } = parsed.data.metadata;
  const { message_id: messageId, thread_id: threadId, sender, subject, message_text: messageText } = parsed.data.data;

  if (processed.has(messageId)) {
    console.warn("[agent] skipping duplicate messageId:", messageId);
    return NextResponse.json({ ok: true });
  }
  processed.add(messageId);

  const recipientEmail = /<([^>]+)>/.exec(sender)?.[1] ?? sender;

  console.warn("[agent] incoming email | messageId:", messageId, "| from:", sender, "| recipientEmail:", recipientEmail, "| subject:", subject, "| threadId:", threadId);

  if (!messageText) {
    console.warn("[agent] skipping: empty message_text");
    return NextResponse.json({ ok: true });
  }

  const isHtml = /<[a-z][\s\S]*>/i.test(messageText);
  const plainText = isHtml ? messageText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : messageText;

  const { text: summary } = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system:
      "Summarize the following email into a single concise line. Reply with only the summary, no trailing punctuation.",
    messages: [
      {
        role: "user",
        content: `Subject: ${subject}\n\n${messageText.slice(0, 3000)}`,
      },
    ],
  });

  console.warn("[agent] summary generated:", summary.trim());

  const replySubject = `AGENT SUMMARY ${summary.trim()}`;
  console.warn("[agent] sending reply | to:", recipientEmail, "| subject:", replySubject, "| isHtml:", isHtml);

  const composio = createComposioClient();
  const result = await composio.tools.execute("GMAIL_SEND_EMAIL", {
    userId,
    connectedAccountId,
    dangerouslySkipVersionCheck: true,
    arguments: {
      recipient_email: recipientEmail,
      subject: replySubject,
      body: `AGENT SUMMARY: ${summary.trim()}\n\n---\n\n${plainText}`,
      is_html: false,
    },
  });

  console.warn("[agent] Composio result:", JSON.stringify(result));

  return NextResponse.json({ ok: true });
}
