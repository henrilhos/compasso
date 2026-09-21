import { asc, gte } from "drizzle-orm";
import { events, getDb } from "@repo/db";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function getUpcomingEvents() {
  const db = getDb();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return db
    .select()
    .from(events)
    .where(gte(events.startsAt, startOfToday))
    .orderBy(asc(events.startsAt));
}

function groupByDate<T extends { startsAt: Date }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = formatDate(item.startsAt);
    const group = groups.get(key);
    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  return groups;
}

export default async function Home() {
  const upcomingEvents = await getUpcomingEvents();
  const groupedByDate = groupByDate(upcomingEvents);

  return (
    <main className="page">
      <header className="header">
        <h1>Compasso</h1>
        <p>Agenda de eventos de Joinville e região.</p>
      </header>

      {upcomingEvents.length === 0 && (
        <p className="empty">Nenhum evento encontrado no momento.</p>
      )}

      {[...groupedByDate.entries()].map(([date, dateEvents]) => (
        <section key={date} className="dateGroup">
          <h2>{date}</h2>
          <ul className="eventList">
            {dateEvents.map((event) => (
              <li key={event.id} className="eventCard">
                <a href={event.url} target="_blank" rel="noopener noreferrer">
                  <span className="eventTime">
                    {formatTime(event.startsAt)}
                  </span>
                  <span className="eventTitle">{event.title}</span>
                  {event.venueName && (
                    <span className="eventVenue">{event.venueName}</span>
                  )}
                  <span className="eventSource">{event.source}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
