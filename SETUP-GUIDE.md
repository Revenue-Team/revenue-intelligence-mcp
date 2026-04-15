# Connect Hostaway to Claude Desktop

Get real-time revenue analytics from your Hostaway account directly inside Claude. Ask "What's my RevPAR this month?" or "Which unit is underperforming?" and get instant answers from your live data.

**What you get:** 6 tools that compute occupancy, ADR, RevPAR, period comparisons, channel breakdowns, and more — all on demand from your Hostaway account.

**Time to set up:** about 10 minutes
**Skill needed:** ability to copy/paste into a config file

---

## Before you start

You need:

- **Claude Desktop** — download from [claude.ai/download](https://claude.ai/download)
- **A Hostaway account** with API access enabled
- **Node.js 18 or newer** — download from [nodejs.org](https://nodejs.org) if you don't have it

> If you also use Claude Code (the developer CLI), the same instructions work there with a different config file. This guide covers Claude Desktop.

---

## Step 1 — Get your Hostaway API credentials

You need two values from your Hostaway dashboard:

1. Log in to [dashboard.hostaway.com](https://dashboard.hostaway.com)
2. Go to **Settings → API**
3. Note your **Account ID** (a number, e.g. `41334`)
4. Generate or copy your **Client Secret** (a long alphanumeric string)

| Credential | Where to find it | Example |
|---|---|---|
| Account ID | Settings → API | `41334` |
| Client Secret | Settings → API | `3febfd5e8f4cc609...` |

Keep these handy — you'll paste them into the config in Step 3.

---

## Step 2 — Download the server

Open **Terminal** (macOS) or **PowerShell** (Windows) and run:

```bash
git clone https://github.com/Revenue-Team/revenue-intelligence-mcp.git
cd revenue-intelligence-mcp
npm install
```

This downloads the project and installs its dependencies. No build step is needed.

Note the **full path** to the project — you'll need it in the next step. To get it:

**macOS / Linux:**
```bash
pwd
```

**Windows:**
```powershell
echo %CD%
```

Copy the path that's printed — it'll look something like `/Users/yourname/revenue-intelligence-mcp`.

---

## Step 3 — Open the Claude Desktop config file

**macOS:**
```bash
open -e ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

**Windows:**
```powershell
notepad %APPDATA%\Claude\claude_desktop_config.json
```

If the file doesn't exist yet, create it with this empty starting content:

```json
{
  "mcpServers": {}
}
```

---

## Step 4 — Add the revenue-intelligence server

Inside `mcpServers`, add the following block. Replace the three placeholder values:

- `/FULL/PATH/TO/revenue-intelligence-mcp` — the path you copied in Step 2
- `YOUR_ACCOUNT_ID` and `YOUR_CLIENT_SECRET` — your Hostaway credentials from Step 1

```json
{
  "mcpServers": {
    "revenue-intelligence": {
      "command": "node",
      "args": ["/FULL/PATH/TO/revenue-intelligence-mcp/src/index.js"],
      "env": {
        "HOSTAWAY_CLIENT_ID": "YOUR_ACCOUNT_ID",
        "HOSTAWAY_CLIENT_SECRET": "YOUR_CLIENT_SECRET"
      }
    }
  }
}
```

Save the file.

> If you have a large portfolio (500+ units), add this line inside the `env` block to give the server more memory:
> ```json
> "NODE_OPTIONS": "--max-old-space-size=8192"
> ```

---

## Step 5 — Restart Claude Desktop

Quit Claude Desktop completely (**Cmd+Q** on macOS, or close from the system tray on Windows — not just the window) and reopen it.

---

## Step 6 — Verify it's working

In a new chat, click the **tools icon** (next to the chat input). You should see `revenue-intelligence` listed with 6 tools available.

Then run this quick test:

> Show me my last 5 reservations

You should get a clean list back in 15–30 seconds. If you do, you're connected.

---

## How to use it

Just chat with Claude in plain English. Examples:

**Portfolio overview**
> What's my portfolio overview for this month?
>
> Give me a revenue summary for the last 7 days

**Per-unit performance**
> Which unit had the highest RevPAR last week?
>
> Rank my bottom 5 units by occupancy this month
>
> What's the RevPAR for unit AT_VIE_Duschel_01_00_01_W on April 13?

**Occupancy**
> Show me daily occupancy for last week
>
> What was occupancy for unit DE_HAM_Makro_01_02_04_B last month?

**Revenue breakdown**
> Break down revenue by booking channel this month
>
> Show revenue per unit for March

**Compare periods**
> Compare this month vs last month
>
> How does Q1 2026 compare to Q4 2025 in RevPAR?

**Reservation details**
> List all reservations arriving next week
>
> Show me cancelled bookings from last month

You can refer to a unit by its **internal name** (e.g. `AT_VIE_Duschel_01_00_01_W`) or by its **numeric Hostaway ID**. Both work.

---

## What the tools compute

| Metric | Formula | What it tells you |
|---|---|---|
| Occupancy Rate | Booked Nights / Available Room Nights × 100 | How full your portfolio is |
| ADR (Average Daily Rate) | Total Revenue / Booked Nights | Average price per occupied night |
| RevPAR (Revenue Per Available Room) | Total Revenue / Available Room Nights | Revenue per night across all units (occupied or not) |

For reservations that overlap your selected date range, revenue and nights are automatically prorated for accuracy.

---

## Limitations to know about

- **First request is slow.** Hostaway's API takes 15–20 seconds per call. The first query in a session may take 30–60 seconds while the server fetches your full unit list. After that, it's cached and subsequent queries are much faster.

- **Large portfolios (500+ units) take longer.** Aggregating across hundreds of units requires multiple paginated API calls. Scope your question to a specific unit when you can — it's dramatically faster.

- **Wide date ranges take longer.** Asking "RevPAR for the last year" pulls a year of reservations from Hostaway. Stick to month-level or quarterly questions for snappy responses.

- **Revenue is gross, not net.** All revenue figures come from Hostaway's `totalPrice` field — before channel commissions, cleaning fees, or other deductions.

- **Cancelled reservations are excluded** from revenue calculations by default. You can view them via the reservations tool if needed.

- **Multi-room listings can show >100% occupancy.** If a single Hostaway listing represents a property with multiple bookable rooms, the tool flags this and explains why the math looks unusual.

- **Historical depth depends on Hostaway.** The tool can only show data Hostaway returns. If your account is new, historical data may be limited.

---

## Troubleshooting

**"Failed to authenticate with Hostaway"**
- Double-check your Account ID and Client Secret in the config
- The Account ID is also used as the Client ID — they're the same value
- Verify your API credentials are still active in the Hostaway dashboard

**Tools don't appear in Claude Desktop**
- Make sure you fully quit Claude Desktop (not just closed the window) and reopened it
- Check the JSON in your config file is valid (no missing commas or quotes)
- Confirm Node.js is installed: run `node --version` in your terminal — it should print v18 or higher

**Responses time out or feel stuck**
- Narrow your date range (a week instead of a year)
- Ask about a specific unit instead of the whole portfolio
- For accounts with 500+ units, add the `NODE_OPTIONS` line from Step 3

**"Listing not found"**
- The unit name must match exactly. Use the internal Hostaway naming (e.g. `AT_VIE_Duschel_01_00_01_W`), not the user-facing name shown in your dashboard
- The tool will suggest similar names if it can't find an exact match

---

## Want more?

This free tool gives you on-demand revenue metrics from your Hostaway data. For deeper analytics — year-over-year comparisons, automated daily reports, market benchmarking, pricing recommendations, and multi-PMS support — see [RAAS by Arbio](https://www.arbio.io).
