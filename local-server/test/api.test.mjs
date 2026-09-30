import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";
import { createApp } from "../server.mjs";
let app, base;
const device = randomUUID(),
  other = randomUUID();
before(async () => {
  app = createApp({ dbPath: ":memory:", seed: false });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${app.server.address().port}`;
});
after(async () => {
  await new Promise((r) => app.server.close(r));
  app.db.close();
});
async function request(
  path,
  { method = "GET", body, owner = device, headers = {} } = {},
) {
  const response = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Device-ID": owner,
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
}
function report(extra = {}) {
  return {
    id: randomUUID(),
    place: "perez",
    level: 3,
    note: "Test observation",
    observed: Date.now(),
    ...extra,
  };
}
test("deck scale has the five exact depth ranges", async () => {
  const { data } = await request("/api/bootstrap");
  assert.deepEqual(
    data.levels.map((l) => l.depth),
    ["0–15 cm", "15–30 cm", "30–60 cm", "60–100 cm", "100+ cm"],
  );
});
test("reports are persistent, anonymous in responses and retries are idempotent", async () => {
  const body = report();
  const a = await request("/api/reports", { method: "POST", body });
  assert.equal(a.status, 201);
  assert.equal(a.data.mine, true);
  assert.equal(a.data.owner, undefined);
  assert.equal(a.data.sample, false);
  assert.equal(a.data.level, 3);
  assert.equal(
    (await request("/api/reports", { method: "POST", body })).status,
    200,
  );
  const list = await request("/api/reports");
  assert.equal(list.data.filter((r) => r.id === body.id).length, 1);
  assert.equal(
    (await request("/api/reports", { method: "POST", body, owner: other }))
      .status,
    409,
  );
});
test("expiry is based on observed time, including offline uploads", async () => {
  const body = report({ observed: Date.now() - 3 * 60 * 60 * 1000 });
  await request("/api/reports", { method: "POST", body });
  assert.ok(
    !(await request("/api/reports")).data.some((r) => r.id === body.id),
  );
  const historical = (await request("/api/reports?history=1")).data.find(
    (r) => r.id === body.id,
  );
  assert.equal(historical.expired, true);
  assert.equal(
    (
      await request(`/api/reports/${body.id}/confirm`, {
        method: "POST",
        body: {},
        owner: other,
      })
    ).status,
    400,
  );
});
test("invalid depth, road, time, identity, and huge notes are rejected", async () => {
  for (const extra of [
    { level: 0 },
    { level: 6 },
    { level: 2.2 },
    { place: "invented" },
    { observed: Date.now() + 120000 },
    { observed: Date.now() - 25 * 3600000 },
    { observed: "today" },
    { note: "x".repeat(401) },
    { id: "bad" },
  ])
    assert.equal(
      (await request("/api/reports", { method: "POST", body: report(extra) }))
        .status,
      400,
    );
  assert.equal(
    (
      await request("/api/reports", {
        method: "POST",
        body: report(),
        owner: "bad",
      })
    ).status,
    400,
  );
});
test("confirmation is once per other device and self-votes are rejected", async () => {
  const body = report();
  await request("/api/reports", { method: "POST", body });
  assert.equal(
    (
      await request(`/api/reports/${body.id}/confirm`, {
        method: "POST",
        body: {},
      })
    ).status,
    400,
  );
  for (let i = 0; i < 2; i++) {
    const r = await request(`/api/reports/${body.id}/confirm`, {
      method: "POST",
      body: {},
      owner: other,
    });
    assert.equal(r.data.confirmations, 1);
  }
  assert.equal(
    (await request("/api/reports", { owner: other })).data.find(
      (r) => r.id === body.id,
    ).confirmed,
    true,
  );
});
test("only the original device can erase its report and related votes", async () => {
  const body = report();
  await request("/api/reports", { method: "POST", body });
  await request(`/api/reports/${body.id}/confirm`, {
    method: "POST",
    body: {},
    owner: other,
  });
  assert.equal(
    (
      await request(`/api/reports/${body.id}`, {
        method: "DELETE",
        owner: other,
      })
    ).status,
    403,
  );
  assert.equal(
    (await request(`/api/reports/${body.id}`, { method: "DELETE" })).status,
    200,
  );
  assert.equal(
    app.db.prepare("SELECT COUNT(*) n FROM votes WHERE report=?").get(body.id)
      .n,
    0,
  );
  assert.equal(
    (await request(`/api/reports/${body.id}`, { method: "DELETE" })).status,
    404,
  );
});
test("rejects cross-origin writes and unexpected host headers", async () => {
  assert.equal(
    (
      await request("/api/reports", {
        method: "POST",
        body: report(),
        headers: { Origin: "https://example.com" },
      })
    ).status,
    403,
  );
  const status = await new Promise((resolve, reject) => {
    http
      .get(
        base + "/api/bootstrap",
        { headers: { Host: "attacker.example" } },
        (response) => {
          response.resume();
          resolve(response.statusCode);
        },
      )
      .on("error", reject);
  });
  assert.equal(status, 403);
});
test("no HTML or SVG uploads accepted as photos", async () => {
  for (const photo of [
    "<svg>bad</svg>",
    "data:image/svg+xml;base64,aaaa",
    "data:image/jpeg;base64,<script>",
  ])
    assert.equal(
      (
        await request("/api/reports", {
          method: "POST",
          body: report({ photo }),
        })
      ).status,
      400,
    );
});
test("rescue records are private to the submitting device and never claim dispatch", async () => {
  const body = {
    id: randomUUID(),
    place: "arellano",
    people: 3,
    needs: "Limited mobility",
  };
  assert.equal(
    (await request("/api/rescues", { method: "POST", body })).status,
    201,
  );
  const own = (await request("/api/rescues")).data.find(
    (r) => r.id === body.id,
  );
  assert.match(own.status, /not dispatched/);
  assert.equal(own.owner, undefined);
  assert.equal(
    (await request("/api/rescues", { owner: other })).data.length,
    0,
  );
  assert.equal(
    (
      await request("/api/rescues", {
        method: "POST",
        body: { ...body, id: randomUUID(), people: 0 },
      })
    ).status,
    400,
  );
});
test("route checks never call missing data or sample roads safe", async () => {
  const r = await request("/api/route", {
    method: "POST",
    body: { from: "arellano", to: "perez", vehicle: "Tricycle" },
  });
  assert.equal(r.status, 200);
  assert.match(r.data.status, /unverified/);
  assert.match(r.data.message, /cannot establish a safe route/);
  assert.equal(
    (
      await request("/api/route", {
        method: "POST",
        body: { from: "perez", to: "perez", vehicle: "Walk" },
      })
    ).status,
    400,
  );
});
test("SQLite survives restart and seed observations do not become fresh again", async () => {
  const dir = mkdtempSync(join(tmpdir(), "udd-test-")),
    dbPath = join(dir, "test.sqlite");
  let first;
  try {
    const a = createApp({ dbPath });
    first = a.db
      .prepare("SELECT observed FROM reports WHERE id=?")
      .get("sample-perez").observed;
    a.db
      .prepare("UPDATE reports SET observed=? WHERE id=?")
      .run(first - 3 * 3600000, "sample-perez");
    a.db.close();
    const b = createApp({ dbPath });
    assert.equal(
      b.db
        .prepare("SELECT observed FROM reports WHERE id=?")
        .get("sample-perez").observed,
      first - 3 * 3600000,
    );
    assert.equal(b.db.prepare("SELECT count(*) n FROM reports").get().n, 6);
    b.db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("optional GPS is rounded server-side and invalid coordinates are rejected", async () => {
  const body = report({
    location: { latitude: 16.04331234, longitude: 120.33361234, accuracy: 12 },
  });
  const r = await request("/api/reports", { method: "POST", body });
  assert.equal(r.status, 201);
  assert.equal(r.data.location.latitude, 16.043);
  assert.equal(r.data.location.longitude, 120.334);
  assert.ok(r.data.location.accuracy >= 110);
  assert.equal(
    (
      await request("/api/reports", {
        method: "POST",
        body: report({
          location: { latitude: 91, longitude: 120, accuracy: 12 },
        }),
      })
    ).status,
    400,
  );
});
test("retry remains idempotent after the original observation ages beyond 24 hours", async () => {
  const body = report();
  await request("/api/reports", { method: "POST", body });
  app.db
    .prepare("UPDATE reports SET observed=? WHERE id=?")
    .run(Date.now() - 25 * 3600000, body.id);
  const r = await request("/api/reports", {
    method: "POST",
    body: { ...body, observed: Date.now() - 25 * 3600000 },
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.expired, true);
});
test("local help records can only be deleted by their originating device", async () => {
  const body = {
    id: randomUUID(),
    place: "perez",
    people: 2,
    needs: "Test only",
  };
  await request("/api/rescues", { method: "POST", body });
  assert.equal(
    (
      await request(`/api/rescues/${body.id}`, {
        method: "DELETE",
        owner: other,
      })
    ).status,
    403,
  );
  assert.equal(
    (await request(`/api/rescues/${body.id}`, { method: "DELETE" })).status,
    200,
  );
  assert.ok(
    !(await request("/api/rescues")).data.some((r) => r.id === body.id),
  );
});
test("sample data cannot gain community confirmations", async () => {
  const id = randomUUID(),
    now = Date.now();
  app.db
    .prepare(
      "INSERT INTO reports (id,owner,place,level,note,observed,received,sample) VALUES (?,?,?,?,?,?,?,?)",
    )
    .run(id, "sample", "perez", 3, "Sample", now, now, 1);
  assert.equal(
    (await request(`/api/reports/${id}/confirm`, { method: "POST", body: {} }))
      .status,
    400,
  );
});
test("oversized JSON bodies are rejected without storing a report", async () => {
  assert.equal(
    (
      await request("/api/reports", {
        method: "POST",
        body: report({ note: "x".repeat(2_000_001) }),
      })
    ).status,
    413,
  );
});
test("Filipino text survives HTTP parsing and database storage", async () => {
  const note = "Baha sa kanto — huwag tumawid. Ingat po! 🌧️";
  const r = await request("/api/reports", {
    method: "POST",
    body: report({ note }),
  });
  assert.equal(r.data.note, note);
});
