import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";

const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

interface CalendarEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay: boolean;
}

function parseICSDate(dateStr: string): { date: Date; allDay: boolean } {
  const allDay = !dateStr.includes("T");
  let parsed: Date;
  if (allDay) {
    parsed = new Date(parseInt(dateStr.slice(0, 4)), parseInt(dateStr.slice(4, 6)) - 1, parseInt(dateStr.slice(6, 8)));
  } else {
    const y = parseInt(dateStr.slice(0, 4)), m = parseInt(dateStr.slice(4, 6)) - 1, d = parseInt(dateStr.slice(6, 8));
    const h = parseInt(dateStr.slice(9, 11)), mi = parseInt(dateStr.slice(11, 13)), s = parseInt(dateStr.slice(13, 15));
    parsed = dateStr.endsWith("Z") ? new Date(Date.UTC(y, m, d, h, mi, s)) : new Date(y, m, d, h, mi, s);
  }
  return { date: parsed, allDay };
}

function parseICS(icsContent: string): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const lines = icsContent.replace(/\r\n /g, "").replace(/\r\n\t/g, "").split(/\r?\n/);
  let current: Partial<CalendarEvent> | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") current = {};
    else if (line === "END:VEVENT" && current) {
      if (current.uid && current.summary && current.start && current.end) events.push(current as CalendarEvent);
      current = null;
    } else if (current) {
      if (line.startsWith("UID:")) current.uid = line.slice(4);
      else if (line.startsWith("SUMMARY:")) current.summary = line.slice(8).replace(/\\n/g, "\n").replace(/\\,/g, ",");
      else if (line.startsWith("DESCRIPTION:")) current.description = line.slice(12).replace(/\\n/g, "\n").replace(/\\,/g, ",");
      else if (line.startsWith("LOCATION:")) current.location = line.slice(9).replace(/\\n/g, "\n").replace(/\\,/g, ",");
      else if (line.startsWith("DTSTART")) {
        const p = parseICSDate(line.slice(line.indexOf(":") + 1));
        current.start = p.date.toISOString();
        current.allDay = p.allDay;
      } else if (line.startsWith("DTEND")) {
        current.end = parseICSDate(line.slice(line.indexOf(":") + 1)).date.toISOString();
      }
    }
  }
  return events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

async function fetchCalendarEvents(): Promise<CalendarEvent[]> {
  const calendarUrl = process.env.CALENDAR_URL;
  if (!calendarUrl) return [];
  try {
    const response = await fetch(calendarUrl);
    if (!response.ok) return [];
    return parseICS(await response.text());
  } catch {
    return [];
  }
}

export function createServer(): McpServer {
  const server = new McpServer({
    name: "Calendar MCP App",
    version: "1.0.0",
  });

  const resourceUri = "ui://calendar/mcp-app.html";

  registerAppTool(server,
    "calendar",
    {
      title: "Calendar",
      description: "Opens a calendar dashboard with your Proton Calendar events.",
      inputSchema: {},
      _meta: { ui: { resourceUri } },
    },
    async (): Promise<CallToolResult> => {
      return {
        content: [{ type: "text", text: "Calendar opened." }],
      };
    },
  );

  registerAppResource(server,
    resourceUri,
    resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      // Fetch events and embed them in the HTML
      const events = await fetchCalendarEvents();
      let html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");

      // Inject events data as a global variable
      const eventsScript = `<script>window.__CALENDAR_EVENTS__ = ${JSON.stringify(events)};</script>`;
      html = html.replace("</head>", `${eventsScript}</head>`);

      return {
        contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    },
  );

  return server;
}
