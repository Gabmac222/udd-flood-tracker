import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = dirname(fileURLToPath(import.meta.url));
export const LEVELS = [
  { id: 1, name: "Basa Lang", depth: "0–15 cm", color: "#86F5A7" },
  { id: 2, name: "Tsinelas Level", depth: "15–30 cm", color: "#B5CB33" },
  { id: 3, name: "Tuhod Level", depth: "30–60 cm", color: "#DE9400" },
  { id: 4, name: "Swan Boat Level", depth: "60–100 cm", color: "#E15700" },
  { id: 5, name: "Jet Ski Level", depth: "100+ cm", color: "#C71430" },
];
export const PLACES = [
  { id: "arellano", name: "Arellano Street", barangay: "Pantal", x: 66, y: 29 },
  {
    id: "perez",
    name: "Perez Boulevard",
    barangay: "Pogo Chico",
    x: 53,
    y: 62,
  },
  { id: "malued", name: "Sitio Fisheries", barangay: "Malued", x: 68, y: 80 },
  {
    id: "mayombo",
    name: "Mayombo–Caranglaan Road",
    barangay: "Mayombo",
    x: 83,
    y: 65,
  },
  {
    id: "fernandez",
    name: "A.B. Fernandez Avenue",
    barangay: "Downtown",
    x: 47,
    y: 43,
  },
  { id: "tapuac", name: "Tapuac Road", barangay: "Tapuac", x: 24, y: 48 },
];
const TTL = 2 * 60 * 60 * 1000;
const fail = (message, status = 400) =>
  Object.assign(new Error(message), { status });
function string(v, max, min = 0) {
  if (typeof v !== "string" || v.trim().length < min || v.length > max)
    throw fail("Invalid text field.");
  return v.trim();
}
function client(v) {
  if (typeof v !== "string" || !/^[a-zA-Z0-9-]{20,64}$/.test(v))
    throw fail("Invalid device identifier.");
  return v;
}
export function createApp({
  dbPath = resolve(ROOT, "data/flood-tracker.sqlite"),
  seed = true,
} = {}) {
  if (dbPath !== ":memory:")
    mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, owner TEXT NOT NULL, place TEXT NOT NULL, level INTEGER NOT NULL, note TEXT NOT NULL, observed INTEGER NOT NULL, received INTEGER NOT NULL, sample INTEGER NOT NULL, photo TEXT);
 CREATE TABLE IF NOT EXISTS votes(report TEXT NOT NULL, device TEXT NOT NULL, PRIMARY KEY(report,device));
 CREATE TABLE IF NOT EXISTS rescues(id TEXT PRIMARY KEY, owner TEXT NOT NULL, place TEXT NOT NULL, people INTEGER NOT NULL, needs TEXT NOT NULL, created INTEGER NOT NULL, status TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY, value TEXT);`);
  if (
    !db
      .prepare("PRAGMA table_info(reports)")
      .all()
      .some((c) => c.name === "location")
  )
    db.exec("ALTER TABLE reports ADD COLUMN location TEXT");
  if (
    seed &&
    !db.prepare("SELECT value FROM metadata WHERE key='seeded'").get()
  ) {
    const insert = db.prepare(
      "INSERT INTO reports (id,owner,place,level,note,observed,received,sample,photo) VALUES (?,?,?,?,?,?,?,?,?)",
    );
    [
      ["perez", 4, "Standing water reported near the intersection.", 7],
      [
        "arellano",
        3,
        "Water covering the roadside. Depth manually tagged.",
        12,
      ],
      ["malued", 5, "Deep water reported. Do not enter.", 18],
      ["mayombo", 3, "Water across the road. Avoid this section.", 26],
      ["fernandez", 2, "Shallow pooling observed. Conditions can change.", 39],
      [
        "tapuac",
        1,
        "Wet road reported; this does not establish passability.",
        53,
      ],
    ].forEach(([place, level, note, age]) => {
      const now = Date.now() - age * 60000;
      insert.run(
        `sample-${place}`,
        "sample",
        place,
        level,
        note,
        now,
        now,
        1,
        null,
      );
    });
    db.prepare("INSERT INTO metadata VALUES ('seeded','true')").run();
  }
  const view = (r, device) => ({
    ...r,
    location: r.location ? JSON.parse(r.location) : null,
    owner: undefined,
    photo: undefined,
    hasPhoto: !!r.photo,
    place: PLACES.find((p) => p.id === r.place),
    sample: !!r.sample,
    mine: r.owner === device,
    expired: Date.now() - r.observed > TTL,
    expires: r.observed + TTL,
    confirmations: db
      .prepare("SELECT count(*) AS n FROM votes WHERE report=?")
      .get(r.id).n,
    confirmed: !!db
      .prepare("SELECT 1 FROM votes WHERE report=? AND device=?")
      .get(r.id, device || ""),
  });
  async function handler(req, res) {
    const send = (status, body, type = "application/json") => {
      res.writeHead(status, {
        "Content-Type": type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer",
        "Content-Security-Policy":
          "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      });
      res.end(type === "application/json" ? JSON.stringify(body) : body);
    };
    try {
      const host = req.headers.host || "";
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host))
        throw fail("Local access only.", 403);
      if (req.headers.origin && req.headers.origin !== `http://${host}`)
        throw fail("Cross-origin request rejected.", 403);
      const u = new URL(req.url, `http://${host}`),
        path = u.pathname,
        method = req.method;
      let body = {};
      if (["POST", "PATCH"].includes(method)) {
        if (
          req.headers["content-type"]?.split(";")[0].trim() !==
          "application/json"
        )
          throw fail("Use application/json.", 415);
        const chunks = [];
        let bytes = 0;
        for await (const chunk of req) {
          bytes += chunk.length;
          if (bytes <= 2_000_000) chunks.push(chunk);
        }
        if (bytes > 2_000_000) throw fail("Request too large.", 413);
        const raw = Buffer.concat(chunks).toString("utf8");
        try {
          body = JSON.parse(raw);
        } catch {
          throw fail("Invalid JSON.");
        }
        if (!body || typeof body !== "object" || Array.isArray(body))
          throw fail("Invalid request.");
      }
      const device = req.headers["x-device-id"];
      if (path === "/api/bootstrap" && method === "GET")
        return send(200, {
          levels: LEVELS,
          places: PLACES,
          ttl: TTL,
          mode: "local-demo",
        });
      if (path === "/api/reports" && method === "GET") {
        const reports = db
          .prepare("SELECT * FROM reports ORDER BY observed DESC")
          .all()
          .map((r) => view(r, device));
        return send(
          200,
          reports.filter(
            (r) => u.searchParams.get("history") === "1" || !r.expired,
          ),
        );
      }
      if (path === "/api/reports" && method === "POST") {
        const owner = client(device),
          id = client(body.id);
        const old = db.prepare("SELECT * FROM reports WHERE id=?").get(id);
        if (old) {
          if (old.owner !== owner) throw fail("Identifier conflict.", 409);
          return send(200, view(old, owner));
        }
        const place = string(body.place, 30, 1),
          level = body.level;
        if (!PLACES.some((p) => p.id === place))
          throw fail("Choose a supported Dagupan road.");
        if (!Number.isInteger(level) || level < 1 || level > 5)
          throw fail("Choose a Baha Level from 1 to 5.");
        const observed = body.observed;
        if (
          !Number.isSafeInteger(observed) ||
          observed > Date.now() + 60000 ||
          observed < Date.now() - 86400000
        )
          throw fail(
            "Observation must be within the last 24 hours, not in the future.",
          );
        const note = string(body.note || "", 400);
        let location = null;
        if (body.location !== undefined && body.location !== null) {
          const g = body.location;
          if (
            typeof g !== "object" ||
            !Number.isFinite(g.latitude) ||
            !Number.isFinite(g.longitude) ||
            !Number.isFinite(g.accuracy) ||
            Math.abs(g.latitude) > 90 ||
            Math.abs(g.longitude) > 180 ||
            g.accuracy < 0 ||
            g.accuracy > 100000
          )
            throw fail("Invalid GPS observation.");
          location = JSON.stringify({
            latitude: Number(g.latitude.toFixed(3)),
            longitude: Number(g.longitude.toFixed(3)),
            accuracy: Math.max(110, Math.round(g.accuracy)),
            source: "Device GPS · unverified · rounded to 0.001°",
          });
        }
        let photo = null;
        if (body.photo) {
          photo = string(body.photo, 1_700_000);
          if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(photo))
            throw fail("Photo must be a processed JPEG.");
          const bytes = Buffer.from(photo.split(",")[1], "base64");
          if (
            bytes.length < 5 ||
            bytes[0] !== 255 ||
            bytes[1] !== 216 ||
            bytes[2] !== 255 ||
            bytes.at(-2) !== 255 ||
            bytes.at(-1) !== 217
          )
            throw fail("Invalid JPEG photo.");
        }
        db.prepare(
          "INSERT INTO reports (id,owner,place,level,note,observed,received,sample,photo) VALUES (?,?,?,?,?,?,?,?,?)",
        ).run(id, owner, place, level, note, observed, Date.now(), 0, photo);
        if (location)
          db.prepare("UPDATE reports SET location=? WHERE id=?").run(
            location,
            id,
          );
        return send(
          201,
          view(db.prepare("SELECT * FROM reports WHERE id=?").get(id), owner),
        );
      }
      const reportMatch = path.match(
        /^\/api\/reports\/([\w-]+)(\/confirm|\/photo)?$/,
      );
      if (reportMatch) {
        const r = db
          .prepare("SELECT * FROM reports WHERE id=?")
          .get(reportMatch[1]);
        if (!r) throw fail("Report not found.", 404);
        if (method === "GET" && reportMatch[2] === "/photo") {
          if (!r.photo) throw fail("No photo.", 404);
          return send(
            200,
            Buffer.from(r.photo.split(",")[1], "base64"),
            "image/jpeg",
          );
        }
        const owner = client(device);
        if (method === "POST" && reportMatch[2] === "/confirm") {
          if (r.sample) throw fail("Sample observations cannot be confirmed.");
          if (r.owner === owner)
            throw fail("You cannot confirm your own report.");
          if (Date.now() - r.observed > TTL)
            throw fail("This report has expired. Submit a new observation.");
          db.prepare("INSERT OR IGNORE INTO votes VALUES (?,?)").run(
            r.id,
            owner,
          );
          return send(200, view(r, owner));
        }
        if (method === "DELETE" && !reportMatch[2]) {
          if (r.owner !== owner)
            throw fail(
              "Only the originating device can remove this report.",
              403,
            );
          db.prepare("DELETE FROM votes WHERE report=?").run(r.id);
          db.prepare("DELETE FROM reports WHERE id=?").run(r.id);
          return send(200, { deleted: true });
        }
      }
      if (path === "/api/rescues" && method === "GET") {
        const owner = client(device);
        return send(
          200,
          db
            .prepare(
              "SELECT id,place,people,needs,created,status FROM rescues WHERE owner=? ORDER BY created DESC",
            )
            .all(owner),
        );
      }
      const rescueMatch = path.match(/^\/api\/rescues\/([\w-]+)$/);
      if (rescueMatch && method === "DELETE") {
        const owner = client(device),
          record = db
            .prepare("SELECT owner FROM rescues WHERE id=?")
            .get(rescueMatch[1]);
        if (!record) throw fail("Record not found.", 404);
        if (record.owner !== owner)
          throw fail(
            "Only the originating device can remove this record.",
            403,
          );
        db.prepare("DELETE FROM rescues WHERE id=?").run(rescueMatch[1]);
        return send(200, { deleted: true });
      }
      if (path === "/api/rescues" && method === "POST") {
        const owner = client(device),
          id = client(body.id),
          place = string(body.place, 30, 1),
          needs = string(body.needs || "", 400);
        if (
          !PLACES.some((p) => p.id === place) ||
          !Number.isInteger(body.people) ||
          body.people < 1 ||
          body.people > 50
        )
          throw fail("Choose a location and 1–50 people.");
        const old = db.prepare("SELECT owner FROM rescues WHERE id=?").get(id);
        if (old && old.owner !== owner) throw fail("Identifier conflict.", 409);
        db.prepare("INSERT OR IGNORE INTO rescues VALUES (?,?,?,?,?,?,?)").run(
          id,
          owner,
          place,
          body.people,
          needs,
          Date.now(),
          "Recorded locally · not dispatched",
        );
        return send(201, { id, status: "Recorded locally · not dispatched" });
      }
      if (path === "/api/route" && method === "POST") {
        if (
          !PLACES.some((p) => p.id === body.from) ||
          !PLACES.some((p) => p.id === body.to) ||
          body.from === body.to
        )
          throw fail("Select two different roads.");
        if (
          !["Walk", "Tricycle", "Motorcycle", "Car", "Jeepney / SUV"].includes(
            body.vehicle,
          )
        )
          throw fail("Select a travel mode.");
        const reports = db
          .prepare(
            "SELECT * FROM reports WHERE observed>? AND place IN (?,?) ORDER BY observed DESC",
          )
          .all(Date.now() - TTL, body.from, body.to)
          .map((r) => view(r, device));
        return send(200, {
          status: "Route safety unverified",
          message:
            "No validated road network or routing service is connected. Endpoint observations cannot establish a safe route. Do not use this check for navigation.",
          reports,
        });
      }
      if (path.startsWith("/api/")) throw fail("Endpoint not found.", 404);
      if (method !== "GET") throw fail("Method not allowed.", 405);
      const file = resolve(
        ROOT,
        "public",
        path === "/" ? "index.html" : "." + decodeURIComponent(path),
      );
      if (!file.startsWith(resolve(ROOT, "public") + "/"))
        throw fail("Not found.", 404);
      let content;
      try {
        content = readFileSync(file);
      } catch {
        throw fail("Not found.", 404);
      }
      return send(
        200,
        content,
        {
          ".html": "text/html; charset=utf-8",
          ".css": "text/css",
          ".js": "text/javascript",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".webmanifest": "application/manifest+json",
        }[extname(file)] || "application/octet-stream",
      );
    } catch (e) {
      send(e.status || 500, {
        error: e.status ? e.message : "Unable to complete this request.",
      });
    }
  }
  const server = http.createServer(handler);
  return { server, db };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { server, db } = createApp();
  server.listen(Number(process.env.PORT || 4173), "127.0.0.1", () =>
    console.log(
      `UDD Flood Tracker: http://127.0.0.1:${server.address().port} (local demo)`,
    ),
  );
  const shutdown = () =>
    server.close(() => {
      db.close();
      process.exit(0);
    });
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
