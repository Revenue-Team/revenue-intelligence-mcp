# Connect Hostaway to Claude for Revenue Intelligence

Get real-time revenue analytics from your Hostaway account directly in Claude. Ask questions like "What's my RevPAR this month?" or "Which unit is underperforming?" and get instant answers from your own data.

**What you'll get:** 6 revenue intelligence tools that compute occupancy rates, ADR, RevPAR, period comparisons, and more — all from your live Hostaway data.

**Time to set up:** ~10 minutes

**Requirements:** Node.js 18+, a Hostaway account with API access, Claude Desktop or Claude Code

---

## Step 1: Install Claude

If you don't already have Claude Desktop or Claude Code installed:

**Claude Desktop (recommended for most users)**
- Download from [claude.ai/download](https://claude.ai/download)
- Install and sign in with your Anthropic account

**Claude Code (for developers who prefer the terminal)**
```bash
npm install -g @anthropic-ai/claude-code
```

---

## Step 2: Get your Hostaway API credentials

You need two things from your Hostaway dashboard: your **Account ID** and an **API Secret**.

1. Log in to your [Hostaway Dashboard](https://dashboard.hostaway.com)
2. Go to **Settings** > **API** (or navigate to the API credentials section)
3. Note your **Account ID** (a numeric ID, e.g. `41334`)
4. Generate or copy your **Client Secret** (a long alphanumeric string)

You'll need these values:

| Credential | Where to find it | Example |
|---|---|---|
| Account ID | Dashboard > Settings > API | `41334` |
| Client Secret | Dashboard > Settings > API | `3febfd5e8f4...` |

> **Note:** Your Account ID is also used as the Client ID for Hostaway's OAuth2 flow.

---

## Step 3: Download and install the MCP server

Open your terminal and run:

```bash
# Clone the project (or download and unzip)
git clone https://github.com/arbio/revenue-intelligence-mcp.git
cd revenue-intelligence-mcp

# Install dependencies
npm install
```

That's it. No build step needed — the server runs directly with Node.js.

### Verify the install

```bash
node src/index.js 2>&1 | head -1
```

You should see: `Revenue Intelligence MCP server running on stdio`

Press `Ctrl+C` to stop it.

---

## Step 4: Connect to Claude

### Option A: Claude Desktop

1. Open your Claude Desktop config file:

   **macOS:**
   ```bash
   open ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

   **Windows:**
   ```
   %APPDATA%\Claude\claude_desktop_config.json
   ```

   If the file doesn't exist, create it.

2. Add the revenue-intelligence server. Replace the placeholder values with your real credentials and the actual path to where you downloaded the project:

   ```json
   {
     "mcpServers": {
       "revenue-intelligence": {
         "command": "node",
         "args": ["/full/path/to/revenue-intelligence-mcp/src/index.js"],
         "env": {
           "HOSTAWAY_CLIENT_ID": "YOUR_ACCOUNT_ID",
           "HOSTAWAY_CLIENT_SECRET": "YOUR_CLIENT_SECRET"
         }
       }
     }
   }
   ```

   > **Important:** Replace `/full/path/to/revenue-intelligence-mcp` with the actual path. For example: `/Users/yourname/revenue-intelligence-mcp`

3. Restart Claude Desktop completely (quit and reopen, not just close the window)

4. You should see a hammer icon in the bottom-right of the chat input — click it to verify the 6 revenue tools are listed

### Option B: Claude Code

Add the server to your Claude Code MCP config:

```bash
claude mcp add revenue-intelligence \
  -e HOSTAWAY_CLIENT_ID=YOUR_ACCOUNT_ID \
  -e HOSTAWAY_CLIENT_SECRET=YOUR_CLIENT_SECRET \
  -- node /full/path/to/revenue-intelligence-mcp/src/index.js
```

Or add it manually to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "revenue-intelligence": {
      "command": "node",
      "args": ["/full/path/to/revenue-intelligence-mcp/src/index.js"],
      "env": {
        "HOSTAWAY_CLIENT_ID": "YOUR_ACCOUNT_ID",
        "HOSTAWAY_CLIENT_SECRET": "YOUR_CLIENT_SECRET"
      }
    }
  }
}
```

---

## Step 5: Start asking questions

Once connected, just chat with Claude naturally. Here are some things you can ask:

### Portfolio overview
> "What's my portfolio overview for this month?"
>
> "Give me a revenue summary for Q1 2026"

### Unit performance
> "Which unit has the highest RevPAR this month?"
>
> "Rank my bottom 5 units by occupancy"
>
> "What's the ADR for my Berlin properties?"

### Occupancy analysis
> "What's my occupancy rate for last month?"
>
> "Show me daily occupancy for unit X this week"

### Revenue breakdown
> "Break down my revenue by booking channel"
>
> "How much revenue came from Airbnb vs Booking.com this month?"
>
> "Show me revenue by unit for March"

### Period comparison
> "Compare this month vs last month"
>
> "How does April compare to March in terms of RevPAR and occupancy?"

### Reservation details
> "Show me all reservations arriving this week"
>
> "List cancelled reservations for last month"

---

## What the tools compute

The server calculates these metrics on the fly from your Hostaway data:

| Metric | Formula | What it tells you |
|---|---|---|
| **Occupancy Rate** | Booked Nights / Available Room Nights x 100 | How full your portfolio is |
| **ADR** (Average Daily Rate) | Total Revenue / Booked Nights | Average price per occupied night |
| **RevPAR** (Revenue Per Available Room) | Total Revenue / Available Room Nights | Revenue efficiency across all nights (occupied or not) |

For reservations that partially overlap your selected date range, revenue and nights are automatically prorated — so you always get accurate numbers for the exact period you're asking about.

---

## Available tools reference

| Tool | What it does |
|---|---|
| `get_portfolio_overview` | High-level KPIs across your whole portfolio for a date range |
| `get_unit_performance` | Per-unit metrics, ranked by RevPAR, ADR, occupancy, or revenue |
| `get_occupancy` | Occupancy rates grouped by day, week, or month |
| `get_revenue_breakdown` | Revenue split by unit, by month, or by booking channel |
| `compare_periods` | Side-by-side comparison of two date ranges with absolute and percentage changes |
| `list_reservations` | Raw reservation data with filters (dates, unit, status) |

---

## Tips and things to know

- **First request may be slow.** The Hostaway API can take 15-20 seconds per request. For large portfolios with many reservations, the first query in a conversation may take 30-60 seconds. Subsequent queries in the same session are faster once data is fetched.

- **Revenue figures are gross.** The amounts come directly from Hostaway's `totalPrice` field — this is the gross booking amount before any channel commissions or fees are deducted.

- **Cancelled reservations are excluded** from all revenue calculations by default. The `list_reservations` tool lets you view cancelled bookings if needed.

- **Default date range is the current month.** If you don't specify dates, tools default to the 1st of the current month through today.

- **Rate limiting is handled automatically.** The server throttles requests to stay within Hostaway's API limits (15 requests per 10 seconds). You don't need to worry about hitting rate limits.

---

## Troubleshooting

### "Failed to authenticate with HostAway"
- Double-check your Account ID and Client Secret in the config
- Make sure you're using the Account ID as the Client ID (they're the same value)
- Verify your API credentials are active in the Hostaway dashboard

### Tools don't appear in Claude Desktop
- Make sure you restarted Claude Desktop completely (quit the app, not just close the window)
- Check the path in `args` points to the correct `src/index.js` file
- Open the Claude Desktop logs to see if there's a startup error

### "No reservations found"
- Check that the date range you're asking about has actual bookings in Hostaway
- Try a broader date range (e.g., "last 3 months" instead of "this week")
- The tool filters by arrival date — a guest who arrived before your date range but stays into it will still be counted in revenue calculations

### Responses are very slow
- This is usually the Hostaway API, not the MCP server. Large portfolios with hundreds of reservations require multiple paginated API calls.
- Try narrowing your date range or asking about a specific unit instead of the whole portfolio.

---

## What this tool can't do (yet)

This free tool gives you real-time revenue metrics from your Hostaway data. For more advanced analytics, [RAAS by Arbio](https://www.arbio.io) offers:

- **Year-over-year comparisons** with deep historical data
- **Daily automated reports** delivered to your inbox
- **Market benchmarking** against comparable properties
- **Pricing optimization** recommendations
- **Multi-PMS aggregation** across Hostaway, Smoobu, Apaleo, and more
- **Custom KPIs** built with your revenue manager

Want the full picture? [Talk to the Arbio team](https://www.arbio.io).
