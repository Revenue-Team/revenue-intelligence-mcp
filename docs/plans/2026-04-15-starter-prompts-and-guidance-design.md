# Starter Prompts and Conversational Guidance — Design

**Date:** 2026-04-15
**Status:** Approved, ready for implementation plan

## Problem

First-time users of the `revenue-intelligence` MCP don't know what to ask. Without guidance, they either:
- Ask vague questions that trigger slow full-portfolio scans
- Give up before discovering what the tool can do

We need two things:
1. **Discoverable starter prompts** visible in Claude Desktop's UI so users can click-and-run
2. **Conversational guidance** so Claude suggests relevant next questions after each answer — creating a natural exploration path

## Goals

- Deliver meaningful value in the user's **first minute** of interaction
- Keep starter queries **fast** (tolerate 1000+ unit portfolios) by scoping to short time windows
- Guide users toward the next useful question without being pushy

## Non-goals

- Full conversational flow control (not possible in MCP — Claude is the agent)
- Replacing the setup guide — this is in-product guidance, not documentation
- Personalization per user (same prompts and suggestions for everyone)

---

## Design Component 1 — Four starter MCP Prompts

Four pre-defined prompts shipped with the MCP, visible in Claude Desktop's prompts UI. All use fixed parameters (no user input) and scope to a 7-day window for speed.

| # | Prompt name | UI title | Prompt text | Tool used | Target response time |
|---|---|---|---|---|---|
| 1 | `weekly_overview` | "This week's portfolio overview" | "Show me a portfolio revenue overview for the last 7 days. Include revenue, occupancy, ADR, and RevPAR." | `get_portfolio_overview` | ~20–30s |
| 2 | `recent_bookings` | "My 10 most recent bookings" | "Show me my 10 most recent reservations." | `list_reservations` (limit=10) | ~15s |
| 3 | `top_and_bottom_units` | "Top 3 & bottom 3 units this week" | "For the last 7 days, show me my top 3 units by revenue and my bottom 3 units by revenue. Note any units with zero revenue." | `get_unit_performance` | ~60–90s |
| 4 | `week_over_week` | "This week vs last week comparison" | "Compare my portfolio revenue, occupancy, and RevPAR for the last 7 days vs the 7 days before that." | `compare_periods` | ~30–45s |

### Rationale for this set

- **1 + 2** are fast wins — build trust quickly. They prove the connection works and show real data.
- **3** is the highest "aha" prompt — surfaces problems users didn't know about. Slower but worth the wait.
- **4** shows trend awareness — context for whether things are improving.

All scoped to **7 days** to keep response times predictable on large portfolios.

---

## Design Component 2 — Expanded server instructions

Update the `instructions` string passed to `new McpServer(...)` in `src/index.js` to include conversational guidance rules.

### Key additions

Append to the existing instructions block:

> After answering a question, when appropriate, end your response with 2–3 short follow-up suggestions. Format them as:
>
> > **Want to dig deeper? Try:**
> > - *[specific next question]*
> > - *[specific next question]*
>
> **When to include suggestions:**
> - After answering starter prompts (helps new users explore)
> - When the answer is short (1–2 data points)
> - When the question was open-ended or vague
>
> **When to skip suggestions:**
> - When the user is clearly deep-diving a specific topic (respect their focus)
> - When the answer is already dense with information
> - When the user explicitly says they're done

This captures the **contextual** rule — Claude uses judgment rather than mechanically appending suggestions to every response.

---

## Design Component 3 — `_next_steps` field in tool outputs

Each of the 6 tools appends a `_next_steps` array to its JSON response. Claude reads it and usually mirrors the suggestions back to the user.

### Suggestions by tool (starter set)

| Tool | Suggestions returned |
|---|---|
| `get_portfolio_overview` | "Show me my top 5 units by revenue for this period" / "Compare this period to the one before" / "Break revenue down by booking channel" |
| `get_unit_performance` | "Show me recent bookings for {top_unit_name}" / "What's the occupancy for {bottom_unit_name} in detail?" / "Compare this period to the one before" |
| `get_occupancy` | "Break revenue down for the same period" / "Which specific units are driving this occupancy?" |
| `get_revenue_breakdown` | "Rank units by revenue for this period" / "Compare channel mix to last month" |
| `compare_periods` | "Which units drove the biggest revenue change?" / "Break revenue down by channel for the current period" |
| `list_reservations` | "Show revenue overview for this date range" / "Break revenue by channel for this date range" |

Suggestions are **context-aware** — e.g., `get_unit_performance` suggestions reference the actual top/bottom units returned in that response.

### Shape

```json
{
  "period": "...",
  "units": [...],
  "_next_steps": [
    "Show me recent bookings for AT_VIE_Duschel_01_00_01_W",
    "Compare this period to the same period last month"
  ]
}
```

---

## Data flow

```
User clicks starter prompt in Claude Desktop UI
          │
          ▼
Prompt text inserted into chat
          │
          ▼
Claude calls the appropriate MCP tool
          │
          ▼
Tool returns { data..., _next_steps: [...] }
          │
          ▼
Claude's response includes:
  1. The data (formatted nicely)
  2. Context-aware suggestions (from _next_steps)
  3. Server-instruction-driven follow-ups (if contextually appropriate)
```

---

## Success criteria

- Four starter prompts appear in Claude Desktop's prompts UI after install
- Clicking each prompt returns real data within its target response time
- First-time user can go from "install" → "meaningful insight" in under 2 minutes
- After any substantive answer, Claude offers 2–3 contextually relevant follow-up questions
- Suggestions reflect actual data returned (e.g., named units, actual periods) — not generic placeholders

## Out of scope for this round

- Parameterized prompts (e.g., `single_unit_report({unit_name})`) — deferred until we see what users actually ask for
- Resources primitive (static content served via MCP) — not needed for starter prompts
- Analytics on which prompts users invoke — requires telemetry infrastructure
- Localization — English only for now
