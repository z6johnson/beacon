import type { LLMClient } from "../lib/llm.js";
import type { FogBellSignal } from "../sources/fogbell.js";
import { logger } from "../lib/logger.js";

interface ScoredSignal {
  signal: FogBellSignal;
  score: number;
}

function keywordMatch(signal: FogBellSignal, topic: string): boolean {
  const topicLower = topic.toLowerCase();
  const keywords = topicLower.split(/\s+/).filter((w) => w.length > 3);

  const searchText = `${signal.title} ${signal.summary} ${(signal.topics || []).join(" ")}`.toLowerCase();

  return keywords.some((kw) => searchText.includes(kw));
}

export async function filterSignalsByRelevance(
  signals: FogBellSignal[],
  topic: string,
  llm: LLMClient,
  model: string,
  maxResults: number = 10
): Promise<FogBellSignal[]> {
  // First pass: keyword filtering
  const candidates = signals.filter((s) => keywordMatch(s, topic));
  logger.info("Keyword filter pass", {
    total: signals.length,
    candidates: candidates.length,
    topic,
  });

  if (candidates.length === 0) {
    // Fall back to top signals by their existing relevance score
    logger.warn("No keyword matches, falling back to top signals by score");
    return signals
      .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0))
      .slice(0, maxResults);
  }

  // If few enough candidates, skip LLM scoring
  if (candidates.length <= maxResults) {
    return candidates;
  }

  // Second pass: LLM relevance scoring
  const signalSummaries = candidates.map((s, i) => `[${i}] ${s.title}: ${s.summary}`).join("\n");

  const response = await llm.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          "You are a relevance scorer. Given a workshop topic and a list of news signals, rate each signal's relevance to the topic on a 0-10 scale. Respond with ONLY a JSON array of objects: [{\"index\": 0, \"score\": 7}, ...]",
      },
      {
        role: "user",
        content: `Workshop topic: "${topic}"\n\nSignals:\n${signalSummaries}`,
      },
    ],
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content ?? "[]";
  let scores: Array<{ index: number; score: number }>;
  try {
    scores = JSON.parse(content);
  } catch {
    logger.warn("Failed to parse LLM relevance scores, using keyword matches", {
      rawResponse: content,
    });
    return candidates.slice(0, maxResults);
  }

  const scored: ScoredSignal[] = scores
    .filter((s) => s.index >= 0 && s.index < candidates.length)
    .map((s) => ({ signal: candidates[s.index], score: s.score }));

  scored.sort((a, b) => b.score - a.score);

  const results = scored.slice(0, maxResults).map((s) => s.signal);
  logger.info("LLM relevance scoring complete", { scoredCount: scored.length, returned: results.length });
  return results;
}
