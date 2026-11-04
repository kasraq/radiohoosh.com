// GET /api/suggestions?since=<id> - the factory's listener line reads new suggestions.
// Needs "Authorization: Bearer <SUGGESTIONS_TOKEN>". Answers {"items": [{id, topic, details,
// name, lang, at}], "next": <id to pass as since next time>}, at most 100 items per call.

const crypto = require("node:crypto");
const { KEY, redis } = require("./_store");

const PAGE = 100;

function authorized(req) {
  const token = process.env.SUGGESTIONS_TOKEN || "";
  const given = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (token.length < 16 || given.length !== token.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(token));
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "method not allowed" });
  }
  if (!authorized(req)) return res.status(401).json({ error: "unauthorized" });
  const since = Math.max(0, Number.parseInt(String(req.query.since || "0"), 10) || 0);
  let rows;
  try {
    [rows] = await redis([["LRANGE", KEY, since, since + PAGE - 1]]);
  } catch (err) {
    console.error("suggestions:", err);
    return res.status(503).json({ error: "unavailable" });
  }
  const items = [];
  rows.forEach((raw, i) => {
    try {
      items.push({ id: since + i + 1, ...JSON.parse(raw) });
    } catch {
      // a damaged row is skipped, its id still counts
    }
  });
  return res.status(200).json({ items, next: since + rows.length });
};
