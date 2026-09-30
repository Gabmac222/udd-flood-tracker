import { useState, useId } from "react";
import {
  Button,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
} from "@mui/material";
import {
  X,
  ArrowUpRight,
  ArrowRight,
  Plus,
  Minus,
  Layers,
  MapPin,
  Clock,
  ShieldCheck,
  MoveUpRight,
} from "lucide-react";
import { LEVELS, levelOf, age, expired, groupReports } from "./data";
export function Art({ index = 0, className = "" }) {
  return (
    <span
      aria-hidden="true"
      className={`art art-${index} ${className}`}
      style={{
        backgroundImage: `url(${import.meta.env.BASE_URL}assets/safety-illustrations.png)`,
      }}
    />
  );
}
export function LevelBadge({ level, large = false }) {
  const l = levelOf(level);
  return (
    <span
      className={`level-badge ${large ? "large" : ""}`}
      style={{ background: `${l.color}26`, color: l.ink }}
      aria-label={`Level ${level}`}
    >
      {level}
    </span>
  );
}
export function Empty({ title = "Nothing here yet", children, art = 0 }) {
  return (
    <div className="empty">
      <Art index={art} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Modal({
  open,
  onClose,
  title,
  eyebrow,
  children,
  wide = false,
}) {
  const titleId = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={wide ? "md" : "sm"}
      fullWidth
      aria-labelledby={titleId}
    >
      <DialogTitle
        component="div"
        className="dialog-head"
        id={`${titleId}-container`}
      >
        <div>
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h2 id={titleId}>{title}</h2>
        </div>
        <IconButton onClick={onClose} aria-label="Close dialog">
          <X size={20} />
        </IconButton>
      </DialogTitle>
      <DialogContent>{children}</DialogContent>
    </Dialog>
  );
}
export function ReportRow({ report: r, onSelect }) {
  const l = levelOf(r.level);
  return (
    <button className="report-row" onClick={() => onSelect(r)}>
      <LevelBadge level={r.level} />
      <span className="report-copy">
        <strong>{r.place.name}</strong>
        <span>
          {l.name} · {l.depth}
        </span>
        <small>
          {r.sample
            ? "Sample observation"
            : r.mine
              ? "Your test report"
              : "Community · unverified"}
          <i /> {age(r.observed)}
        </small>
      </span>
      <MoveUpRight size={16} className="row-arrow" />
    </button>
  );
}
export function ReportCard({ report: r, onSelect }) {
  const l = levelOf(r.level);
  return (
    <article className="report-card card">
      <div className="card-top">
        <LevelBadge level={r.level} />
        <span className="report-source">
          {r.sample ? "SAMPLE" : r.mine ? "YOUR REPORT" : "COMMUNITY"}
        </span>
        <span className="subtle">{age(r.observed)}</span>
      </div>
      <h3>{r.place.name}</h3>
      <p className="location-label">
        <MapPin size={14} />
        {r.place.barangay}
      </p>
      <div className="depth-text" style={{ color: l.ink }}>
        Level {l.id} · {l.name}
        <span>{l.depth}</span>
      </div>
      <p className="report-note">
        {r.note || "No additional details provided."}
      </p>
      <div className="report-card-bottom">
        <span className="freshness">
          <Clock size={13} />
          {expired(r)
            ? "Expired"
            : `${Math.max(1, Math.ceil((r.expires - Date.now()) / 60000))} min to expiry`}
        </span>
        <IconButton
          aria-label={`Read report for ${r.place.name}`}
          onClick={() => onSelect(r)}
        >
          <ArrowUpRight size={19} />
        </IconButton>
      </div>
    </article>
  );
}
export function Legend({ onOpen }) {
  return (
    <section className="legend-card card">
      <div className="section-heading">
        <div>
          <h2>A shared language for flood levels</h2>
          <p>Remember the name. Check the depth.</p>
        </div>
        <Button onClick={onOpen} endIcon={<ArrowUpRight size={16} />}>
          View guide
        </Button>
      </div>
      <div className="level-legend">
        {LEVELS.map((l) => (
          <button key={l.id} onClick={onOpen} className="legend-item">
            <span
              className="legend-dot"
              style={{
                background: l.color,
                color: l.id === 5 ? "white" : "#172440",
              }}
            >
              {l.id}
            </span>
            <span>
              <strong>{l.name}</strong>
              <small>{l.depth}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
export function Guide({ open, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Know your Baha Level"
      eyebrow="FIVE LEVELS. ONE COMMUNITY."
    >
      <div className="guide-intro">
        <Art index={4} />
        <p>
          Memorable names, meaningful measurements. Depth alone cannot tell you
          whether a road is safe.
        </p>
      </div>
      {LEVELS.map((l) => (
        <div className="guide-row" key={l.id}>
          <LevelBadge large level={l.id} />
          <div>
            <h3>
              Level {l.id} · {l.name}
            </h3>
            <b>{l.depth}</b>
            <p>{l.description}</p>
          </div>
        </div>
      ))}
    </Modal>
  );
}
function MapArt() {
  return (
    <svg viewBox="0 0 800 520" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <pattern
          id="block-grid"
          width="72"
          height="58"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-18)"
        >
          <rect width="72" height="58" fill="#eef2f8" />
          <rect x="7" y="7" width="55" height="40" rx="5" fill="#e3e9f2" />
          <path d="M32 8V46M7 26H62" stroke="#eef2f8" strokeWidth="3" />
        </pattern>
      </defs>
      <rect width="800" height="520" fill="url(#block-grid)" />
      <path
        d="M-20 95C120 90 140 155 240 140S380 120 425 210S490 310 600 320S650 470 820 460"
        fill="none"
        stroke="#bfdff5"
        strokeWidth="54"
      />
      <path
        d="M420 210Q570 140 640-30M610 330Q735 260 830 260"
        stroke="#bfdff5"
        strokeWidth="23"
        fill="none"
      />
      <g fill="none" strokeLinecap="round">
        <g stroke="#d2dce9" strokeWidth="14">
          <path d="M70 530L210 325 160 210 225-20M20 305L250 240 510 235 780 130M40 445L290 365 620 260 820 225M320 550L310 335 405 20M530 560L590 345 545 230 520-20M680 535L715 305 705 50" />
        </g>
        <g stroke="white" strokeWidth="10">
          <path d="M70 530L210 325 160 210 225-20M20 305L250 240 510 235 780 130M40 445L290 365 620 260 820 225M320 550L310 335 405 20M530 560L590 345 545 230 520-20M680 535L715 305 705 50" />
        </g>
        <g stroke="white" strokeWidth="5">
          <path d="M0 380L270 290 365 325 720 370M255-10L285 180 355 265 405 530M95-10L150 165M340 115L545 55M395 90L555 110M585 105L810 50M520 470L780 390M190 415L335 390M130 230L330 170" />
        </g>
      </g>
      <g
        fill="#52657f"
        fontFamily="Roboto,sans-serif"
        fontSize="11"
        letterSpacing="1.6"
      >
        <text x="474" y="94">
          PANTAL
        </text>
        <text x="95" y="205">
          TAPUAC
        </text>
        <text x="480" y="472">
          MALUED
        </text>
        <text x="635" y="275">
          MAYOMBO
        </text>
        <text x="263" y="398">
          POGO CHICO
        </text>
      </g>
      <g fill="#5a6a7c" fontFamily="Roboto,sans-serif" fontSize="9">
        <text x="250" y="250">
          A.B. FERNANDEZ AVE
        </text>
        <text x="325" y="357" transform="rotate(-18 325 357)">
          PEREZ BOULEVARD
        </text>
        <text x="545" y="180" transform="rotate(-84 545 180)">
          ARELLANO ST
        </text>
        <text x="177" y="120" fill="#42759a" transform="rotate(12 177 120)">
          Pantal River
        </text>
      </g>
      <text
        x="280"
        y="298"
        fill="#172440"
        fontSize="24"
        fontWeight="600"
        fontFamily="Manrope,sans-serif"
      >
        Dagupan City
      </text>
      <g transform="translate(560 116)">
        <rect x="-12" y="-12" width="24" height="24" rx="7" fill="#000269" />
        <path
          d="M-5 5V-5H5V5M-7 5H7M-2-2H2M-2 1H2"
          stroke="white"
          fill="none"
          strokeWidth="1.4"
        />
        <text
          x="18"
          y="5"
          fill="#000269"
          fontSize="12"
          fontWeight="600"
          fontFamily="Roboto,sans-serif"
        >
          UDD
        </text>
      </g>
    </svg>
  );
}
export function FloodMap({ reports, onRoad, onSelect }) {
  const [zoom, setZoom] = useState(1),
    [showPins, setShowPins] = useState(true),
    [view, setView] = useState("map");
  return (
    <section className="map-panel card">
      <div className="section-heading">
        <div>
          <h2>Around Dagupan</h2>
          <p>Recent observations in the pilot area</p>
        </div>
        <div className="segmented">
          <button aria-pressed={view === "map"} onClick={() => setView("map")}>
            Map
          </button>
          <button
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            List
          </button>
        </div>
      </div>
      {view === "map" ? (
        <div className="map-viewport">
          <div className="map-contents" style={{ transform: `scale(${zoom})` }}>
            <MapArt />
            {showPins &&
              groupReports(reports).map((g) => (
                <button
                  key={g.place.id}
                  className="map-marker"
                  onClick={() => onRoad(g)}
                  style={{
                    left: `${g.place.x}%`,
                    top: `${g.place.y}%`,
                    background: levelOf(g.level).color,
                    color: g.level === 5 ? "white" : "#172440",
                  }}
                  aria-label={`${g.place.name}: ${g.reports.length} observations, highest level ${g.level}`}
                >
                  <span>{g.level}</span>
                  {g.reports.length > 1 && <small>{g.reports.length}</small>}
                </button>
              ))}
          </div>
          <span className="map-label">
            <span />
            Illustrative map
          </span>
          <div className="map-controls">
            <Tooltip title={showPins ? "Hide report pins" : "Show report pins"}>
              <IconButton
                onClick={() => setShowPins(!showPins)}
                aria-label={showPins ? "Hide report pins" : "Show report pins"}
                aria-pressed={showPins}
              >
                <Layers size={19} />
              </IconButton>
            </Tooltip>
            <div className="zoom-controls">
              <IconButton
                aria-label="Zoom in"
                disabled={zoom >= 1.6}
                onClick={() => setZoom((z) => Math.min(1.6, z + 0.2))}
              >
                <Plus size={20} />
              </IconButton>
              <IconButton
                aria-label="Zoom out"
                disabled={zoom <= 1}
                onClick={() => setZoom((z) => Math.max(1, z - 0.2))}
              >
                <Minus size={20} />
              </IconButton>
            </div>
          </div>
          <div className="map-bottom-label">
            <MapPin size={13} /> Schematic positions · not for navigation
          </div>
          {reports.length === 0 && (
            <div className="map-no-data">
              No current observations match this view.
              <br />
              No data does not mean no flood.
            </div>
          )}
        </div>
      ) : (
        <div className="map-list">
          {reports.length ? (
            reports.map((r) => (
              <ReportRow key={r.id} report={r} onSelect={onSelect} />
            ))
          ) : (
            <Empty>No current observations match your search.</Empty>
          )}
        </div>
      )}
      <div className="map-footer">
        <span>
          <span className="tiny-dot" />
          {reports.length} observations in this view
        </span>
        <span>Pins show the highest reported level</span>
      </div>
    </section>
  );
}
