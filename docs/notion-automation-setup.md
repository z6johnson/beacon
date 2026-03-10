# Triggering Beacon Briefings

Beacon generates briefings for any workshop page with the **"Generate Briefing"** checkbox checked. There are several ways to trigger the scan.

## Prerequisites

- Beacon deployed on Vercel (see [docs/deploy.md](deploy.md))
- "Beacon Workshops" database created (via `scripts/setup-notion.ts`)
- `NOTION_DATABASE_ID` set in Vercel env vars (printed by the setup script)
- Your `WEBHOOK_SECRET` value (the same one set in Vercel env vars)

## How It Works

1. Check the **"Generate Briefing"** box on one or more workshop pages in Notion
2. Trigger the poll endpoint using any method below
3. Beacon finds all checked pages, generates briefings, and unchecks the boxes

## Trigger Methods

### curl (simplest)

```bash
curl -H "x-webhook-secret: YOUR_SECRET" \
  https://your-beacon-url.vercel.app/api/briefing/poll
```

### Browser Bookmark

Create a bookmark with this URL (replace values):

```
javascript:void(fetch('https://your-beacon-url.vercel.app/api/briefing/poll',{headers:{'x-webhook-secret':'YOUR_SECRET'}}))
```

Check the box in Notion, click the bookmark, done.

### iOS/macOS Shortcut

Create a Shortcut with a **Get Contents of URL** action:
- URL: `https://your-beacon-url.vercel.app/api/briefing/poll`
- Method: GET
- Headers: `x-webhook-secret` = your `WEBHOOK_SECRET`

### Direct Page Trigger

If you know the page ID and want to skip the database scan, the original webhook endpoint still works:

```bash
curl -X POST \
  -H "x-webhook-secret: YOUR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"pageId": "your-page-id"}' \
  https://your-beacon-url.vercel.app/api/briefing/generate
```

## Why Not Notion Automations?

Notion's **Send webhook** automation action [requires a paid plan](https://www.notion.com/help/webhook-actions) (Plus or higher). The poll endpoint works entirely through the Notion API (`databases.query`), which is available on all plans including free.

## Testing

1. Open any workshop in the Beacon Workshops database
2. Check the **"Generate Briefing"** checkbox
3. Trigger the poll endpoint using any method above
4. The checkbox will uncheck itself (beacon resets the trigger)
5. A **"Beacon Briefing"** callout block should appear at the bottom of the workshop page

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Checkbox stays checked | Beacon didn't run or failed | Check Vercel function logs |
| 401 error | Secret mismatch | Verify `x-webhook-secret` header matches `WEBHOOK_SECRET` env var |
| 404 from Notion API | Integration not connected | Share the workspace page with the Beacon integration (see deploy.md) |
| "No pending briefings" | No boxes checked, or wrong database ID | Verify `NOTION_DATABASE_ID` points to the correct database |
| No callout appears | Briefing already exists for today | Each workshop gets one briefing per day (idempotency) |
| Empty briefing | FogBell returned no signals | Check FogBell credentials and that the API is reachable |
