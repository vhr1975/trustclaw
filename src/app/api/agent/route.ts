import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import { createComposioClient } from "~/server/clients/composio";
import { gmailWebhookPayload } from "./_agent-webhook.schema";

export const maxDuration = 60;

export async function POST(request: Request) {
  const raw: unknown = await request.json();

  const parsed = gmailWebhookPayload.safeParse(raw);
  if (!parsed.success) {
    console.warn("[agent] schema mismatch:", JSON.stringify(parsed.error.issues));
    return NextResponse.json({ ok: true });
  }

  const { user_id: userId, connected_account_id: connectedAccountId } = parsed.data.metadata;
  const { thread_id: threadId, sender, subject, message_text: messageText } = parsed.data.data;

  const recipientEmail = sender.match(/<([^>]+)>/)?.[1] ?? sender;

  console.warn("[agent] incoming email | from:", sender, "| recipientEmail:", recipientEmail, "| subject:", subject, "| threadId:", threadId, "| userId:", userId, "| connectedAccountId:", connectedAccountId);

  if (!messageText) {
    console.warn("[agent] skipping: empty message_text");
    return NextResponse.json({ ok: true });
  }

  const { text: summary } = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system:
      "Summarize the following email into a single concise line. Reply with only the summary, no trailing punctuation.",
    messages: [
      {
        role: "user",
        content: `Subject: ${subject}\n\n${messageText}`,
      },
    ],
  });

  console.warn("[agent] summary generated:", summary.trim());

  const replySubject = `AGENT SUMMARY ${summary.trim()}`;
  console.warn("[agent] sending reply | to:", sender, "| subject:", replySubject, "| threadId:", threadId);

  const composio = createComposioClient();
  const result = await composio.tools.execute("GMAIL_REPLY_TO_THREAD", {
    userId,
    connectedAccountId,
    dangerouslySkipVersionCheck: true,
    arguments: {
      thread_id: threadId,
      message_body: messageText,
      subject: replySubject,
      recipient_email: recipientEmail,
    },
  });

  console.warn("[agent] Composio result:", JSON.stringify(result));

  return NextResponse.json({ ok: true });
}
