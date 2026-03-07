import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getConfig } from "../../src/config.js";
import { FogBellClient } from "../../src/sources/fogbell.js";
import { createLLMClient } from "../../src/lib/llm.js";
import { createNotionClient } from "../../src/lib/notion.js";
import { readWorkshopContext, appendBriefing, resetTrigger } from "../../src/delivery/notionWriter.js";
import { filterSignalsByRelevance } from "../../src/engine/relevanceFilter.js";
import { generateBriefing } from "../../src/engine/briefingGenerator.js";
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
    // Initialize clients
    const fogbell = new FogBellClient(config.fogbell);
    const llm = createLLMClient(config);
    const notion = createNotionClient(config);

    // 1. Read workshop context from Notion
    const workshop = await readWorkshopContext(notion, pageId);
    const topic = workshop.title;
    logger.info("Workshop topic identified", { topic });

    // 2. Gather intelligence from FogBell
    const [signals, storylines] = await Promise.all([
      fogbell.getSignals(),
      fogbell.getStorylines(),
    ]);

    // 3. Filter signals for relevance
    const relevantSignals = await filterSignalsByRelevance(
      signals,
      topic,
      llm,
      config.litellm.model
    );

    // 4. Generate briefing
    const briefingMarkdown = await generateBriefing(
      topic,
      relevantSignals,
      storylines,
      llm,
      config.litellm.model
    );

    // 5. Deliver to Notion
    await appendBriefing(notion, pageId, briefingMarkdown);

    // 6. Reset trigger
    await resetTrigger(notion, pageId);

    logger.info("Briefing generation complete", { pageId, topic });
    return res.status(200).json({ success: true, topic, signalsUsed: relevantSignals.length });
  } catch (err) {
    logger.error("Briefing generation failed", { pageId, error: String(err) });
    return res.status(500).json({ error: "Briefing generation failed" });
  }
}
