import { z } from "zod";

// Composio v3 webhook payload shape — discovered from live webhook inspection.
// The documented examples show a different structure; this reflects the actual
// payload fired by GMAIL_NEW_GMAIL_MESSAGE as of @composio/core v0.6.3.
export const gmailWebhookPayload = z.object({
  metadata: z.object({
    user_id: z.string(),
    connected_account_id: z.string(),
  }),
  data: z.object({
    message_id: z.string(),
    thread_id: z.string(),
    sender: z.string(),
    // Composio omits subject and message_text for some email types (e.g. calendar
    // invites, delivery receipts). Default to empty string rather than failing.
    subject: z.string().default(""),
    message_text: z.string().default(""),
  }),
});
