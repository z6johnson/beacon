# Deploying Beacon to Vercel

Beacon runs as Vercel serverless functions. This guide walks through getting it live.

## Prerequisites

- A [Vercel account](https://vercel.com/signup) (free tier works)
- Node.js >= 20
- Your API credentials ready:
  - FogBell account (email + password)
  - LiteLLM proxy URL + API key
  - Notion integration token (see below)

## 1. Install Vercel CLI

```bash
npm i -g vercel
```

## 2. Login

```bash
vercel login
```

## 3. Deploy

From the beacon project root:

```bash
vercel
```

When prompted:
- **Link to existing project?** No (first time)
- **Project name:** `beacon`
- **Framework:** Other
- **Root directory:** `.` (default)

Vercel detects `vercel.json` and configures the serverless functions automatically.

## 4. Set Environment Variables

Via CLI (each command prompts for the value):

```bash
vercel env add WEBHOOK_SECRET
vercel env add FOGBELL_API_URL
vercel env add FOGBELL_EMAIL
vercel env add FOGBELL_PASSWORD
vercel env add LITELLM_BASE_URL
vercel env add LITELLM_API_KEY
vercel env add LITELLM_MODEL
vercel env add NOTION_TOKEN
```

Or set them in the Vercel dashboard: **Project Settings > Environment Variables**.

| Variable | Value | Required |
|----------|-------|----------|
| `WEBHOOK_SECRET` | A random secret for authenticating Notion webhooks | Yes |
| `FOGBELL_API_URL` | `https://api.fogbell.news` | Yes |
| `FOGBELL_EMAIL` | Your FogBell account email | Yes |
| `FOGBELL_PASSWORD` | Your FogBell account password | Yes |
| `LITELLM_BASE_URL` | Your LiteLLM proxy URL | Yes |
| `LITELLM_API_KEY` | Your LiteLLM API key | Yes |
| `LITELLM_MODEL` | Model name (e.g. `gpt-4o`) | No (defaults to `gpt-4o`) |
| `NOTION_TOKEN` | Notion integration secret | Yes |

### Generating a webhook secret

```bash
openssl rand -hex 32
```

Save this value — you'll need it again when configuring the Notion automation.

## 5. Redeploy with env vars

```bash
vercel --prod
```

## 6. Verify

```bash
curl https://your-project.vercel.app/api/health
```

Should return:
```json
{"status":"ok","service":"beacon","timestamp":"2026-03-07T..."}
```

Note your deployment URL — you'll need it for the Notion automation setup.

---

## Creating a Notion Integration Token

1. Go to [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Click **"New integration"**
3. Name: **Beacon**
4. Select your workspace
5. Under **Capabilities**, enable:
   - Read content
   - Update content
   - Insert content
6. Click **Submit**
7. Copy the **Internal Integration Secret** (starts with `secret_`)

### Share your workspace with the integration

This step is required — Notion integrations can only access pages explicitly shared with them.

1. Open your workspace page in Notion
2. Click the **"..."** menu (top-right)
3. Click **"Connect to"**
4. Select **"Beacon"** from the list
5. Confirm

Without this step, the Notion API will return 404 errors when beacon tries to read or write pages.
