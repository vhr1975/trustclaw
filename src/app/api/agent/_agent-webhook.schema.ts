import { z } from "zod";

export const gmailWebhookPayload = z.object({
  metadata: z.object({
    user_id: z.string(),
    connected_account_id: z.string(),
  }),
  data: z.object({
    message_id: z.string(),
    thread_id: z.string(),
    sender: z.string(),
    subject: z.string().default(""),
    message_text: z.string().default(""),
  }),
});
