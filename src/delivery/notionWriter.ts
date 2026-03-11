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

export function splitBriefingSections(
  markdown: string
): Array<{ title: string; body: string }> {
  const sections: Array<{ title: string; body: string }> = [];
  const parts = markdown.split(/^## /m);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const newlineIdx = trimmed.indexOf("\n");
    if (newlineIdx === -1) {
      sections.push({ title: trimmed, body: "" });
    } else {
      sections.push({
        title: trimmed.slice(0, newlineIdx).trim(),
        body: trimmed.slice(newlineIdx + 1).trim(),
      });
    }
  }

  return sections;
}

export async function appendBriefing(
  notion: Client,
  pageId: string,
  briefingMarkdown: string,
  prefix: string = "Beacon"
): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const tagPrefix = `${prefix} ${today}`;

  // Check for existing briefing today (idempotency)
  const existing = await notion.blocks.children.list({ block_id: pageId });
  const alreadyBriefed = existing.results.some((block) => {
    if ("type" in block && block.type === "child_page") {
      return block.child_page.title.startsWith(tagPrefix);
    }
    return false;
  });

  if (alreadyBriefed) {
    logger.info("Briefing already exists for today, skipping", { pageId, prefix, date: today });
    return;
  }

  // Split markdown into sections and create a child page per section
  const sections = splitBriefingSections(briefingMarkdown);

  for (const section of sections) {
    const pageTitle = `${tagPrefix} — ${section.title}`;

    const newPage = await notion.pages.create({
      parent: { page_id: pageId },
      properties: {
        title: [{ text: { content: pageTitle } }],
      },
    });

    if (section.body) {
      const contentBlocks = markdownToNotionBlocks(section.body);
      await notion.blocks.children.append({
        block_id: newPage.id,
        children: contentBlocks,
      });
    }

    logger.info("Created briefing child page", { pageTitle, parentPageId: pageId });
  }

  logger.info("Briefing appended to Notion page", { pageId, prefix, date: today, sectionCount: sections.length });
}

export async function findPendingBriefings(
  notion: Client,
  databaseId: string
): Promise<string[]> {
  logger.info("Querying for pending briefings", { databaseId });

  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: "Generate Briefing",
      checkbox: { equals: true },
    },
  });

  const pageIds = response.results.map((page) => page.id);
  logger.info("Found pending briefings", { count: pageIds.length });
  return pageIds;
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
