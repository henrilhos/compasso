import { describe, expect, it, vi } from "vitest";
import { validateRawOffers } from "./validation";

const validCandidate = {
  sourceOfferId: "123",
  title: "Show de rock",
  url: "https://example.com/eventos/123",
  city: "Joinville",
  startsAt: new Date("2024-08-10T21:00:00Z"),
};

describe("validateRawOffers", () => {
  it("keeps a valid candidate", () => {
    const { offers, skipped } = validateRawOffers("sympla", [validCandidate]);
    expect(offers).toEqual([validCandidate]);
    expect(skipped).toBe(0);
  });

  it("drops a candidate missing a required field", () => {
    const { title: _title, ...missingTitle } = validCandidate;
    const { offers, skipped } = validateRawOffers("sympla", [missingTitle]);
    expect(offers).toEqual([]);
    expect(skipped).toBe(1);
  });

  it("drops a candidate whose city isn't a Covered City", () => {
    const { offers, skipped } = validateRawOffers("sympla", [
      { ...validCandidate, city: "Pomerode" },
    ]);
    expect(offers).toEqual([]);
    expect(skipped).toBe(1);
  });

  it("drops a candidate with an invalid url", () => {
    const { offers, skipped } = validateRawOffers("sympla", [
      { ...validCandidate, url: "not-a-url" },
    ]);
    expect(offers).toEqual([]);
    expect(skipped).toBe(1);
  });

  it("keeps valid candidates and drops invalid ones independently", () => {
    const { offers, skipped } = validateRawOffers("sympla", [
      validCandidate,
      { ...validCandidate, sourceOfferId: "456", city: "Dublin" },
      { ...validCandidate, sourceOfferId: "789" },
    ]);
    expect(offers.map((o) => o.sourceOfferId)).toEqual(["123", "789"]);
    expect(skipped).toBe(1);
  });

  it("logs the sourceOfferId of each discarded candidate", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    validateRawOffers("sympla", [{ ...validCandidate, city: "Dublin" }]);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("sympla"),
      expect.stringContaining("123"),
      expect.anything(),
    );
    warn.mockRestore();
  });

  it("logs an unknown marker when sourceOfferId itself is missing or invalid", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { sourceOfferId: _id, ...noId } = validCandidate;
    validateRawOffers("sympla", [noId]);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("sympla"),
      expect.stringContaining("unknown"),
      expect.anything(),
    );
    warn.mockRestore();
  });

  it("accepts the optional fields when present", () => {
    const full = {
      ...validCandidate,
      description: "Uma noite de rock",
      imageUrl: "https://example.com/img.jpg",
      venueName: "Arena",
      address: "Rua X, 100",
      endsAt: new Date("2024-08-11T02:00:00Z"),
    };
    const { offers, skipped } = validateRawOffers("sympla", [full]);
    expect(offers).toEqual([full]);
    expect(skipped).toBe(0);
  });
});
