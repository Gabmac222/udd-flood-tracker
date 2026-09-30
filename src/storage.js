import { seedReports, PLACES, TTL, validateReport } from "./data.js";
export const API_BASE = import.meta.env.VITE_API_BASE || "";
export const SERVER_MODE = Boolean(API_BASE);
let database;
function openDB() {
  if (!database)
    database = new Promise((resolve, reject) => {
      const r = indexedDB.open("udd-react-testing-v2", 1);
      r.onupgradeneeded = () => {
        for (const store of ["reports", "queue", "rescues", "settings"])
          r.result.createObjectStore(store);
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  return database;
}
export async function dbOp(store, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode),
      req = fn(tx.objectStore(store));
    let result;
    req.onsuccess = () => {
      result = req.result;
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error || new Error("Local storage unavailable."));
  });
}
const read = (s, k) => dbOp(s, "readonly", (x) => x.get(k));
const write = (s, k, v) => dbOp(s, "readwrite", (x) => x.put(v, k));
const all = (s) => dbOp(s, "readonly", (x) => x.getAll());
const remove = (s, k) => dbOp(s, "readwrite", (x) => x.delete(k));
let device;
async function identity() {
  if (!device) {
    device = await read("settings", "device");
    if (!device) {
      device = crypto.randomUUID();
      await write("settings", "device", device);
    }
  }
  return device;
}
async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(API_BASE + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        "X-Device-ID": await identity(),
      },
      signal: AbortSignal.timeout(7000),
    });
  } catch {
    throw Object.assign(
      new Error("Local server unavailable. Your report is safe in the outbox."),
      { network: true },
    );
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}
export async function initialise() {
  await identity();
  if (!(await read("settings", "seeded"))) {
    for (const report of seedReports())
      await write("reports", report.id, report);
    await write("settings", "seeded", true);
  }
}
export async function loadReports() {
  if (SERVER_MODE) {
    try {
      const reports = await api("/reports?history=1");
      await write("settings", "snapshot", { reports, at: Date.now() });
      return { reports, connected: true };
    } catch (error) {
      const saved = await read("settings", "snapshot");
      if (saved)
        return { reports: saved.reports, connected: false, cachedAt: saved.at };
      throw error;
    }
  }
  return { reports: await all("reports"), connected: navigator.onLine };
}
export async function saveReport(input) {
  const payload = validateReport(input);
  if (SERVER_MODE) {
    await write("queue", payload.id, payload);
    const result = await syncReports();
    return result;
  }
  const row = {
    ...payload,
    place: PLACES.find((p) => p.id === payload.place),
    received: Date.now(),
    expires: payload.observed + TTL,
    sample: false,
    mine: true,
    confirmations: 0,
    confirmed: false,
    hasPhoto: !!payload.photo,
  };
  await write("reports", row.id, row);
  return { sent: 1, pending: 0 };
}
export async function syncReports() {
  if (!SERVER_MODE) return { sent: 0, pending: 0 };
  let sent = 0;
  for (const item of await all("queue")) {
    try {
      await api("/reports", { method: "POST", body: JSON.stringify(item) });
      await remove("queue", item.id);
      sent++;
    } catch (error) {
      if (error.network) break;
      await write("queue", item.id, { ...item, error: error.message });
    }
  }
  return { sent, pending: (await all("queue")).length };
}
export const getQueue = () => all("queue");
export const discardQueued = (id) => remove("queue", id);
export async function deleteReport(id) {
  if (SERVER_MODE) return api(`/reports/${id}`, { method: "DELETE" });
  const report = await read("reports", id);
  if (!report?.mine) throw new Error("Only your own reports can be removed.");
  await remove("reports", id);
}
export const photoSource = (r) =>
  SERVER_MODE ? `${API_BASE}/reports/${r.id}/photo` : r.photo;
export async function confirmReport(id) {
  if (!SERVER_MODE)
    throw new Error("Community confirmation requires the local server.");
  return api(`/reports/${id}/confirm`, { method: "POST", body: "{}" });
}
export async function saveRescue(payload) {
  if (
    !PLACES.some((p) => p.id === payload.place) ||
    !Number.isInteger(payload.people) ||
    payload.people < 1 ||
    payload.people > 50 ||
    typeof payload.needs !== "string" ||
    payload.needs.length > 400
  )
    throw new Error(
      "Choose a location, 1–50 people, and at most 400 characters.",
    );
  if (SERVER_MODE)
    return api("/rescues", { method: "POST", body: JSON.stringify(payload) });
  const record = {
    ...payload,
    created: Date.now(),
    status: "Saved on this device · not dispatched",
  };
  await write("rescues", record.id, record);
  return record;
}
export const loadRescues = () =>
  SERVER_MODE ? api("/rescues") : all("rescues");
export const deleteRescue = (id) =>
  SERVER_MODE
    ? api(`/rescues/${id}`, { method: "DELETE" })
    : remove("rescues", id);
export const getSetting = (key) => read("settings", key);
export const setSetting = (key, value) => write("settings", key, value);
export async function resetSamples() {
  for (const r of seedReports()) await write("reports", r.id, r);
}
