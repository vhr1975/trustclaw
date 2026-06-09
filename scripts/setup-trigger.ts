// One-time script to register the GMAIL_NEW_GMAIL_MESSAGE polling trigger for a
// connected Gmail account. Run once after deploying; the trigger persists in
// Composio and survives redeployments.
//
// Usage:
//   COMPOSIO_API_KEY=<key> npx tsx scripts/setup-trigger.ts
//
// After running, set the webhook URL in the Composio dashboard:
//   Settings → Webhooks → https://<your-vercel-url>/api/agent

const apiKey = process.env.COMPOSIO_API_KEY;
if (!apiKey) throw new Error("COMPOSIO_API_KEY env var is required");

// The connected account ID for the Gmail account to monitor.
// Find this in the Composio dashboard under Toolkits → Gmail → Connected Accounts.
const connectedAccountId = "ca_Utj1r3_GcCcq";

const res = await fetch(
  "https://backend.composio.dev/api/v3/trigger_instances/GMAIL_NEW_GMAIL_MESSAGE/upsert",
  {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      connected_account_id: connectedAccountId,
      // trigger_config must be present even if empty — the API rejects requests
      // that omit it entirely, despite the field being optional in the docs.
      trigger_config: {},
    }),
  },
);

const data = await res.text();
process.stdout.write(`Status: ${res.status}\n${data}\n`);
