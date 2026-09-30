import { useState, useEffect, useCallback } from "react";
import {
  Button,
  IconButton,
  Tooltip,
  Chip,
  Snackbar,
  Alert,
  Checkbox,
  FormControlLabel,
  LinearProgress,
} from "@mui/material";
import {
  Waves,
  Map,
  MessagesSquare,
  Route,
  ShieldCheck,
  FolderHeart,
  Search,
  MapPin,
  Bell,
  Plus,
  ArrowUpRight,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  CloudOff,
  Phone,
  Clock,
  Info,
  Download,
  Trash2,
  Camera,
  Layers,
  Navigation,
  HeartPulse,
  BookOpen,
  Shield,
  CheckCircle2,
} from "lucide-react";
import {
  LEVELS,
  PLACES,
  levelOf,
  filterReports,
  expired,
  age,
  formatTime,
} from "./data";
import * as storage from "./storage";
import {
  Art,
  Modal,
  Empty,
  LevelBadge,
  ReportRow,
  ReportCard,
  Legend,
  Guide,
  FloodMap,
} from "./components";
import ReportDialog from "./ReportDialog";
const nav = [
  { id: "map", label: "Flood map", icon: Map },
  { id: "reports", label: "Community", icon: MessagesSquare },
  { id: "route", label: "Route check", icon: Route },
  { id: "safety", label: "Safety hub", icon: ShieldCheck },
  { id: "activity", label: "My reports", icon: FolderHeart },
];
const intro = {
  map: [
    "Know before you go.",
    "Local knowledge. A clearer picture of the streets we share.",
  ],
  reports: [
    "Every observation matters.",
    "A place, a time, a water level. Put the pieces together.",
  ],
  route: [
    "A little planning goes a long way.",
    "Review what is known at both ends of your journey.",
  ],
  safety: [
    "Prepared feels a little better.",
    "Helpful contacts and practical information, all in one place.",
  ],
  activity: [
    "Your corner of the community.",
    "Your observations, saved records, and offline outbox.",
  ],
};
function initialPage() {
  const hash = location.hash.slice(1);
  return nav.some((n) => n.id === hash) ? hash : "map";
}
export default function App() {
  const [page, setPage] = useState(initialPage),
    [reports, setReports] = useState([]),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [level, setLevel] = useState("all"),
    [history, setHistory] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [connected, setConnected] = useState(true),
    [cachedAt, setCachedAt] = useState(null),
    [updated, setUpdated] = useState(Date.now()),
    [queue, setQueue] = useState([]),
    [rescues, setRescues] = useState([]),
    [exposure, setExposure] = useState(null),
    [reportOpen, setReportOpen] = useState(false),
    [guideOpen, setGuideOpen] = useState(false),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [routeResult, setRouteResult] = useState(null);
  const notify = (message) => setToast(message);
  const reload = useCallback(async () => {
    try {
      const data = await storage.loadReports();
      setReports(data.reports);
      setConnected(data.connected);
      setCachedAt(data.cachedAt || null);
      setUpdated(Date.now());
      setQueue(await storage.getQueue());
      setExposure(await storage.getSetting("exposure"));
      try {
        setRescues(await storage.loadRescues());
      } catch {}
      setError("");
    } catch (e) {
      setError(
        e.message ||
          "Could not open browser storage. Allow site storage and reload.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await storage.initialise();
        if (mounted) await reload();
      } catch (e) {
        if (mounted) {
          setError(
            "Browser storage is unavailable. Allow site storage to use reporting.",
          );
          setLoading(false);
        }
      }
    })();
    const handleHash = () => setPage(initialPage()),
      goOnline = async () => {
        setOnline(true);
        try {
          await storage.syncReports();
          await reload();
        } catch {}
      },
      goOffline = () => {
        setOnline(false);
      };
    window.addEventListener("hashchange", handleHash);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      mounted = false;
      window.removeEventListener("hashchange", handleHash);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [reload]);
  useEffect(() => {
    const timer = setInterval(async () => {
      if (document.hidden) return;
      try {
        if (storage.SERVER_MODE) await storage.syncReports();
        await reload();
      } catch {}
    }, 60000);
    return () => clearInterval(timer);
  }, [reload]);
  useEffect(() => {
    const key = (e) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
      ) {
        e.preventDefault();
        document.querySelector(".global-search input")?.focus();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  function navigate(id) {
    setPage(id);
    location.hash = id;
    setQuery("");
    setFilter("all");
    setLevel("all");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  const current = filterReports(reports),
    filtered = filterReports(reports, {
      query,
      level,
      history: page === "reports" && history,
      mine: filter === "mine",
    }).filter((r) => filter !== "high" || r.level >= 3);
  const selected =
    modal?.type === "report" ? reports.find((r) => r.id === modal.id) : null;
  async function saved(result) {
    await reload();
    notify(
      result.pending
        ? "Saved in the outbox. It will retry when the local server reconnects."
        : storage.SERVER_MODE
          ? "Report saved to your local test server."
          : "Report saved on this device. Thank you for testing.",
    );
  }
  async function perform(action, message) {
    setBusy(true);
    try {
      await action();
      await reload();
      setModal(null);
      notify(message);
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  function download() {
    const data = reports
      .filter((r) => r.mine)
      .map(({ id, place, level, note, observed, received, location }) => ({
        id,
        place: place.name,
        level,
        note,
        observed,
        received,
        location,
      }));
    const href = URL.createObjectURL(
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = href;
    a.download = "udd-my-test-reports.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  function Dashboard() {
    return (
      <>
        <div className="overview-stats">
          <div className="stat-tile">
            <span className="stat-symbol">
              <Waves size={22} />
            </span>
            <div>
              <strong>{current.length}</strong>
              <span>Recent observations</span>
            </div>
            <small>Last 2 hours</small>
          </div>
          <div className="stat-tile">
            <span className="stat-symbol hazard">
              <Layers size={22} />
            </span>
            <div>
              <strong>{current.filter((r) => r.level >= 3).length}</strong>
              <span>Higher-level reports</span>
            </div>
            <small>Level 3 and above</small>
          </div>
          <div className="stat-tile">
            <span className="stat-symbol">
              <MapPin size={22} />
            </span>
            <div>
              <strong>
                {new Set(current.map((r) => r.place.barangay)).size}
              </strong>
              <span>Areas with reports</span>
            </div>
            <small>Includes samples</small>
          </div>
        </div>
        <div className="view-controls">
          <div className="filter-chips">
            {[
              ["all", "All observations"],
              ["high", "Higher levels"],
              ["mine", "My observations"],
            ].map(([id, label]) => (
              <button
                key={id}
                className={filter === id ? "filter-chip active" : "filter-chip"}
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
              >
                {filter === id && <CheckCircle2 size={15} />} {label}
              </button>
            ))}
          </div>
          <span className="updated">
            <RefreshCw size={13} />
            View updated {age(updated)}
          </span>
        </div>
        <div className="dashboard-grid">
          <div className="map-column">
            <FloodMap
              reports={filtered}
              onRoad={(group) =>
                setModal(
                  group.reports.length === 1
                    ? { type: "report", id: group.reports[0].id }
                    : { type: "road", group },
                )
              }
              onSelect={(r) => setModal({ type: "report", id: r.id })}
            />
            <div className="wellness-strip">
              <span className="wellness-icon">
                <ShieldCheck size={22} />
              </span>
              <div>
                <strong>Your safety comes first.</strong>
                <p>
                  Avoid floodwater. Depth alone does not tell the whole story.
                </p>
              </div>
              <Button
                endIcon={<ArrowUpRight size={16} />}
                onClick={() => navigate("safety")}
              >
                Stay informed
              </Button>
            </div>
          </div>
          <aside className="community-card card">
            <div className="section-heading">
              <h2>From the community</h2>
              <span className="count-pill">{current.length}</span>
            </div>
            <div className="community-list">
              {filtered.length ? (
                filtered
                  .slice(0, 4)
                  .map((r) => (
                    <ReportRow
                      key={r.id}
                      report={r}
                      onSelect={(r) => setModal({ type: "report", id: r.id })}
                    />
                  ))
              ) : (
                <Empty title="A quiet view">
                  No matching reports. Conditions may still be unknown.
                </Empty>
              )}
            </div>
            <Button
              className="view-all"
              onClick={() => navigate("reports")}
              endIcon={<ArrowRight size={16} />}
            >
              Explore all observations
            </Button>
            <div className="contribute-mini">
              <Art index={1} />
              <div>
                <strong>See something? Share it.</strong>
                <p>Your local knowledge can help.</p>
                <button onClick={() => setReportOpen(true)}>
                  Add an observation <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </aside>
        </div>
        <Legend onOpen={() => setGuideOpen(true)} />
      </>
    );
  }
  function Reports() {
    return (
      <>
        <div className="reports-toolbar">
          <label className="select-inline">
            Depth level
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="all">All Baha Levels</option>
              {LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  Level {l.id} · {l.name}
                </option>
              ))}
            </select>
          </label>
          <FormControlLabel
            control={
              <Checkbox
                checked={history}
                onChange={(e) => setHistory(e.target.checked)}
              />
            }
            label="Include expired reports"
          />
          <span className="subtle">{filtered.length} observations</span>
        </div>
        <div className="reports-grid">
          {filtered.length ? (
            filtered.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                onSelect={(r) => setModal({ type: "report", id: r.id })}
              />
            ))
          ) : (
            <Empty title="No observations match">
              Try another search or include expired observations.
            </Empty>
          )}
        </div>
      </>
    );
  }
  function RouteView() {
    return (
      <div className="two-column">
        <section className="card content-card">
          <div className="feature-heading">
            <Art index={0} />
            <div>
              <span className="eyebrow">A MOMENT BEFORE YOU MOVE</span>
              <h2>Check your start and destination</h2>
            </div>
          </div>
          <p>
            Review recent observations on your roads. This test app cannot
            establish a safe route.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (f.get("from") === f.get("to")) {
                notify("Choose two different locations.");
                return;
              }
              setRouteResult({
                from: f.get("from"),
                to: f.get("to"),
                vehicle: f.get("vehicle"),
              });
            }}
            className="route-form"
          >
            <label>
              Starting point
              <select
                name="from"
                defaultValue={routeResult?.from || "arellano"}
              >
                {PLACES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Destination
              <select name="to" defaultValue={routeResult?.to || "perez"}>
                {PLACES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              How are you travelling?
              <select
                name="vehicle"
                defaultValue={routeResult?.vehicle || "Walking"}
              >
                <option>Walking</option>
                <option>Tricycle</option>
                <option>Motorcycle</option>
                <option>Car</option>
                <option>Jeepney / SUV</option>
              </select>
            </label>
            <Button
              type="submit"
              variant="contained"
              endIcon={<ArrowRight size={17} />}
            >
              Check observations
            </Button>
          </form>
        </section>
        <section className="card content-card">
          <span className="eyebrow">KNOW WHAT IS KNOWN</span>
          <h2>Evidence before directions.</h2>
          {routeResult ? (
            <>
              <Alert severity="warning" className="spaced-alert">
                Route safety is unverified. No validated routing engine is
                connected.
              </Alert>
              <p className="helper">
                Travel mode: {routeResult.vehicle}. No mode is certified safe by
                these observations.
              </p>
              {[routeResult.from, routeResult.to].map((id) => (
                <div className="route-endpoint" key={id}>
                  <h3>
                    <MapPin size={16} />
                    {PLACES.find((p) => p.id === id).name}
                  </h3>
                  {current.filter((r) => r.place.id === id).length ? (
                    current
                      .filter((r) => r.place.id === id)
                      .map((r) => (
                        <ReportRow
                          key={r.id}
                          report={r}
                          onSelect={(r) =>
                            setModal({ type: "report", id: r.id })
                          }
                        />
                      ))
                  ) : (
                    <p>No current observations. Conditions are unknown.</p>
                  )}
                </div>
              ))}
            </>
          ) : (
            <Empty title="A clearer picture starts here" art={0}>
              Choose your locations to compare reports. Follow official closures
              and local responders.
            </Empty>
          )}
          <div className="info-note">
            <Info size={18} />
            <span>
              No report does not mean no flood. Conditions between your
              endpoints are unknown.
            </span>
          </div>
        </section>
      </div>
    );
  }
  function Safety() {
    return (
      <>
        <div className="safety-hero">
          <div>
            <span className="eyebrow">
              LOOK AFTER YOURSELF. LOOK OUT FOR OTHERS.
            </span>
            <h2>Let’s keep Dagupan prepared.</h2>
            <p>
              Small steps before, during, and after a flood can make a
              difference.
            </p>
            <Button
              variant="contained"
              onClick={() => setModal({ type: "how" })}
              endIcon={<ArrowRight size={16} />}
            >
              A guide to reporting safely
            </Button>
          </div>
          <Art index={3} />
        </div>
        <div className="two-column">
          <section className="card content-card">
            <div className="card-icon">
              <Phone size={22} />
            </div>
            <h2>Help is a call away.</h2>
            <p>
              This testing website cannot dispatch responders. If someone is in
              immediate danger, contact emergency services directly.
            </p>
            <div className="contact-row">
              <div>
                <strong>Dagupan CDRRMO</strong>
                <span>City disaster response office</span>
              </div>
              <Button
                variant="outlined"
                href="tel:09684449598"
                startIcon={<Phone size={15} />}
              >
                0968 444 9598
              </Button>
            </div>
            <div className="contact-row">
              <div>
                <strong>National emergency hotline</strong>
                <span>For urgent assistance</span>
              </div>
              <Button
                variant="outlined"
                href="tel:911"
                startIcon={<Phone size={15} />}
              >
                911
              </Button>
            </div>
            <div className="card-actions">
              <Button onClick={() => setModal({ type: "rescue" })}>
                Record a test help request
              </Button>
              <a
                href="https://www.dagupan.gov.ph/contact-us/"
                target="_blank"
                rel="noreferrer"
              >
                City contact directory ↗
              </a>
            </div>
          </section>
          <section className="card content-card">
            <div className="card-icon">
              <HeartPulse size={22} />
            </div>
            <h2>Floodwater & your health</h2>
            <p>
              Avoid wading or swimming in floodwater. Cover cuts with waterproof
              dressings, and use protective boots when exposure cannot be
              avoided.
            </p>
            <div className="info-note">
              <Shield size={19} />
              <span>
                If you feel ill after exposure, seek medical care and tell the
                clinician. Do not self-prescribe antibiotics.
              </span>
            </div>
            <p>
              Watch for illness for 2–30 days after exposure. Your personal date
              log stays in this browser; it does not send medical reminders.
            </p>
            {exposure && (
              <div className="exposure-chip">
                <Clock size={15} />
                Exposure logged: {exposure}
                <IconButton
                  aria-label="Remove exposure date"
                  onClick={() =>
                    perform(
                      () => storage.setSetting("exposure", null),
                      "Exposure date removed.",
                    )
                  }
                >
                  <Trash2 size={15} />
                </IconButton>
              </div>
            )}
            <div className="card-actions">
              <Button onClick={() => setModal({ type: "exposure" })}>
                {exposure ? "Update" : "Log"} exposure date
              </Button>
              <a
                href="https://www.cdc.gov/leptospirosis/prevention/index.html"
                target="_blank"
                rel="noreferrer"
              >
                CDC prevention guide ↗
              </a>
            </div>
          </section>
          <section className="card content-card">
            <h2>Before you seek shelter</h2>
            <p>
              Facilities named in the proposal’s research. Opening, capacity,
              and access are unverified—confirm with CDRRMO before travelling.
            </p>
            {[
              "Dagupan City People's Astrodome",
              "Dagupan City National High School",
              "Juan L. Siapno Elementary School",
              "Sabangan Elementary School",
            ].map((name) => (
              <div className="directory-row" key={name}>
                <MapPin size={18} />
                <div>
                  <strong>{name}</strong>
                  <span>Current status unknown</span>
                </div>
              </div>
            ))}
          </section>
          <section className="card content-card">
            <h2>Official information connections</h2>
            <p>
              This pilot demonstrates the interface. The following services are
              not connected.
            </p>
            {[
              "PAGASA rainfall warnings",
              "NAMRIA tide predictions",
              "River gauges & flood forecast",
              "LGU alerts & rescue dispatch",
              "SMS & Bluetooth mesh",
            ].map((name) => (
              <div className="integration-row" key={name}>
                <span>{name}</span>
                <Chip label="Not connected" size="small" variant="outlined" />
              </div>
            ))}
          </section>
        </div>
      </>
    );
  }
  function Activity() {
    const mine = reports.filter((r) => r.mine);
    return (
      <>
        <div className="activity-heading card">
          <Art index={2} />
          <div>
            <h2>
              {mine.length
                ? `${mine.length} contribution${mine.length === 1 ? "" : "s"}. One clearer picture.`
                : "Every contribution starts with you."}
            </h2>
            <p>
              Your test reports stay{" "}
              {storage.SERVER_MODE ? "on your local server" : "in this browser"}
              . You’re in control of what you share.
            </p>
          </div>
          <Button startIcon={<Download size={17} />} onClick={download}>
            Export my reports
          </Button>
        </div>
        {queue.length > 0 && (
          <section className="card content-card queue-card">
            <h2>
              Offline outbox <Chip size="small" label={queue.length} />
            </h2>
            {queue.map((r) => (
              <div className="directory-row" key={r.id}>
                <CloudOff size={20} />
                <div>
                  <strong>{PLACES.find((p) => p.id === r.place)?.name}</strong>
                  <span>{r.error || "Waiting for the local server"}</span>
                </div>
                <IconButton
                  aria-label="Discard queued report"
                  onClick={() => setModal({ type: "discard", id: r.id })}
                >
                  <Trash2 size={18} />
                </IconButton>
              </div>
            ))}
            <Button
              onClick={() =>
                perform(
                  storage.syncReports,
                  "Outbox checked. Unsent reports remain on this device.",
                )
              }
              startIcon={<RefreshCw size={16} />}
            >
              Retry sync
            </Button>
          </section>
        )}
        <div className="reports-grid">
          {mine.length ? (
            mine.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                onSelect={(r) => setModal({ type: "report", id: r.id })}
              />
            ))
          ) : (
            <div className="card full-width">
              <Empty title="Your first observation belongs here" art={1}>
                Report a road condition from a safe place. Your sample
                contribution will be saved on this device.
              </Empty>
              <div className="center-action">
                <Button
                  variant="contained"
                  startIcon={<Plus size={18} />}
                  onClick={() => setReportOpen(true)}
                >
                  Add your first report
                </Button>
              </div>
            </div>
          )}
        </div>
        <section className="card content-card rescue-history">
          <div className="section-heading">
            <div>
              <h2>Your test help records</h2>
              <p>Saved locally. No responders are notified.</p>
            </div>
            <Button onClick={() => setModal({ type: "rescue" })}>
              Add record
            </Button>
          </div>
          {rescues.length ? (
            rescues.map((r) => (
              <div className="directory-row" key={r.id}>
                <ShieldCheck size={20} />
                <div>
                  <strong>
                    {PLACES.find((p) => p.id === r.place)?.name} · {r.people}{" "}
                    people
                  </strong>
                  <span>
                    {formatTime(r.created)} · {r.status}
                  </span>
                  <p>{r.needs}</p>
                </div>
                <IconButton
                  aria-label="Remove help record"
                  onClick={() => setModal({ type: "delete-rescue", id: r.id })}
                >
                  <Trash2 size={18} />
                </IconButton>
              </div>
            ))
          ) : (
            <p className="helper">
              No test help requests recorded. For urgent help, call CDRRMO
              directly.
            </p>
          )}
        </section>
      </>
    );
  }
  function ModalBody() {
    if (!modal) return null;
    if (selected) {
      const l = levelOf(selected.level);
      return (
        <>
          <div className="detail-banner">
            <LevelBadge large level={selected.level} />
            <div>
              <h3>
                Level {selected.level} · {l.name}
              </h3>
              <p>{l.depth} · Manually observed</p>
            </div>
          </div>
          <Chip
            size="small"
            variant="outlined"
            label={
              selected.sample
                ? "Sample observation"
                : selected.mine
                  ? "Your test report"
                  : "Community · unverified"
            }
          />
          {selected.hasPhoto && (
            <img
              className="detail-photo"
              src={storage.photoSource(selected)}
              alt="Contributor supplied flood observation with privacy edits"
            />
          )}
          <p className="detail-note">
            {selected.note || "No additional details."}
          </p>
          <dl className="detail-facts">
            <div>
              <dt>Location</dt>
              <dd>
                {selected.place.barangay}
                <small>
                  {selected.location
                    ? `Approximate GPS: ${selected.location.latitude}, ${selected.location.longitude} · unverified`
                    : "Road-level selection · no GPS shared"}
                </small>
              </dd>
            </div>
            <div>
              <dt>Observed</dt>
              <dd>{formatTime(selected.observed)}</dd>
            </div>
            <div>
              <dt>Freshness</dt>
              <dd>
                {expired(selected)
                  ? "Expired — not on current map"
                  : `Expires ${formatTime(selected.expires)}`}
              </dd>
            </div>
            <div>
              <dt>Trust</dt>
              <dd>
                {selected.confirmations} device confirmations
                <small>Not LGU verified</small>
              </dd>
            </div>
          </dl>
          <Alert severity="info">
            Depth does not establish passability. Conditions can change quickly.
          </Alert>
          <div className="dialog-actions">
            {selected.mine ? (
              <Button
                color="error"
                startIcon={<Trash2 size={16} />}
                onClick={() => setModal({ type: "delete", id: selected.id })}
              >
                Remove my report
              </Button>
            ) : (
              <Button
                disabled={
                  !storage.SERVER_MODE ||
                  selected.sample ||
                  selected.confirmed ||
                  expired(selected)
                }
                onClick={() =>
                  perform(
                    () => storage.confirmReport(selected.id),
                    "Device confirmation saved. This is not official verification.",
                  )
                }
              >
                {selected.sample
                  ? "Sample · cannot confirm"
                  : selected.confirmed
                    ? "Already confirmed"
                    : "Confirm same conditions"}
              </Button>
            )}
            <Button
              variant="contained"
              onClick={() => {
                setModal(null);
                setReportOpen(true);
              }}
            >
              Add observation
            </Button>
          </div>
        </>
      );
    }
    if (modal.type === "road")
      return (
        <>
          <p className="dialog-description">
            These observations may disagree. The map shows the highest reported
            level. Check each source and time.
          </p>
          {current
            .filter((r) => r.place.id === modal.group.place.id)
            .map((r) => (
              <ReportRow
                key={r.id}
                report={r}
                onSelect={(r) => setModal({ type: "report", id: r.id })}
              />
            ))}
        </>
      );
    if (["delete", "delete-rescue", "discard"].includes(modal.type))
      return (
        <>
          <p className="dialog-description">
            This removes the selected record{" "}
            {modal.type === "discard"
              ? "from the unsent outbox"
              : "and its associated data"}
            . It cannot be undone.
          </p>
          <div className="dialog-actions">
            <Button onClick={() => setModal(null)}>Keep record</Button>
            <Button
              color="error"
              variant="contained"
              disabled={busy}
              onClick={() =>
                perform(
                  () =>
                    modal.type === "delete"
                      ? storage.deleteReport(modal.id)
                      : modal.type === "delete-rescue"
                        ? storage.deleteRescue(modal.id)
                        : storage.discardQueued(modal.id),
                  "Record removed.",
                )
              }
            >
              Remove record
            </Button>
          </div>
        </>
      );
    if (modal.type === "rescue")
      return (
        <>
          <Alert severity="warning">
            Test record only. No rescue team will be notified. For help, call{" "}
            <a href="tel:09684449598">0968 444 9598</a> or{" "}
            <a href="tel:911">911</a>.
          </Alert>
          <form
            className="standard-form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              perform(
                () =>
                  storage.saveRescue({
                    id: crypto.randomUUID(),
                    place: f.get("place"),
                    people: Number(f.get("people")),
                    needs: f.get("needs"),
                  }),
                "Test help record saved. No responders were notified.",
              );
            }}
          >
            <label>
              Nearest road or landmark
              <select name="place" required>
                <option value="">Choose a location</option>
                {PLACES.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              People needing assistance
              <input
                name="people"
                type="number"
                min="1"
                max="50"
                defaultValue="1"
                required
              />
            </label>
            <label>
              Assistance needed
              <textarea
                name="needs"
                maxLength={400}
                rows={3}
                placeholder="Use test details only. Avoid names or contact information."
              />
            </label>
            <FormControlLabel
              control={<Checkbox required />}
              label="I understand this is a local test record, not a rescue request to responders."
            />
            <div className="dialog-actions">
              <Button href="tel:09684449598" startIcon={<Phone size={16} />}>
                Call CDRRMO
              </Button>
              <Button type="submit" variant="contained" disabled={busy}>
                Save test help record
              </Button>
            </div>
          </form>
        </>
      );
    if (modal.type === "exposure")
      return (
        <form
          className="standard-form"
          onSubmit={(e) => {
            e.preventDefault();
            const date = new FormData(e.currentTarget).get("date");
            perform(
              () => storage.setSetting("exposure", date),
              "Exposure date saved in this browser.",
            );
          }}
        >
          <p className="dialog-description">
            This personal date log stays in your browser. It does not send
            reminders or replace medical care.
          </p>
          <label>
            Exposure date
            <input
              name="date"
              type="date"
              max={new Date().toLocaleDateString("en-CA")}
              defaultValue={exposure || new Date().toLocaleDateString("en-CA")}
              required
            />
          </label>
          <div className="dialog-actions">
            <Button type="submit" variant="contained" disabled={busy}>
              Save date
            </Button>
          </div>
        </form>
      );
    if (modal.type === "alerts")
      return (
        <>
          <Empty title="No live alert feed is connected" art={3}>
            Sample observations are not official advisories. Check local
            authorities for current warnings and closures.
          </Empty>
          <Button
            href="https://www.dagupan.gov.ph/"
            target="_blank"
            rel="noreferrer"
            endIcon={<ArrowUpRight size={17} />}
          >
            Visit the Dagupan City website
          </Button>
        </>
      );
    if (modal.type === "how")
      return (
        <>
          <p className="dialog-description">
            A little local knowledge can help build a clearer picture. Stay out
            of floodwater and report from a safe place.
          </p>
          {[
            [
              0,
              "Choose the place",
              "Select a road or landmark. Add an approximate GPS tag only if you want to.",
            ],
            [
              1,
              "Protect privacy",
              "Choose a depth range. If you add a photo, cover identifying details before saving.",
            ],
            [
              2,
              "Share an observation",
              "Test reports stay on this device or your local server. They are not sent to emergency services.",
            ],
          ].map(([i, title, desc]) => (
            <div className="how-row" key={i}>
              <Art index={i} />
              <div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            </div>
          ))}
          <div className="dialog-actions">
            <Button
              variant="contained"
              onClick={() => {
                setModal(null);
                setReportOpen(true);
              }}
            >
              Try a report
            </Button>
          </div>
        </>
      );
    return (
      <>
        <div className="about-brand">
          <img
            src={`${import.meta.env.BASE_URL}assets/udd-seal.png`}
            alt="Universidad de Dagupan seal"
          />
          <div>
            <h3>Built by UDD, for Dagupan.</h3>
            <p>A community flood intelligence pilot.</p>
          </div>
        </div>
        <p className="dialog-description">
          This React testing website follows the UDD Flood Tracker proposal. It
          brings together local observations, five Baha Levels, privacy
          controls, and a clearer view of current information.
        </p>
        <Alert severity="info">
          The map is schematic. Conditions are samples or local test reports. No
          live AI, routing, forecast, agency alert, or dispatch integration is
          connected.
        </Alert>
        <p className="dialog-description">
          {storage.SERVER_MODE
            ? "Local server mode: reports use the Node + SQLite API."
            : "Browser testing mode: reports, photos, and help records stay in this browser. Clearing site data removes them. No shared server receives your submissions."}
        </p>
        {!storage.SERVER_MODE && (
          <Button
            onClick={() =>
              perform(
                storage.resetSamples,
                "A new sample scenario was loaded. Your reports were preserved.",
              )
            }
            startIcon={<RefreshCw size={16} />}
          >
            Load a fresh sample scenario
          </Button>
        )}
      </>
    );
  }
  const modalTitle =
    selected?.place.name ||
    {
      road: modal?.group?.place.name,
      delete: "Remove your report?",
      "delete-rescue": "Remove this help record?",
      discard: "Discard queued report?",
      rescue: "Record a test help request",
      exposure: "Your personal exposure log",
      alerts: "Official alerts",
      how: "Good observations start safely.",
      about: "About UDD Flood Tracker",
    }[modal?.type] ||
    "Observation";
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => navigate("map")}
          aria-label="UDD Flood Tracker home"
        >
          <span className="brand-mark">
            <Waves size={29} />
          </span>
          <span>
            <b>
              UDD <span>Flood Tracker</span>
            </b>
            <small>For a more prepared Dagupan</small>
          </span>
        </button>
        <div className="workspace-label">YOUR COMMUNITY</div>
        <nav aria-label="Main navigation">
          {nav.map((n) => (
            <button
              key={n.id}
              className={`nav-link ${page === n.id ? "active" : ""}`}
              aria-current={page === n.id ? "page" : undefined}
              onClick={() => navigate(n.id)}
            >
              <n.icon size={20} />
              <span>{n.label}</span>
              {n.id === "activity" && queue.length > 0 && (
                <b className="nav-count">{queue.length}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-contribute">
          <Art index={2} />
          <h3>
            Small report.
            <br />
            Big help.
          </h3>
          <p>
            A safer city starts with
            <br />
            looking out for each other.
          </p>
          <Button
            size="small"
            onClick={() => setModal({ type: "how" })}
            endIcon={<ArrowRight size={16} />}
          >
            How it works
          </Button>
        </div>
        <button
          className="university"
          onClick={() => setModal({ type: "about" })}
        >
          <img src={`${import.meta.env.BASE_URL}assets/udd-seal.png`} alt="" />
          <span>
            Universidad de Dagupan
            <small>Innovation Hub · Community pilot</small>
          </span>
        </button>
      </aside>
      <div className="app-workspace">
        <header className="topbar">
          <label className="global-search">
            <Search size={20} />
            <input
              aria-label="Search roads or barangays"
              placeholder="Search a road or barangay"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (!["map", "reports"].includes(page)) {
                  setPage("reports");
                  location.hash = "reports";
                }
              }}
            />
            <kbd>/</kbd>
          </label>
          <div className="header-tools">
            <span className="city-label">
              <MapPin size={16} />
              Dagupan City
            </span>
            <Tooltip title="Official alert connections">
              <IconButton
                aria-label="Official alerts"
                onClick={() => setModal({ type: "alerts" })}
              >
                <Bell size={20} />
              </IconButton>
            </Tooltip>
            <Tooltip title="About this pilot">
              <button
                className="avatar"
                aria-label="About UDD Flood Tracker"
                onClick={() => setModal({ type: "about" })}
              >
                U
              </button>
            </Tooltip>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                DAGUPAN COMMUNITY OVERVIEW{" "}
                <span className="pilot-tag">TEST PILOT</span>
              </div>
              <h1>{intro[page][0]}</h1>
              <p>{intro[page][1]}</p>
            </div>
            <Button
              className="report-cta"
              variant="contained"
              startIcon={<Plus size={19} />}
              onClick={() => setReportOpen(true)}
            >
              Report a flood
            </Button>
          </div>
          <div className="demo-banner">
            <Info size={17} />
            <p>
              <strong>A space to test, learn, and prepare.</strong> Sample data
              + your test reports. No live alerts or emergency dispatch.
            </p>
            <button onClick={() => setModal({ type: "about" })}>
              About this pilot <ArrowUpRight size={14} />
            </button>
          </div>
          {(!online || !connected) && (
            <Alert
              severity="info"
              icon={<CloudOff size={20} />}
              className="offline-banner"
            >
              {storage.SERVER_MODE
                ? `Offline saved view${cachedAt ? ` · ${formatTime(cachedAt)}` : ""}. New reports will stay in your outbox.`
                : "You’re offline. Your saved view and device reports remain available."}
            </Alert>
          )}
          {error && (
            <Alert
              severity="error"
              className="offline-banner"
              action={<Button onClick={reload}>Retry</Button>}
            >
              {error}
            </Alert>
          )}
          {loading ? (
            <div className="loading">
              <LinearProgress />
              <p>Opening your community view…</p>
            </div>
          ) : page === "map" ? (
            Dashboard()
          ) : page === "reports" ? (
            Reports()
          ) : page === "route" ? (
            RouteView()
          ) : page === "safety" ? (
            Safety()
          ) : (
            Activity()
          )}
          <footer>
            <span>
              <Waves size={16} />
              Made for Dagupan. Built with community in mind.
            </span>
            <button onClick={() => setModal({ type: "about" })}>
              UDD Innovation Hub <ArrowUpRight size={13} />
            </button>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.map((n) => (
          <button
            key={n.id}
            className={page === n.id ? "active" : ""}
            aria-current={page === n.id ? "page" : undefined}
            onClick={() => navigate(n.id)}
          >
            <span>
              <n.icon size={21} />
            </span>
            {n.label === "Community" ? "Reports" : n.label}
          </button>
        ))}
      </nav>
      <ReportDialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSaved={saved}
      />
      <Guide open={guideOpen} onClose={() => setGuideOpen(false)} />
      <Modal
        open={!!modal}
        onClose={busy ? () => {} : () => setModal(null)}
        title={modalTitle}
        eyebrow={modal?.type === "report" ? "COMMUNITY OBSERVATION" : undefined}
      >
        {ModalBody()}
      </Modal>
      <Snackbar
        open={!!toast}
        autoHideDuration={6000}
        onClose={() => setToast("")}
        message={toast}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}
