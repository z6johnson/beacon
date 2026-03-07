# Operations Intelligence System

A coordinated set of lightweight services that power Zach's workshop preparation and operational workflow at UC San Diego's AI strategy team. Each service owns one concern. Information flows between them through APIs and webhooks. The tools Zach already works in — Notion and ClickUp — remain the system of record.

---

## The System

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INTELLIGENCE LAYER                           │
│                                                                     │
│   ┌───────────┐         ┌──────────┐         ┌──────────────┐      │
│   │  FogBell   │────────▶│  Beacon  │────────▶│    Notion     │     │
│   │ (signals)  │         │ (synth)  │         │  (delivery)   │     │
│   └───────────┘         └────┬─────┘         └──────────────┘      │
│                              │                                      │
│                         ┌────┴─────┐                                │
│                         │ LiteLLM  │                                │
│                         │ (gateway)│                                │
│                         └──────────┘                                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        OPERATIONS LAYER                             │
│                                                                     │
│   ┌───────────┐                              ┌──────────────┐      │
│   │  ClickUp   │◀────────── helm ───────────▶│  Dashboard    │     │
│   │  (tasks)   │       (operational view)     │   (UI)       │     │
│   └───────────┘                              └──────────────┘      │
│                                                                     │
│   ┌───────────┐                              ┌──────────────┐      │
│   │  Notion    │◀────────── keel ───────────▶│  Workspace    │     │
│   │ (content)  │      (workshop delivery)     │   (UI)       │     │
│   └───────────┘                              └──────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

### Components

| Component | Role | Platform | Status |
|-----------|------|----------|--------|
| **FogBell** | Intelligence source — curates 87 RSS feeds, scores relevance, clusters storylines | Railway (Express/Prisma/PostgreSQL) | Production at fogbell.news |
| **Beacon** | Intelligence synthesizer — generates contextual briefings from FogBell signals | Vercel (serverless) | MVP built |
| **Helm** | Operational dashboard — surfaces ClickUp tasks, deadlines, workload | TBD | Planned |
| **Keel** | Workshop delivery — manages Notion workspace for content and facilitation | TBD | Planned |
| **LiteLLM** | LLM gateway — routes model calls, manages keys, tracks usage across all services | External proxy | In use |

---

## Design Principles

1. **Each service owns one concern.** FogBell curates intelligence. Beacon synthesizes it for context. Helm surfaces operational state. Keel manages workshop delivery. No service tries to do everything.

2. **Notion and ClickUp are the system of record.** Services read from and write to these platforms — they don't replace them.

3. **LiteLLM as the single LLM gateway.** All AI-powered components route through one proxy. Centralizes key management, model routing, usage tracking, and cost control.

4. **Webhook-driven, not polling.** Services respond to events (a checkbox checked, a status changed) rather than scanning for changes on a loop.

5. **Independently deployable.** No shared databases, no monorepo coupling. Services communicate through APIs and webhooks. Any one can be replaced or rebuilt without affecting others.

---

## Beacon: How It Works Today

Beacon is the first service built in this system. It establishes the integration pattern for everything that follows.

**Trigger:** User checks "Generate Briefing" checkbox on a Notion workshop page. Notion automation POSTs to beacon's webhook endpoint.

```
Notion checkbox ──POST──▶ /api/briefing/generate
                              │
                    Read workshop context from Notion page
                              │
                    Fetch signals + storylines from FogBell
                              │
                    Filter signals for relevance (keyword → LLM scoring)
                              │
                    Generate structured briefing via LiteLLM
                              │
                    Append briefing callout to Notion page
                              │
                    Reset trigger checkbox
```

**Briefing structure:**
- **Key Signals** — what happened and why it matters for this workshop
- **Developing Storylines** — broader trends connecting the signals
- **Assumptions to Challenge** — what participants might believe that evidence contradicts
- **Suggested Angles** — discussion prompts grounded in recent developments

**Key properties:**
- Idempotent (won't duplicate briefings on the same day)
- Stateless (no database — reads from Notion, writes to Notion)
- Triggered from within Notion (zero context-switching)

---

## FogBell: The Intelligence Source

FogBell runs independently as a production service at fogbell.news. Beacon treats it as a read-only API.

**What beacon pulls:**
- `/api/signals` — individual scored signals (articles, announcements, developments)
- `/api/storylines` — clusters of related signals forming developing narratives

**What FogBell provides that beacon doesn't replicate:**
- RSS aggregation from 87 sources
- AI-powered relevance scoring and topic extraction
- Storyline clustering over time
- Institution mention tracking
- Daily digest emails

Beacon adds a layer on top: it takes FogBell's general-purpose intelligence and filters it through the lens of a specific upcoming workshop.

---

## Next Steps — Options

### Option A: Deepen Beacon (vertical)

Stay focused on beacon. Make briefings richer and triggers smarter before building new services.

**A1. ClickUp context enrichment**
Add a ClickUp source adapter alongside FogBell. Beacon reads related tasks, deadlines, and prior workshop notes when generating briefings. The briefing becomes operationally aware — not just "what's happening in the world" but "what's happening relative to what you're already doing."

**A2. Post-workshop debrief**
New endpoint: `POST /api/briefing/debrief`. Triggered after a workshop. Reads participant notes/feedback from Notion, cross-references with the pre-briefing, generates a debrief: what landed, what surprised, what to track going forward.

**A3. Scheduled briefing mode**
Add a cron trigger (Vercel Cron) that scans for workshops in the next N days and auto-generates briefings. The manual checkbox becomes an override, not the primary trigger.

**A4. Briefing refinement**
Let the user reply to a briefing (via Notion comment or property) with direction like "focus more on policy" — beacon regenerates with adjusted emphasis.

### Option B: Build Helm (horizontal)

Stand up the ClickUp operational dashboard.

**B1. Read-only dashboard**
Surface tasks, due dates, statuses, and workload in a clean purpose-built view. Lightweight frontend on Vercel.

**B2. Bidirectional sync**
Helm can update task statuses, add comments, or create tasks — quick triage without context-switching into ClickUp.

### Option C: Build Keel (horizontal)

Stand up the Notion workshop delivery system.

**C1. Workshop template engine**
When a new workshop is created, keel scaffolds the Notion page with standard sections and pre-populated structure.

**C2. Resource assembly**
Keel pulls relevant resources (papers, links, prior materials) from a Notion database and assembles them on the workshop page. Could also pull from FogBell signals.

### Option D: Connect the Loop (integration)

Wire services together so they respond to each other's events.

**D1. Helm → Beacon auto-trigger**
When a ClickUp task moves to "Prep" status, helm triggers beacon to generate a briefing for the associated workshop. The operational workflow drives intelligence — no manual trigger needed.

**D2. FogBell → Beacon push**
Instead of beacon pulling from FogBell on demand, FogBell pushes high-priority signals when they match tracked workshop topics. Briefings update incrementally as new intelligence arrives.

**D3. Shared event registry**
A lightweight webhook registry so services can subscribe to each other's events without point-to-point wiring.

---

## Recommended Sequence

```
Now              Next                 Then                 Later
──────────       ──────────────       ──────────────       ──────────────
Beacon MVP  →    A1 (ClickUp          A2 (Post-workshop    D1 (Helm→Beacon
(done)            context in            debrief)             auto-trigger)
                  briefings)
                                      B1 (Helm read-only   D3 (Event
                 A3 (Scheduled          dashboard)           registry)
                  briefings)
                                      C1 (Workshop
                                        templates)
```

Go vertical first (deepen beacon), then horizontal (helm + keel), then connect the loop. Each step delivers standalone value.

---

## Infrastructure

| Service | Deploy | Runtime | Cost |
|---------|--------|---------|------|
| FogBell | Railway | Express/Node (always-on) | ~$5-10/mo |
| Beacon | Vercel | Serverless functions | Free tier |
| Helm | Vercel (likely) | React + API routes | Free tier |
| Keel | Vercel (likely) | API routes (serverless) | Free tier |
| LiteLLM | External proxy | — | Per-token usage |
| PostgreSQL | Railway | — | Included with FogBell |

All services authenticate to external APIs (FogBell, ClickUp, Notion, LiteLLM) with their own credentials. No shared state between services.
