const apiKey = process.env.COMPOSIO_API_KEY;
if (!apiKey) throw new Error("COMPOSIO_API_KEY env var is required");

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
      trigger_config: {},
    }),
  },
);

const data = await res.text();
process.stdout.write(`Status: ${res.status}\n${data}\n`);
