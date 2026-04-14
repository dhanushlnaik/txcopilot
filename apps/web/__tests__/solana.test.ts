import { describe, expect, it } from "vitest";
import { isValidSignature } from "@/lib/solana";

const VALID_SIGNATURE =
  "56YU2EU1AkRuZjDg2PQ8b4G2GK4iyrFq8mD6RzNhtD21pQXC7Hdb6VJqPdqv2MjqbKDVTmfoyYhtrKgHRNNuwbo";

describe("isValidSignature", () => {
  it("validates correct signatures", () => {
    expect(isValidSignature(VALID_SIGNATURE)).toBe(true);
  });

  it("rejects invalid signatures", () => {
    expect(isValidSignature("short")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidSignature("")).toBe(false);
  });

  it("rejects non-base58 characters", () => {
    const invalid = `${"A".repeat(85)}0`;
    expect(isValidSignature(invalid)).toBe(false);
  });
});
