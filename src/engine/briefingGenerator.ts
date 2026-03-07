import type { LLMClient } from "../lib/llm.js";
import type { FogBellSignal, FogBellStoryline } from "../sources/fogbell.js";
import { logger } from "../lib/logger.js";

const SYSTEM_PROMPT = `You are Beacon, an intelligence briefing agent for a higher education AI strategy team at UC San Diego.

Your job is to produce a concise, actionable pre-workshop briefing. The briefing should help workshop facilitators understand the current landscape relevant to their topic, anticipate questions, and identify strategic angles.

Structure your briefing with these sections:

## Key Signals
Summarize the most relevant recent signals (news, developments, announcements). For each, include what happened and why it matters for this workshop.

## Developing Storylines
Identify broader trends or narratives these signals connect to. What patterns should the facilitator be aware of?

## Assumptions to Challenge
Based on the signals, what common assumptions about this topic might be outdated or wrong? What might workshop participants believe that the evidence contradicts?

## Suggested Angles
Recommend 2-3 specific angles, questions, or discussion prompts the facilitator could use to make the workshop more relevant given recent developments.

Keep the tone direct and analytical. Avoid filler. Every sentence should carry information or insight.`;

export async function generateBriefing(
  topic: string,
  signals: FogBellSignal[],
  storylines: FogBellStoryline[],
  llm: LLMClient,
  model: string
): Promise<string> {
  logger.info("Generating briefing", { topic, signalCount: signals.length, storylineCount: storylines.length });

  const signalBlock = signals
    .map((s) => `- **${s.title}** (${s.source}): ${s.summary}`)
    .join("\n");

  const storylineBlock = storylines
    .map((s) => `- **${s.title}** (${s.signalCount} signals): ${s.summary}`)
    .join("\n");

  const userMessage = `Generate a pre-workshop briefing for the following:

**Workshop Topic:** ${topic}

**Recent Signals:**
${signalBlock || "No signals available."}

**Developing Storylines:**
${storylineBlock || "No storylines available."}`;

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
    throw new Error("LLM returned empty briefing");
  }

  logger.info("Briefing generated", { length: briefing.length });
  return briefing;
}
