import { Composio } from "@composio/core";

const apiKey = process.env.COMPOSIO_API_KEY;
if (!apiKey) throw new Error("COMPOSIO_API_KEY env var is required");

const composio = new Composio({ apiKey });

const trigger = await composio.triggers.create("default", "GMAIL_NEW_EMAIL", {});
console.log("Gmail trigger created:", JSON.stringify(trigger, null, 2));
console.log(
  "\nNext: set your webhook URL in the Composio dashboard → Triggers → Webhook URL",
  "\nhttps://trustclaw-jfrog-demo.vercel.app/api/agent",
);
