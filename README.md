# Proton Calendar MCP App

A dark industrial-themed MCP App that displays your Proton Calendar events directly in Claude Desktop.

![Metalheart Theme](https://img.shields.io/badge/theme-metalheart-orange)
![Node](https://img.shields.io/badge/node-%3E%3D20-green)

## Features

- Dark industrial "Metalheart" UI design
- Monthly calendar view with event indicators
- Upcoming events list
- Click on any day to see its events
- Reads events from Proton Calendar ICS feed

## Requirements

- **Node.js** v20+ (v22 recommended)
- **Bun** (for building)
- **Claude Desktop** or compatible MCP host
- **Proton Calendar** account with a shared calendar link

## Installation

```bash
# Clone the repository
git clone https://github.com/Rixmerz/proton-calendar-app-mcp.git
cd proton-calendar-app-mcp

# Install dependencies
npm install

# Build
npm run build
```

## Getting Your Proton Calendar URL

1. Go to [Proton Calendar](https://calendar.proton.me)
2. Click on **Settings** (gear icon)
3. Go to **Calendars** → Select your calendar
4. Scroll to **Share via link**
5. Create a new link (or copy existing)
6. Copy the **ICS URL** (looks like `https://calendar.proton.me/api/calendar/v1/url/.../calendar.ics?...`)

## Configuration

Add this to your `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "proton-calendar": {
      "command": "/path/to/node",
      "args": [
        "/path/to/proton-calendar-app-mcp/dist/index.js",
        "--stdio"
      ],
      "env": {
        "CALENDAR_URL": "https://calendar.proton.me/api/calendar/v1/url/YOUR_CALENDAR_ID/calendar.ics?CacheKey=...&PassphraseKey=..."
      }
    }
  }
}
```

### Finding Your Node Path

```bash
# macOS/Linux
which node
# or if using nvm
nvm which 22

# Windows
where node
```

## Usage

After configuring, restart Claude Desktop and say:

> "Open my calendar"

or

> "Show me my upcoming events"

Claude will display the calendar UI with your Proton Calendar events.

## Security Note

Your `CALENDAR_URL` contains access tokens. Keep your `claude_desktop_config.json` private and never commit it to version control.

## License

MIT
