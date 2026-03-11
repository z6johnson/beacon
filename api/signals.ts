import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getConfig } from "../src/config.js";
import { FogBellClient } from "../src/sources/fogbell.js";
import { filterSignalsByRelevance } from "../src/engine/relevanceFilter.js";
import { createLLMClient } from "../src/lib/llm.js";
import { logger } from "../src/lib/logger.js";

function toLevel(score: number): string {
  if (score > 7) return "high";
  if (score > 4) return "medium";
  return "low";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let config;
  try {
    config = getConfig();
  } catch (err) {
    logger.error("Configuration error", { error: String(err) });
    return res.status(500).json({ error: "Server configuration error" });
  }

  // Authenticate
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (token !== config.webhookSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const topic = typeof req.query.topic === "string" ? req.query.topic : undefined;

  try {
    const fogbell = new FogBellClient(config.fogbell);
    let signals = await fogbell.getSignals();

    if (topic) {
      const llm = createLLMClient(config);
      signals = await filterSignalsByRelevance(signals, topic, llm, config.litellm.model, 5);
    } else {
      signals = signals
        .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
        .slice(0, 5);
    }

    const payload = {
      signals: signals.map((s) => ({
        title: s.title,
        summary: s.summary,
        source: s.source,
        level: toLevel(s.relevanceScore ?? 0),
        date: s.publishedAt,
        url: s.url,
      })),
    };

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=60");
    return res.status(200).json(payload);
  } catch (err) {
    logger.error("Signals fetch failed", { error: String(err) });
    return res.status(500).json({ error: "Failed to fetch signals" });
  }
}
