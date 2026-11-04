// POST /api/suggest - a visitor suggests a topic (the website's "Suggest a topic" form).
// Stores {topic, details, name, lang, at}; the factory's listener line reads them through
// /api/suggestions. No IP address is stored: only a salted hash, for one hour, to rate-limit.

const crypto = require("node:crypto");
const { KEY, redis } = require("./_store");

const PER_HOUR = 5; // submissions per visitor and hour

function clean(value, limit) {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, limit);
}

// A browser sends Origin with a POST; it must be this site (other clients send none).
function sameSite(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false; // "null" and other unparsable origins
  }
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method not allowed" });
  }
  if (!sameSite(req)) return res.status(403).json({ error: "cross-site request refused" });
  const body = req.body && typeof req.body === "object" ? req.body : {};
  if (body.website) return res.status(201).json({ ok: true }); // the hidden spam trap
  const topic = clean(body.topic, 200);
  if (topic.length < 3) return res.status(400).json({ error: "topic" });
  const item = {
    topic,
    details: clean(body.details, 1000),
    name: clean(body.name, 60),
    lang: body.lang === "fa" ? "fa" : "en",
    at: new Date().toISOString(),
  };
  try {
    const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
    const salt = process.env.SUGGESTIONS_TOKEN || "";
    const visitor = crypto.createHash("sha256").update(salt + ip).digest("hex").slice(0, 32);
    const rate = `rate:${visitor}`;
    const [count] = await redis([["INCR", rate], ["EXPIRE", rate, 3600, "NX"]]);
    if (count > PER_HOUR) return res.status(429).json({ error: "too many" });
    await redis([["RPUSH", KEY, JSON.stringify(item)]]);
  } catch (err) {
    console.error("suggest:", err);
    return res.status(503).json({ error: "unavailable" });
  }
  return res.status(201).json({ ok: true });
};
