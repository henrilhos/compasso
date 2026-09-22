import { describe, expect, it } from "vitest";
import { parseDate, parseLocalDateTime } from "./date";

describe("parseDate", () => {
  it("parses an ISO string with a Z offset directly", () => {
    expect(parseDate("2024-08-10T21:00:00Z").toISOString()).toBe(
      "2024-08-10T21:00:00.000Z",
    );
  });

  it("parses an ISO string with an explicit numeric offset directly", () => {
    expect(parseDate("2024-08-10T21:00:00+00:00").toISOString()).toBe(
      "2024-08-10T21:00:00.000Z",
    );
    expect(parseDate("2024-08-10T18:00:00-03:00").toISOString()).toBe(
      "2024-08-10T21:00:00.000Z",
    );
  });

  it("interprets a naive local datetime in America/Sao_Paulo", () => {
    // 21h local on a Saturday is 00h UTC on Sunday — the case where a
    // naive UTC parse silently throws the show onto the wrong day.
    expect(parseDate("2024-08-10T21:00:00").toISOString()).toBe(
      "2024-08-11T00:00:00.000Z",
    );
  });

  it("interprets a naive local datetime with a space separator", () => {
    expect(parseDate("2024-08-10 21:00:00").toISOString()).toBe(
      "2024-08-11T00:00:00.000Z",
    );
  });

  it("interprets a naive local datetime without seconds", () => {
    expect(parseDate("2024-08-10T21:00").toISOString()).toBe(
      "2024-08-11T00:00:00.000Z",
    );
  });
});

describe("parseLocalDateTime", () => {
  it("combines separate date and time fields in the given timezone", () => {
    expect(
      parseLocalDateTime("2024-08-10", "21:00:00", "America/Sao_Paulo").toISOString(),
    ).toBe("2024-08-11T00:00:00.000Z");
  });

  it("defaults to America/Sao_Paulo when no timezone is given", () => {
    expect(parseLocalDateTime("2024-08-10", "21:00:00").toISOString()).toBe(
      "2024-08-11T00:00:00.000Z",
    );
  });

  it("supports other IANA timezones", () => {
    expect(
      parseLocalDateTime("2024-08-10", "21:00:00", "UTC").toISOString(),
    ).toBe("2024-08-10T21:00:00.000Z");
  });
});
