# Notion Automation Setup

The Notion API cannot create automations programmatically — this is the one manual step. Follow these instructions after deploying beacon to Vercel and running the database setup script.

## Prerequisites

- Beacon deployed on Vercel (see [docs/deploy.md](deploy.md))
- "Beacon Workshops" database created (via `scripts/setup-notion.ts`)
- Your beacon deployment URL (e.g. `https://beacon-xyz.vercel.app`)
- Your `WEBHOOK_SECRET` value (the same one set in Vercel env vars)

## Steps

### 1. Open the database

Navigate to the **Beacon Workshops** database in your Notion workspace.

### 2. Open automations

Click the **lightning bolt icon** at the top-right of the database view (next to filter and sort). This opens the automations panel.

### 3. Create new automation

Click **"New automation"** (or **"+ Add automation"**).

### 4. Set the trigger

1. Click **"Add trigger"**
2. Select **"When property is edited"** (or "Property changed")
3. Choose the **"Generate Briefing"** property
4. Set the condition to **"is checked"**

### 5. Set the action

1. Click **"Add action"**
2. Scroll down and select **"Send webhook"**
3. Configure the webhook:

| Field | Value |
|-------|-------|
| **URL** | `https://your-beacon-url.vercel.app/api/briefing/generate` |
| **Method** | `POST` |

4. **Add a header:**
   - Key: `x-webhook-secret`
   - Value: your `WEBHOOK_SECRET` (same value set in Vercel)

5. **Set the body:**
```json
{
  "pageId": "{{page.id}}"
}
```

> **Note:** The `{{page.id}}` template variable is populated by Notion with the actual page ID when the automation fires. The exact syntax may vary — check Notion's automation builder for the available template variables. You may need to use the page ID property picker in the webhook body editor.

### 6. Save and enable

1. Click **"Save"**
2. Ensure the automation toggle is **on** (enabled)

## Testing

1. Open any workshop in the Beacon Workshops database
2. Check the **"Generate Briefing"** checkbox
3. Wait 30-60 seconds — beacon processes the request
4. The checkbox will uncheck itself (beacon resets the trigger)
5. A **"Beacon Briefing"** callout block should appear at the bottom of the workshop page

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| Checkbox stays checked | Beacon didn't run or failed | Check Vercel function logs |
| 401 error in logs | Webhook secret mismatch | Verify `x-webhook-secret` header matches `WEBHOOK_SECRET` env var |
| 404 from Notion API | Integration not connected to workspace | Share the workspace page with the Beacon integration (see deploy.md) |
| No callout appears | Briefing already exists for today | Each workshop gets one briefing per day (idempotency). Check if a callout with today's date already exists |
| Empty briefing | FogBell returned no signals | Check FogBell credentials and that the API is reachable |
