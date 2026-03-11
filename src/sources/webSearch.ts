import { logger } from "../lib/logger.js";

export interface BrandMention {
  title: string;
  snippet: string;
  url: string;
  source: string;
  date: string;
  domain: "ucsd" | "external";
  matchedTerm: string;
}

const SEARCH_TERMS = [
  '"triton ai"',
  '"tritonai"',
  '"triton gpt"',
  '"tritongpt"',
];

const TERMS_QUERY = SEARCH_TERMS.join(" OR ");

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
  page_age?: string;
  meta_url?: { hostname?: string };
}

interface BraveSearchResponse {
  web?: { results?: BraveSearchResult[] };
}

async function braveSearch(
  query: string,
  apiKey: string,
  count: number = 20
): Promise<BraveSearchResult[]> {
  const params = new URLSearchParams({ q: query, count: String(count) });
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!res.ok) {
    throw new Error(`Brave Search failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as BraveSearchResponse;
  return data.web?.results ?? [];
}

function detectMatchedTerm(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("tritongpt") || lower.includes("triton gpt")) return "triton gpt";
  if (lower.includes("tritonai") || lower.includes("triton ai")) return "triton ai";
  return "triton";
}

export async function searchBrandMentions(apiKey: string): Promise<BrandMention[]> {
  logger.info("Searching for brand mentions");

  const [ucsdResults, globalResults] = await Promise.all([
    braveSearch(`site:ucsd.edu ${TERMS_QUERY}`, apiKey),
    braveSearch(`${TERMS_QUERY} -site:ucsd.edu`, apiKey),
  ]);

  const mentions: BrandMention[] = [];

  for (const r of ucsdResults) {
    mentions.push({
      title: r.title,
      snippet: r.description,
      url: r.url,
      source: r.meta_url?.hostname ?? new URL(r.url).hostname,
      date: r.page_age ?? "",
      domain: "ucsd",
      matchedTerm: detectMatchedTerm(`${r.title} ${r.description}`),
    });
  }

  for (const r of globalResults) {
    mentions.push({
      title: r.title,
      snippet: r.description,
      url: r.url,
      source: r.meta_url?.hostname ?? new URL(r.url).hostname,
      date: r.page_age ?? "",
      domain: "external",
      matchedTerm: detectMatchedTerm(`${r.title} ${r.description}`),
    });
  }

  logger.info("Brand mention search complete", {
    ucsd: ucsdResults.length,
    external: globalResults.length,
    total: mentions.length,
  });

  return mentions;
}
