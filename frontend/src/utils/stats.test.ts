import { describe, expect, it } from "vitest";
import { groupPassRate, pct, toCsv } from "./stats";

describe("stats utils", () => {
  it("pct handles zero totals", () => { expect(pct(1, 0)).toBe("-"); expect(pct(1, 4)).toBe("25.0%"); });
  it("toCsv escapes commas, quotes and newlines", () => {
    expect(toCsv([["a,b", 'say "hi"', "x\ny", null]])).toBe('"a,b","say ""hi""","x\ny",');
  });
  it("groups pass rate by key", () => {
    const r = groupPassRate([{ status: "PASS", c: "A" }, { status: "FAIL", c: "A" }, { status: "PASS", c: "B" }], i => i.c);
    expect(r.find(x => x.name === "A")).toMatchObject({ total: 2, pass: 1, fail: 1, pass_rate: 50 });
    expect(r.find(x => x.name === "B")?.pass_rate).toBe(100);
  });
});
