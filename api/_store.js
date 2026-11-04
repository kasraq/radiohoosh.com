// Shared by the two functions: the Upstash Redis REST API (Vercel's Redis integration sets
// KV_REST_API_URL/KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN).
// Files starting with "_" are not deployed as functions of their own.

const KEY = "suggestions"; // a list; an item's id is its position + 1

function config() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("no Redis store connected to this project");
  return { url: url.replace(/\/$/, ""), token };
}

// Runs the commands in one request; returns each command's result.
async function redis(commands) {
  const { url, token } = config();
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(commands),
  });
  if (!response.ok) throw new Error(`Redis HTTP ${response.status}`);
  const answers = await response.json();
  return answers.map((a) => {
    if (a.error) throw new Error(`Redis: ${a.error}`);
    return a.result;
  });
}

module.exports = { KEY, redis };
