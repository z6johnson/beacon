import { Client } from "@notionhq/client";

const WORKSPACE_PAGE_ID = process.env.NOTION_WORKSPACE_PAGE_ID || "11a94bc5-c952-81cd-bfb2-00037c214b9f";

async function main() {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.error("Error: NOTION_TOKEN environment variable is required");
    console.error("Usage: NOTION_TOKEN=secret_... npx tsx scripts/setup-notion.ts");
    process.exit(1);
  }

  const notion = new Client({ auth: token });

  console.log("Creating Beacon Workshops database...\n");

  // Create the workshop database
  const database = await notion.databases.create({
    parent: { type: "page_id", page_id: WORKSPACE_PAGE_ID },
    title: [
      {
        type: "text",
        text: { content: "Beacon Workshops" },
      },
    ],
    properties: {
      Name: {
        title: {},
      },
      Topic: {
        rich_text: {},
      },
      Date: {
        date: {},
      },
      Status: {
        select: {
          options: [
            { name: "Planning", color: "gray" },
            { name: "Prep", color: "yellow" },
            { name: "Ready", color: "green" },
            { name: "Complete", color: "blue" },
          ],
        },
      },
      "Generate Briefing": {
        checkbox: {},
      },
    },
  });

  console.log(`Database created successfully!`);
  console.log(`  Database ID: ${database.id}`);
  console.log(`  URL: ${database.url}\n`);

  // Create a sample workshop page
  const sampleDate = new Date();
  sampleDate.setDate(sampleDate.getDate() + 14); // 2 weeks from now

  const samplePage = await notion.pages.create({
    parent: { database_id: database.id },
    properties: {
      Name: {
        title: [
          {
            type: "text",
            text: { content: "AI Governance in Higher Education" },
          },
        ],
      },
      Topic: {
        rich_text: [
          {
            type: "text",
            text: {
              content:
                "Institutional AI governance frameworks, responsible AI policies, faculty guidelines for AI use in teaching and research",
            },
          },
        ],
      },
      Date: {
        date: { start: sampleDate.toISOString().split("T")[0] },
      },
      Status: {
        select: { name: "Planning" },
      },
      "Generate Briefing": {
        checkbox: false,
      },
    },
  });

  console.log(`Sample workshop page created!`);
  console.log(`  Page ID: ${samplePage.id}`);
  console.log(`  URL: ${samplePage.url}\n`);

  console.log("--- Setup Complete ---\n");
  console.log("Next steps:");
  console.log(`1. Set NOTION_DATABASE_ID=${database.id} in your Vercel env vars`);
  console.log("2. Open the database in Notion and verify the properties");
  console.log("3. Check the 'Generate Briefing' box on a workshop, then trigger via:");
  console.log(`   curl -H "x-webhook-secret: YOUR_SECRET" https://your-beacon-url.vercel.app/api/briefing/poll`);
  console.log("   (See docs/notion-automation-setup.md for more trigger options)");
}

main().catch((err) => {
  console.error("Setup failed:", err.message || err);
  process.exit(1);
});
