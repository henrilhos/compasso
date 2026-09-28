import { and, asc, eq, gte, ilike, inArray, lt, or } from "drizzle-orm";
import { COVERED_CITIES, getDb, offers } from "@repo/db";
import { getSelectedCities, type CityFilter } from "./city-filter";
import {
  getSelectedCulturalEventFilter,
  type CulturalEventFilter,
} from "./cultural-event-filter";
import {
  getSearchTerm,
  getSelectedPeriod,
  getSelectedSources,
  PERIOD_OPTIONS,
  type PeriodFilter,
} from "./offer-filters";

export const dynamic = "force-dynamic";

const STALE_AFTER_DAYS = 3;
const TIME_ZONE = "America/Sao_Paulo";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: TIME_ZONE,
  }).format(date);
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(date);
}

function getPeriodBounds(period: PeriodFilter) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: TIME_ZONE,
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  const start = new Date(`${year}-${month}-${day}T00:00:00-03:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + period);
  return { start, end };
}

async function getAvailableSources(staleCutoff: Date) {
  const rows = await getDb()
    .selectDistinct({ source: offers.source })
    .from(offers)
    .where(gte(offers.lastSeenAt, staleCutoff))
    .orderBy(asc(offers.source));
  return rows.map(({ source }) => source);
}

async function getUpcomingOffers(
  cities: CityFilter,
  culturalEvent: CulturalEventFilter,
  period: PeriodFilter,
  sources: string[],
  search: string,
  staleCutoff: Date,
) {
  const { start, end } = getPeriodBounds(period);
  const searchPattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;

  return getDb()
    .select()
    .from(offers)
    .where(
      and(
        gte(offers.startsAt, start),
        lt(offers.startsAt, end),
        gte(offers.lastSeenAt, staleCutoff),
        cities.length > 0 ? inArray(offers.city, cities) : undefined,
        culturalEvent !== "all"
          ? eq(offers.isCulturalEvent, culturalEvent === "cultural")
          : undefined,
        sources.length > 0 ? inArray(offers.source, sources) : undefined,
        search
          ? or(
              ilike(offers.title, searchPattern),
              ilike(offers.venueName, searchPattern),
            )
          : undefined,
      ),
    )
    .orderBy(asc(offers.startsAt));
}

function groupByDate<T extends { startsAt: Date }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = formatDate(item.startsAt);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{
    city?: string | string[];
    cultural?: string | string[];
    period?: string | string[];
    source?: string | string[];
    search?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const selectedCities = getSelectedCities(params.city);
  const selectedCulturalEvent = getSelectedCulturalEventFilter(params.cultural);
  const selectedPeriod = getSelectedPeriod(params.period);
  const search = getSearchTerm(params.search);
  const staleCutoff = new Date();
  staleCutoff.setDate(staleCutoff.getDate() - STALE_AFTER_DAYS);
  const availableSources = await getAvailableSources(staleCutoff);
  const selectedSources = getSelectedSources(params.source, availableSources);
  const upcomingOffers = await getUpcomingOffers(
    selectedCities,
    selectedCulturalEvent,
    selectedPeriod,
    selectedSources,
    search,
    staleCutoff,
  );
  const groupedByDate = groupByDate(upcomingOffers);

  return (
    <main className="page">
      <header className="header">
        <div className="brandRow">
          <span className="brand">compasso</span>
          <span className="brandDetail">agenda de eventos</span>
        </div>
        <h1>
          O que acontece{" "}
          {selectedCities.length === 0
            ? "por aqui"
            : selectedCities.length === 1
              ? `em ${selectedCities[0]}`
              : `em ${selectedCities.length} cidades`}
        </h1>
        <p>Eventos reunidos de várias plataformas.</p>
      </header>

      <form className="filters" method="get" role="search">
        <div className="filterField">
          <label htmlFor="search">Buscar evento ou local</label>
          <input
            id="search"
            name="search"
            type="search"
            maxLength={100}
            placeholder="Nome do evento, casa de show..."
            defaultValue={search}
          />
        </div>
        <div className="filterGrid">
          <div className="filterField">
            <label htmlFor="city">Cidade</label>
            <select
              id="city"
              name="city"
              multiple
              size={Math.min(COVERED_CITIES.length, 4)}
              defaultValue={selectedCities}
              aria-describedby="cityHint"
            >
              {COVERED_CITIES.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
            <span id="cityHint" className="filterHint">
              Selecione várias com Ctrl/⌘. Nenhuma seleção mostra todas.
            </span>
          </div>
          <div className="filterField">
            <label htmlFor="period">Quando</label>
            <select id="period" name="period" defaultValue={selectedPeriod}>
              {PERIOD_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  Próximos {days} dias
                </option>
              ))}
            </select>
          </div>
          <div className="filterField">
            <label htmlFor="cultural">Tipo</label>
            <select
              id="cultural"
              name="cultural"
              defaultValue={selectedCulturalEvent}
            >
              <option value="all">Todos os eventos</option>
              <option value="cultural">Somente culturais</option>
              <option value="not_cultural">Somente não culturais</option>
            </select>
          </div>
          <div className="filterField">
            <label htmlFor="source">Fonte</label>
            <select
              id="source"
              name="source"
              multiple
              size={Math.min(Math.max(availableSources.length, 2), 4)}
              defaultValue={selectedSources}
              aria-describedby="sourceHint"
            >
              {availableSources.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>
            <span id="sourceHint" className="filterHint">
              Selecione várias com Ctrl/⌘. Nenhuma seleção mostra todas.
            </span>
          </div>
        </div>
        <div className="filterActions">
          <button type="submit">Mostrar eventos</button>
          <a href="/">Limpar</a>
        </div>
      </form>

      <div className="resultCount" aria-live="polite">
        <strong>{upcomingOffers.length}</strong>{" "}
        {upcomingOffers.length === 1
          ? "evento encontrado"
          : "eventos encontrados"}
      </div>
      {upcomingOffers.length === 0 && (
        <p className="empty">Nenhum evento encontrado para estes filtros.</p>
      )}

      {[...groupedByDate.entries()].map(([date, dateOffers]) => (
        <section key={date} className="dateGroup">
          <h2>
            {date}{" "}
            <span>
              {dateOffers.length}{" "}
              {dateOffers.length === 1 ? "evento" : "eventos"}
            </span>
          </h2>
          <ul className="eventList">
            {dateOffers.map((offer) => (
              <li key={offer.id} className="eventRow">
                <a href={offer.url} target="_blank" rel="noopener noreferrer">
                  <time
                    className="eventTime"
                    dateTime={offer.startsAt.toISOString()}
                  >
                    {formatTime(offer.startsAt)}
                  </time>
                  <span className="eventBody">
                    <strong>{offer.title}</strong>
                    <span>
                      {[offer.venueName, offer.city]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
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
