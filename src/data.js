export const LEVELS = [
  {
    id: 1,
    name: "Basa Lang",
    depth: "0–15 cm",
    color: "#86F5A7",
    ink: "#20532e",
    description: "Wet or shallow pooling. Road safety is still unverified.",
  },
  {
    id: 2,
    name: "Tsinelas Level",
    depth: "15–30 cm",
    color: "#B5CB33",
    ink: "#465400",
    description: "Ankle-depth range. Avoid entering floodwater.",
  },
  {
    id: 3,
    name: "Tuhod Level",
    depth: "30–60 cm",
    color: "#DE9400",
    ink: "#805300",
    description: "Knee-depth range. Small vehicles should turn back.",
  },
  {
    id: 4,
    name: "Swan Boat Level",
    depth: "60–100 cm",
    color: "#E15700",
    ink: "#963b00",
    description: "Waist-depth range. Impassable to most vehicles.",
  },
  {
    id: 5,
    name: "Jet Ski Level",
    depth: "100+ cm",
    color: "#C71430",
    ink: "#ae1029",
    description: "Deep floodwater. Do not enter. Life-threatening.",
  },
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
export const TTL = 2 * 60 * 60 * 1000;
export function seedReports(now = Date.now()) {
  return [
    ["perez", 4, 7, "Standing water near the intersection."],
    ["arellano", 3, 12, "Water covering the roadside. Depth manually tagged."],
    ["malued", 5, 18, "Deep water reported. Do not enter."],
    ["mayombo", 3, 26, "Water across the road. Avoid this section."],
    ["fernandez", 2, 39, "Shallow pooling observed. Conditions can change."],
    ["tapuac", 1, 53, "Wet road. Passability is not established."],
  ].map(([id, level, age, note]) => ({
    id: `sample-${id}`,
    place: PLACES.find((p) => p.id === id),
    level,
    note,
    observed: now - age * 60000,
    received: now - age * 60000,
    expires: now - age * 60000 + TTL,
    sample: true,
    mine: false,
    confirmations: 0,
    confirmed: false,
    hasPhoto: false,
    location: null,
  }));
}
export const levelOf = (id) => LEVELS.find((l) => l.id === id);
export const expired = (r, now = Date.now()) => now >= r.expires;
export function filterReports(
  reports,
  { query = "", level = "all", history = false, mine = false } = {},
) {
  return reports
    .filter(
      (r) =>
        (history || !expired(r)) &&
        (!mine || r.mine) &&
        (level === "all" || r.level === Number(level)) &&
        `${r.place.name} ${r.place.barangay} ${r.note}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.observed - a.observed);
}
export function groupReports(reports) {
  const map = new Map();
  reports.forEach((r) => {
    const group = map.get(r.place.id) || [];
    group.push(r);
    map.set(r.place.id, group);
  });
  return [...map.values()].map((list) => ({
    place: list[0].place,
    reports: list,
    level: Math.max(...list.map((r) => r.level)),
  }));
}
export function validateReport(payload, now = Date.now()) {
  if (!PLACES.some((p) => p.id === payload.place))
    throw new Error("Choose a location in the pilot area.");
  if (
    !Number.isInteger(payload.level) ||
    payload.level < 1 ||
    payload.level > 5
  )
    throw new Error("Choose a Baha Level from 1 to 5.");
  if (typeof payload.note !== "string" || payload.note.length > 400)
    throw new Error("Keep the description under 400 characters.");
  if (
    !Number.isSafeInteger(payload.observed) ||
    payload.observed > now + 60000 ||
    payload.observed < now - 86400000
  )
    throw new Error("Observations must be within the last 24 hours.");
  if (
    payload.photo &&
    (!payload.photo.startsWith("data:image/jpeg;base64,") ||
      payload.photo.length > 1_700_000)
  )
    throw new Error("Use a processed photo smaller than 1.7 MB.");
  if (payload.location) {
    const g = payload.location;
    if (
      !Number.isFinite(g.latitude) ||
      Math.abs(g.latitude) > 90 ||
      !Number.isFinite(g.longitude) ||
      Math.abs(g.longitude) > 180 ||
      !Number.isFinite(g.accuracy) ||
      g.accuracy < 0
    )
      throw new Error("Invalid GPS tag.");
  }
  return {
    ...payload,
    location: payload.location
      ? {
          latitude: Number(payload.location.latitude.toFixed(3)),
          longitude: Number(payload.location.longitude.toFixed(3)),
          accuracy: Math.max(110, Math.round(payload.location.accuracy)),
        }
      : null,
  };
}
export const formatTime = (n) =>
  new Date(n).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
export function age(n) {
  const m = Math.max(0, Math.floor((Date.now() - n) / 60000));
  return m < 1
    ? "Just now"
    : m < 60
      ? `${m} min ago`
      : `${Math.floor(m / 60)}h ${m % 60}m ago`;
}
