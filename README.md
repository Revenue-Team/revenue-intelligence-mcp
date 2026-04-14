# Revenue Intelligence MCP Server

A free MCP server that connects your Hostaway account to Claude and gives you real-time revenue analytics — RevPAR, ADR, occupancy rates, period comparisons, and more.

Ask Claude things like:
- "What's my portfolio overview for this month?"
- "Which unit has the highest RevPAR?"
- "Compare this month vs last month"
- "Break down revenue by booking channel"

All computed on the fly from your own Hostaway data.

## Quick start

```bash
git clone https://github.com/Revenue-Team/MCP-lead-gen.git
cd MCP-lead-gen
npm install
```

Then add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "revenue-intelligence": {
      "command": "node",
      "args": ["/full/path/to/MCP-lead-gen/src/index.js"],
      "env": {
        "HOSTAWAY_CLIENT_ID": "YOUR_ACCOUNT_ID",
        "HOSTAWAY_CLIENT_SECRET": "YOUR_CLIENT_SECRET"
      }
    }
  }
}
```

Restart Claude Desktop. Done.

**Full setup instructions:** [SETUP-GUIDE.md](./SETUP-GUIDE.md)

## Tools included

| Tool | What it does |
|---|---|
| `get_portfolio_overview` | KPIs across your whole portfolio (revenue, occupancy, ADR, RevPAR) |
| `get_unit_performance` | Per-unit metrics, ranked by any metric |
| `get_occupancy` | Occupancy rates grouped by day, week, or month |
| `get_revenue_breakdown` | Revenue split by unit, month, or booking channel |
| `compare_periods` | Two date ranges side by side with deltas |
| `list_reservations` | Raw reservation data with filters |

## How it works

```
Claude Desktop / Claude Code
    |  (MCP protocol, runs locally)
    v
This server (Node.js)
    - Fetches listings + reservations from Hostaway API
    - Computes RevPAR, ADR, occupancy on the fly
    - Returns structured data Claude formats for you
    |  (HTTPS, your own API credentials)
    v
Hostaway API (api.hostaway.com)
```

Everything runs on your machine. Your data goes directly between your computer and Hostaway's API. Nothing is stored or sent anywhere else.

## Project structure

```
src/
├── index.js                     # MCP server entry point
├── pms/
│   └── hostaway.js              # Hostaway API client (OAuth2, rate limiting, pagination)
├── tools/
│   ├── portfolio-overview.js    # get_portfolio_overview
│   ├── unit-performance.js      # get_unit_performance
│   ├── occupancy.js             # get_occupancy
│   ├── revenue-breakdown.js     # get_revenue_breakdown
│   ├── compare-periods.js       # compare_periods
│   └── list-reservations.js     # list_reservations
├── calculations/
│   └── revenue-metrics.js       # RevPAR, ADR, occupancy formulas
└── utils/
    └── date-helpers.js          # Date math utilities
```

## Requirements

- Node.js 18+
- A Hostaway account with API credentials
- Claude Desktop or Claude Code

## Want more?

This free tool gives you the basics from your Hostaway data. For advanced revenue management — year-over-year analysis, market benchmarking, pricing optimization, automated daily reports, and multi-PMS support — check out [RAAS by Arbio](https://www.arbio.io).
