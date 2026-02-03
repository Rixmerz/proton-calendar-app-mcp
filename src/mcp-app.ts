import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps";

declare global {
  interface Window {
    __CALENDAR_EVENTS__?: CalendarEvent[];
  }
}

interface CalendarEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  start: string;
  end: string;
  allDay: boolean;
}

let currentDate = new Date();
let allEvents: CalendarEvent[] = [];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function getEventsForDay(year: number, month: number, day: number): CalendarEvent[] {
  return allEvents.filter(e => isSameDay(new Date(e.start), new Date(year, month, day)));
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function updateEventCount(): void {
  const monthEvents = allEvents.filter(e => {
    const eventDate = new Date(e.start);
    return eventDate.getMonth() === currentDate.getMonth() &&
           eventDate.getFullYear() === currentDate.getFullYear();
  });
  document.getElementById("event-count")!.textContent =
    monthEvents.length === 0 ? "No events this month" :
    `${monthEvents.length} event${monthEvents.length === 1 ? "" : "s"} this month`;
}

function renderCalendar(): void {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  document.getElementById("current-month")!.textContent = `${MONTHS[month]} ${year}`;
  updateEventCount();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const grid = document.getElementById("days-grid")!;
  grid.innerHTML = "";

  for (let i = 0; i < firstDay; i++) {
    const cell = document.createElement("div");
    cell.className = "day-cell empty";
    grid.appendChild(cell);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.className = "day-cell";
    const isToday = isSameDay(new Date(year, month, day), today);
    if (isToday) cell.classList.add("today");

    const dayEvents = getEventsForDay(year, month, day);
    if (dayEvents.length > 0) cell.classList.add("has-events");

    cell.innerHTML = `<span class="day-number">${day}</span>${dayEvents.length > 0 ? '<span class="event-dot"></span>' : ""}`;
    cell.addEventListener("click", () => showDayEvents(year, month, day));
    grid.appendChild(cell);
  }
}

function showDayEvents(year: number, month: number, day: number): void {
  const events = getEventsForDay(year, month, day);
  document.getElementById("events-title")!.textContent = formatDate(new Date(year, month, day).toISOString());
  document.getElementById("events-list")!.innerHTML = events.length === 0
    ? '<p class="no-events">No events this day</p>'
    : events.map(e => `
      <div class="event-card">
        <div class="event-time">${e.allDay ? "All day" : formatTime(e.start)}</div>
        <div class="event-details">
          <div class="event-title">${escapeHtml(e.summary)}</div>
          ${e.location ? `<div class="event-location">📍 ${escapeHtml(e.location)}</div>` : ""}
        </div>
      </div>
    `).join("");
  document.getElementById("events-section")!.style.display = "block";
}

function showUpcoming(): void {
  const now = new Date();
  const upcoming = allEvents.filter(e => new Date(e.start) >= now).slice(0, 5);
  document.getElementById("events-title")!.textContent = "Upcoming Events";
  document.getElementById("events-list")!.innerHTML = upcoming.length === 0
    ? '<p class="no-events">No upcoming events</p>'
    : upcoming.map(e => `
      <div class="event-card">
        <div class="event-date-badge">${formatDate(e.start)}${e.allDay ? "" : `<br><small>${formatTime(e.start)}</small>`}</div>
        <div class="event-details">
          <div class="event-title">${escapeHtml(e.summary)}</div>
        </div>
      </div>
    `).join("");
  document.getElementById("events-section")!.style.display = "block";
}

function showContent(): void {
  document.getElementById("loading")!.style.display = "none";
  document.getElementById("content")!.style.display = "block";
}

async function main() {
  const app = new App({ name: "Calendar", version: "1.0.0" });

  // Load events from embedded data
  allEvents = window.__CALENDAR_EVENTS__ || [];

  document.getElementById("prev-month")!.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById("next-month")!.addEventListener("click", () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
  });

  await app.connect(new PostMessageTransport(window.parent));

  renderCalendar();
  showUpcoming();
  showContent();
}

main().catch(console.error);
