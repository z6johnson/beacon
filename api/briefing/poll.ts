import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getConfig } from "../../src/config.js";
import { createNotionClient } from "../../src/lib/notion.js";
import { findPendingBriefings } from "../../src/delivery/notionWriter.js";
import { processBriefingForPage } from "../../src/engine/processBriefing.js";
import { logger } from "../../src/lib/logger.js";

const MAX_PAGES_PER_INVOCATION = 3;

function isAuthorized(req: VercelRequest, webhookSecret: string): boolean {
  // x-webhook-secret header (curl, Shortcuts)
  if (req.headers["x-webhook-secret"] === webhookSecret) return true;

  // Authorization: Bearer <secret>
  const authHeader = req.headers["authorization"];
  if (authHeader === `Bearer ${webhookSecret}`) return true;

  // Vercel Cron authentication
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers["authorization"] === `Bearer ${cronSecret}`) return true;

  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let config;
  try {
    config = getConfig();
  } catch (err) {
    logger.error("Configuration error", { error: String(err) });
    return res.status(500).json({ error: "Server configuration error" });
  }

  if (!isAuthorized(req, config.webhookSecret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  logger.info("Poll triggered");

  try {
    const notion = createNotionClient(config);
    const pendingIds = await findPendingBriefings(notion, config.notion.databaseId);

    if (pendingIds.length === 0) {
      logger.info("No pending briefings found");
      return res.status(200).json({ processed: [], message: "No pending briefings" });
    }

    const toProcess = pendingIds.slice(0, MAX_PAGES_PER_INVOCATION);
    const processed: Array<{ pageId: string; topic: string; signalsUsed: number }> = [];
    const errors: Array<{ pageId: string; error: string }> = [];

    for (const pageId of toProcess) {
      try {
        const result = await processBriefingForPage(pageId, config);
        processed.push({ pageId: result.pageId, topic: result.topic, signalsUsed: result.signalsUsed });
      } catch (err) {
        logger.error("Failed to process page", { pageId, error: String(err) });
        errors.push({ pageId, error: String(err) });
      }
    }

    const skipped = pendingIds.length - toProcess.length;
    logger.info("Poll complete", { processed: processed.length, errors: errors.length, skipped });

    return res.status(200).json({ processed, errors, skipped });
  } catch (err) {
    logger.error("Poll failed", { error: String(err) });
    return res.status(500).json({ error: "Poll failed" });
  }
}
