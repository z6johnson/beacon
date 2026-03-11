import type { Config } from "../config.js";
import { FogBellClient } from "../sources/fogbell.js";
import { createLLMClient } from "../lib/llm.js";
import { createNotionClient } from "../lib/notion.js";
import { readWorkshopContext, appendBriefing, resetTrigger } from "../delivery/notionWriter.js";
import { filterSignalsByRelevance } from "./relevanceFilter.js";
import { generateBriefing } from "./briefingGenerator.js";
import { generateBrandBriefing } from "./brandBriefingGenerator.js";
import { searchBrandMentions } from "../sources/webSearch.js";
import { logger } from "../lib/logger.js";

export interface ProcessResult {
  pageId: string;
  topic: string;
  signalsUsed: number;
  brandMentions: number;
  skipped: boolean;
}

export async function processBriefingForPage(
  pageId: string,
  config: Config
): Promise<ProcessResult> {
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

  // 5. Deliver topic briefing to Notion
  await appendBriefing(notion, pageId, briefingMarkdown);

  // 6. Brand monitoring (if Brave API key is configured)
  let brandMentionCount = 0;
  if (config.braveApiKey) {
    try {
      const mentions = await searchBrandMentions(config.braveApiKey);
      brandMentionCount = mentions.length;
      if (mentions.length > 0) {
        const brandBriefing = await generateBrandBriefing(mentions, llm, config.litellm.model);
        await appendBriefing(notion, pageId, brandBriefing, "Brand Watch");
      } else {
        logger.info("No brand mentions found, skipping brand briefing");
      }
    } catch (err) {
      logger.error("Brand monitoring failed, continuing without it", { error: String(err) });
    }
  }

  // 7. Reset trigger
  await resetTrigger(notion, pageId);

  logger.info("Briefing generation complete", { pageId, topic, brandMentionCount });
  return { pageId, topic, signalsUsed: relevantSignals.length, brandMentions: brandMentionCount, skipped: false };
}
