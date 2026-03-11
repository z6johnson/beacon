import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getConfig } from "../../src/config.js";
import { processBriefingForPage } from "../../src/engine/processBriefing.js";
import { logger } from "../../src/lib/logger.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Authenticate webhook
  let config;
  try {
    config = getConfig();
  } catch (err) {
    logger.error("Configuration error", { error: String(err) });
    return res.status(500).json({ error: "Server configuration error" });
  }

  const secret = req.headers["x-webhook-secret"];
  if (secret !== config.webhookSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Validate request body
  const { pageId } = req.body as { pageId?: string };
  if (!pageId || typeof pageId !== "string") {
    return res.status(400).json({ error: "Missing required field: pageId" });
  }

  logger.info("Briefing generation triggered", { pageId });

  try {
    const result = await processBriefingForPage(pageId, config);
    return res.status(200).json({ success: true, topic: result.topic, signalsUsed: result.signalsUsed, brandMentions: result.brandMentions });
  } catch (err) {
    logger.error("Briefing generation failed", { pageId, error: String(err) });
    return res.status(500).json({ error: "Briefing generation failed" });
  }
}
