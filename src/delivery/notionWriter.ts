import type { Client } from "@notionhq/client";
import { logger } from "../lib/logger.js";

export interface WorkshopContext {
  pageId: string;
  title: string;
  properties: Record<string, string>;
}

export async function readWorkshopContext(
  notion: Client,
  pageId: string
): Promise<WorkshopContext> {
  logger.info("Reading workshop context from Notion", { pageId });

  const page = await notion.pages.retrieve({ page_id: pageId });

  if (!("properties" in page)) {
    throw new Error("Retrieved Notion page has no properties");
  }

  let title = "";
  const properties: Record<string, string> = {};

  for (const [key, prop] of Object.entries(page.properties)) {
    if (prop.type === "title" && prop.title.length > 0) {
      title = prop.title.map((t) => t.plain_text).join("");
    } else if (prop.type === "rich_text" && prop.rich_text.length > 0) {
      properties[key] = prop.rich_text.map((t) => t.plain_text).join("");
    } else if (prop.type === "select" && prop.select) {
      properties[key] = prop.select.name;
    } else if (prop.type === "multi_select") {
      properties[key] = prop.multi_select.map((s) => s.name).join(", ");
    }
  }

  logger.info("Workshop context loaded", { title, propertyCount: Object.keys(properties).length });
  return { pageId, title, properties };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function markdownToNotionBlocks(markdown: string): any[] {
  const blocks: any[] = [];
  const lines = markdown.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("## ")) {
      blocks.push({
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [{ type: "text", text: { content: trimmed.slice(3) } }],
        },
      });
    } else if (trimmed.startsWith("### ")) {
      blocks.push({
        object: "block",
        type: "heading_3",
        heading_3: {
          rich_text: [{ type: "text", text: { content: trimmed.slice(4) } }],
        },
      });
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: {
          rich_text: [{ type: "text", text: { content: trimmed.slice(2) } }],
        },
      });
    } else {
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: trimmed } }],
        },
      });
    }
  }

  return blocks;
}

export async function appendBriefing(
  notion: Client,
  pageId: string,
  briefingMarkdown: string
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];

  // Check for existing briefing today (idempotency)
  const existing = await notion.blocks.children.list({ block_id: pageId });
  const alreadyBriefed = existing.results.some((block) => {
    if ("type" in block && block.type === "callout" && "callout" in block) {
      const text = block.callout.rich_text
        .map((t) => ("plain_text" in t ? t.plain_text : ""))
        .join("");
      return text.includes(`Beacon Briefing — ${today}`);
    }
    return false;
  });

  if (alreadyBriefed) {
    logger.info("Briefing already exists for today, skipping", { pageId, date: today });
    return;
  }

  // Build callout block with briefing content as children
  const contentBlocks = markdownToNotionBlocks(briefingMarkdown);

  const calloutBlock = {
    object: "block" as const,
    type: "callout" as const,
    callout: {
      rich_text: [
        {
          type: "text" as const,
          text: { content: `Beacon Briefing — ${today}` },
          annotations: { bold: true },
        },
      ],
      icon: { type: "emoji" as const, emoji: "📡" as const },
      children: contentBlocks,
    },
  };

  await notion.blocks.children.append({
    block_id: pageId,
    children: [calloutBlock],
  });

  logger.info("Briefing appended to Notion page", { pageId, date: today });
}

export async function resetTrigger(
  notion: Client,
  pageId: string,
  propertyName: string = "Generate Briefing"
): Promise<void> {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [propertyName]: { checkbox: false },
    },
  });

  logger.info("Reset trigger checkbox", { pageId, propertyName });
}
