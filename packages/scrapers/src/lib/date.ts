const DEFAULT_TIME_ZONE = "America/Sao_Paulo";

// Trailing Z or a numeric offset like +00:00 / -0300.
const HAS_EXPLICIT_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

/**
 * Offset (in ms) that `timeZone` was at `utcMillis`, i.e. the amount to add
 * to a UTC instant to get the wall-clock time in that zone.
 */
function offsetMillisAt(utcMillis: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(utcMillis));

  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);

  const wallClockAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );

  return wallClockAsUtc - utcMillis;
}

/**
 * Combines a `YYYY-MM-DD` date and an `HH:mm[:ss]` time, interpreted as
 * wall-clock time in `timeZone` (default `America/Sao_Paulo`), into the
 * `Date` instant they refer to.
 */
export function parseLocalDateTime(
  date: string,
  time: string,
  timeZone: string = DEFAULT_TIME_ZONE,
): Date {
  const dateMatch = DATE_RE.exec(date);
  if (!dateMatch) {
    throw new Error(`Invalid date "${date}", expected YYYY-MM-DD`);
  }
  const timeMatch = TIME_RE.exec(time);
  if (!timeMatch) {
    throw new Error(`Invalid time "${time}", expected HH:mm[:ss]`);
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = timeMatch[3] ? Number(timeMatch[3]) : 0;

  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, second);
  const offset = offsetMillisAt(utcGuess, timeZone);

  return new Date(utcGuess - offset);
}

/**
 * Parses a source-provided date string into a `Date`. ISO strings with an
 * explicit offset (`Z` or `+HH:MM`) are parsed directly. A naive string
 * with no offset is treated as wall-clock time in `timeZone` (default
 * `America/Sao_Paulo`) — never as UTC, which is the 3-hour bug that moves
 * a Saturday night show to Sunday.
 */
export function parseDate(
  input: string,
  timeZone: string = DEFAULT_TIME_ZONE,
): Date {
  if (HAS_EXPLICIT_OFFSET.test(input)) {
    return new Date(input);
  }

  const separatorIndex = input.search(/[T ]/);
  const date = separatorIndex === -1 ? input : input.slice(0, separatorIndex);
  const time =
    separatorIndex === -1 ? "00:00:00" : input.slice(separatorIndex + 1);
  return parseLocalDateTime(date, time, timeZone);
}
