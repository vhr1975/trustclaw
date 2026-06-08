import { generateText } from "ai";
import { NextResponse } from "next/server";
import { createComposioClient } from "~/server/clients/composio";
import { gmailWebhookPayload } from "./_agent-webhook.schema";

export const maxDuration = 60;

export async function POST(request: Request) {
  const parsed = gmailWebhookPayload.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: true });
  }

  const { threadId, sender, subject, messageText } = parsed.data.payload;

  if (!messageText) {
    return NextResponse.json({ ok: true });
  }

  const { text: summary } = await generateText({
    model: "anthropic/claude-haiku-4-5-20251001",
    system:
      "Summarize the following email into a single concise line. Reply with only the summary, no trailing punctuation.",
    messages: [
      {
        role: "user",
        content: `Subject: ${subject}\n\n${messageText}`,
      },
    ],
  });

  const composio = createComposioClient();
  await composio.tools.execute("GMAIL_REPLY_TO_THREAD", {
    userId: "default",
    arguments: {
      thread_id: threadId,
      message_body: messageText,
      subject: `AGENT SUMMARY ${summary.trim()}`,
      recipient_email: sender,
    },
  });

  return NextResponse.json({ ok: true });
}
