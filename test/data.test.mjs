import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LEVELS,
  TTL,
  seedReports,
  filterReports,
  groupReports,
  validateReport,
  expired,
} from "../src/data.js";
test("five deck levels preserve names and depth ranges", () => {
  assert.deepEqual(
    LEVELS.map((x) => x.depth),
    ["0–15 cm", "15–30 cm", "30–60 cm", "60–100 cm", "100+ cm"],
  );
  assert.equal(LEVELS[3].name, "Swan Boat Level");
});
test("samples are explicit and expire from their observed time", () => {
  const reports = seedReports(Date.now() - TTL);
  assert.ok(reports.every((r) => r.sample && !r.mine && expired(r)));
  assert.equal(filterReports(reports).length, 0);
  assert.equal(filterReports(reports, { history: true }).length, 6);
});
test("search and depth filters combine", () => {
  const data = seedReports();
  assert.equal(filterReports(data, { query: "pogo", level: 4 }).length, 1);
  assert.equal(filterReports(data, { query: "pogo", level: 1 }).length, 0);
  assert.equal(filterReports(data, { mine: true }).length, 0);
});
test("conflicting observations retain the highest road level", () => {
  const data = seedReports();
  data.push({ ...data[0], id: "new", level: 1 });
  const group = groupReports(data).find((g) => g.place.id === "perez");
  assert.equal(group.level, 4);
  assert.equal(group.reports.length, 2);
});
test("report validation prevents future and stale submissions", () => {
  const r = {
    id: "test",
    place: "perez",
    level: 3,
    note: "Baha po.",
    observed: Date.now(),
  };
  assert.equal(validateReport(r).location, null);
  for (const extra of [
    { level: 6 },
    { level: 2.5 },
    { place: "invented" },
    { observed: Date.now() + 120000 },
    { observed: Date.now() - 25 * 3600000 },
    { note: "x".repeat(401) },
  ])
    assert.throws(() => validateReport({ ...r, ...extra }));
});
test("shared GPS is rounded and invalid coordinates rejected", () => {
  const r = {
    place: "perez",
    level: 2,
    note: "",
    observed: Date.now(),
    location: { latitude: 16.0433123, longitude: 120.3336123, accuracy: 12 },
  };
  const saved = validateReport(r);
  assert.equal(saved.location.latitude, 16.043);
  assert.equal(saved.location.longitude, 120.334);
  assert.equal(saved.location.accuracy, 110);
  assert.throws(() =>
    validateReport({
      ...r,
      location: { latitude: 92, longitude: 120, accuracy: 10 },
    }),
  );
});
