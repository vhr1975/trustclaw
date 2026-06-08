import { z } from "zod";

export const gmailWebhookPayload = z.object({
  payload: z.object({
    threadId: z.string(),
    sender: z.string(),
    subject: z.string().default(""),
    messageText: z.string().default(""),
  }),
});
