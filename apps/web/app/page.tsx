import { and, asc, gte } from "drizzle-orm";
import { getDb, offers } from "@repo/db";

export const dynamic = "force-dynamic";

const STALE_AFTER_DAYS = 3;

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

async function getUpcomingOffers() {
  const db = getDb();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const staleCutoff = new Date();
  staleCutoff.setDate(staleCutoff.getDate() - STALE_AFTER_DAYS);

  return db
    .select()
    .from(offers)
    .where(
      and(
        gte(offers.startsAt, startOfToday),
        gte(offers.lastSeenAt, staleCutoff),
      ),
    )
    .orderBy(asc(offers.startsAt));
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
  const upcomingOffers = await getUpcomingOffers();
  const groupedByDate = groupByDate(upcomingOffers);

  return (
    <main className="page">
      <header className="header">
        <h1>Compasso</h1>
        <p>
          Agenda de eventos de Santa Catarina. Joinville, Jaraguá do Sul,
          Itajaí, Balneário Camboriú, Florianópolis e São José.
        </p>
      </header>

      {upcomingOffers.length === 0 && (
        <p className="empty">Nenhum evento encontrado no momento.</p>
      )}

      {[...groupedByDate.entries()].map(([date, dateOffers]) => (
        <section key={date} className="dateGroup">
          <h2>{date}</h2>
          <ul className="eventList">
            {dateOffers.map((offer) => (
              <li key={offer.id} className="eventCard">
                <a href={offer.url} target="_blank" rel="noopener noreferrer">
                  <span className="eventTime">
                    {formatTime(offer.startsAt)}
                  </span>
                  <span className="eventTitle">{offer.title}</span>
                  {offer.venueName && (
                    <span className="eventVenue">{offer.venueName}</span>
                  )}
                  <span className="eventSource">{offer.source}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
