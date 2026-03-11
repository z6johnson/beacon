import type { LLMClient } from "../lib/llm.js";
import type { BrandMention } from "../sources/webSearch.js";
import { logger } from "../lib/logger.js";

const SYSTEM_PROMPT = `You are Beacon's brand intelligence module for UC San Diego.

Analyze web mentions of UC San Diego's AI initiatives — specifically references to "Triton AI", "TritonAI", "Triton GPT", and "TritonGPT".

Structure your briefing with these sections:

## UCSD Domain Mentions
What's being said on official ucsd.edu properties. Summarize new pages, announcements, course listings, research references. If none found, say so.

## External Coverage
Media outlets, blogs, social platforms, forums, and other external sites mentioning these initiatives. Note the source and context for each. If none found, say so.

## Analysis
What does this coverage pattern suggest? Is awareness growing? Are there mischaracterizations to address? Opportunities to amplify? What's the overall sentiment?

## Sources
List every URL found, grouped by UCSD vs external, with a one-line description of each.

Be precise. Distinguish between official UCSD usage and external references. Every claim must be traceable to a provided source.`;

export async function generateBrandBriefing(
  mentions: BrandMention[],
  llm: LLMClient,
  model: string
): Promise<string> {
  logger.info("Generating brand monitoring briefing", { mentionCount: mentions.length });

  const ucsdMentions = mentions.filter((m) => m.domain === "ucsd");
  const externalMentions = mentions.filter((m) => m.domain === "external");

  const ucsdBlock = ucsdMentions.length > 0
    ? ucsdMentions.map((m) => `- **${m.title}** (${m.source}): ${m.snippet}\n  URL: ${m.url}`).join("\n")
    : "No UCSD domain mentions found.";

  const externalBlock = externalMentions.length > 0
    ? externalMentions.map((m) => `- **${m.title}** (${m.source}): ${m.snippet}\n  URL: ${m.url}`).join("\n")
    : "No external mentions found.";

  const userMessage = `Analyze the following brand mentions found today:

**UCSD Domain Results (${ucsdMentions.length}):**
${ucsdBlock}

**External Results (${externalMentions.length}):**
${externalBlock}`;

  const response = await llm.chat.completions.create({
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });

  const briefing = response.choices[0]?.message?.content;
  if (!briefing) {
    throw new Error("LLM returned empty brand briefing");
  }

  logger.info("Brand briefing generated", { length: briefing.length });
  return briefing;
}
