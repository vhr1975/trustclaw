import { z } from "zod";

export const gmailWebhookPayload = z.object({
  data: z.object({
    thread_id: z.string(),
    sender: z.string(),
    subject: z.string().default(""),
    message_text: z.string().default(""),
  }),
});
