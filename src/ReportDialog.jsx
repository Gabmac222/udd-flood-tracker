import { useState, useRef, useEffect } from "react";
import {
  Button,
  Checkbox,
  FormControlLabel,
  Alert,
  CircularProgress,
} from "@mui/material";
import {
  Camera,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { Modal, Art } from "./components";
import { LEVELS, PLACES, levelOf } from "./data";
import { saveReport, SERVER_MODE } from "./storage";
export default function ReportDialog({ open, onClose, onSaved }) {
  const [place, setPlace] = useState(""),
    [level, setLevel] = useState(3),
    [note, setNote] = useState(""),
    [minutes, setMinutes] = useState("0"),
    [safe, setSafe] = useState(false),
    [bitmap, setBitmap] = useState(null),
    [photo, setPhoto] = useState(null),
    [reviewed, setReviewed] = useState(false),
    [location, setLocation] = useState(null),
    [share, setShare] = useState(false),
    [gpsMessage, setGPSMessage] = useState(
      "Optional. Exact coordinates are never shared.",
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loadingPhoto, setLoadingPhoto] = useState(false);
  const canvas = useRef(null),
    start = useRef(null),
    active = useRef(open);
  useEffect(() => {
    active.current = open;
    if (open) {
      setPlace("");
      setLevel(3);
      setNote("");
      setMinutes("0");
      setSafe(false);
      setBitmap(null);
      setPhoto(null);
      setReviewed(false);
      setLocation(null);
      setShare(false);
      setGPSMessage("Optional. Exact coordinates are never shared.");
      setError("");
    }
  }, [open]);
  function drawBase() {
    if (!bitmap || !canvas.current) return;
    const c = canvas.current,
      scale = Math.min(1, 1000 / bitmap.width, 1000 / bitmap.height);
    c.width = Math.round(bitmap.width * scale);
    c.height = Math.round(bitmap.height * scale);
    c.getContext("2d").drawImage(bitmap, 0, 0, c.width, c.height);
    setPhoto(c.toDataURL("image/jpeg", 0.78));
    setReviewed(false);
  }
  useEffect(() => {
    if (bitmap) drawBase();
    return () => bitmap?.close();
  }, [bitmap]);
  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 12_000_000
    ) {
      setError("Choose a JPEG, PNG, or WebP smaller than 12 MB.");
      return;
    }
    setLoadingPhoto(true);
    setError("");
    try {
      const image = await createImageBitmap(file);
      if (active.current) setBitmap(image);
      else image.close();
    } catch {
      setError("We could not open that photo. Try a different image.");
    } finally {
      setLoadingPhoto(false);
    }
    e.target.value = "";
  }
  function point(e) {
    const r = canvas.current.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) * canvas.current.width) / r.width,
      y: ((e.clientY - r.top) * canvas.current.height) / r.height,
    };
  }
  function cover(e) {
    if (!start.current) return;
    const end = point(e),
      c = canvas.current,
      ctx = c.getContext("2d");
    ctx.fillStyle = "#000269";
    ctx.fillRect(
      Math.min(start.current.x, end.x),
      Math.min(start.current.y, end.y),
      Math.max(12, Math.abs(end.x - start.current.x)),
      Math.max(12, Math.abs(end.y - start.current.y)),
    );
    start.current = null;
    setPhoto(c.toDataURL("image/jpeg", 0.78));
    setReviewed(false);
  }
  function coverAll() {
    const c = canvas.current,
      ctx = c.getContext("2d");
    ctx.fillStyle = "#000269";
    ctx.fillRect(0, 0, c.width, c.height);
    setPhoto(c.toDataURL("image/jpeg", 0.78));
    setReviewed(false);
  }
  function locate() {
    if (!navigator.geolocation) {
      setGPSMessage("Location is unavailable. Choose a road manually.");
      return;
    }
    setGPSMessage("Requesting location permission…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (!active.current) return;
        setLocation({
          latitude: Number(p.coords.latitude.toFixed(3)),
          longitude: Number(p.coords.longitude.toFixed(3)),
          accuracy: Math.max(110, Math.round(p.coords.accuracy)),
        });
        setGPSMessage(
          "Approximate GPS available. Choose the road and opt in below to include the tag.",
        );
      },
      () => {
        if (active.current)
          setGPSMessage(
            "Location permission was unavailable. Choose a road manually.",
          );
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (photo && !reviewed)
        throw new Error("Review your photo privacy before saving.");
      const result = await saveReport({
        id: crypto.randomUUID(),
        place,
        level,
        note,
        observed: Date.now() - Number(minutes) * 60000,
        photo,
        location: share ? location : null,
      });
      onSaved(result);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title="Share a flood observation"
      eyebrow="A SMALL REPORT CAN HELP"
    >
      <div className="report-intro">
        <Art index={1} />
        <p>
          Only report from a safe place. A road, a depth, a moment in
          time—that’s a useful start.
        </p>
      </div>
      <form onSubmit={submit} className="report-form">
        <div className="form-two">
          <label>
            Road or landmark
            <select
              required
              value={place}
              onChange={(e) => setPlace(e.target.value)}
            >
              <option value="">Choose a location</option>
              {PLACES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.barangay}
                </option>
              ))}
            </select>
          </label>
          <label>
            When did you observe it?
            <select
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            >
              <option value="0">Just now</option>
              <option value="15">15 minutes ago</option>
              <option value="30">30 minutes ago</option>
              <option value="60">1 hour ago</option>
            </select>
          </label>
        </div>
        <fieldset className="depth-field">
          <legend>Choose a Baha Level</legend>
          <div className="depth-options">
            {LEVELS.map((l) => (
              <button
                key={l.id}
                type="button"
                aria-pressed={level === l.id}
                aria-label={`Level ${l.id}, ${l.name}, ${l.depth}`}
                className={level === l.id ? "selected" : ""}
                onClick={() => setLevel(l.id)}
              >
                <span
                  style={{
                    background: l.color,
                    color: l.id === 5 ? "white" : "#172440",
                  }}
                >
                  {l.id}
                </span>
                <b>{l.depth}</b>
              </button>
            ))}
          </div>
          <p>
            <strong>
              Level {level} · {levelOf(level).name}
            </strong>{" "}
            · Manually observed
          </p>
        </fieldset>
        <label>
          What should neighbours know?
          <textarea
            maxLength={400}
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Water covers the intersection. Avoid this section."
          />
        </label>
        <div className="form-tools">
          <Button
            variant="outlined"
            component="label"
            startIcon={<Camera size={17} />}
          >
            Add a photo
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={upload}
              aria-label="Upload optional photo"
              hidden
            />
          </Button>
          <Button
            variant="outlined"
            startIcon={<MapPin size={17} />}
            onClick={locate}
          >
            Use my location
          </Button>
        </div>
        <p className="helper">{gpsMessage}</p>
        {location && (
          <FormControlLabel
            control={
              <Checkbox
                checked={share}
                onChange={(e) => setShare(e.target.checked)}
              />
            }
            label="Include my approximate GPS tag (rounded to about 110 m)"
          />
        )}
        {loadingPhoto && <p className="helper">Preparing your photo…</p>}
        {bitmap && (
          <section className="photo-editor">
            <div className="photo-instructions">
              <ShieldCheck size={20} />
              <div>
                <strong>Privacy first</strong>
                <p>
                  Drag to cover faces, plates, or identifying details. Automatic
                  detection is not enabled.
                </p>
              </div>
            </div>
            <canvas
              ref={canvas}
              aria-label="Photo redaction canvas"
              onPointerDown={(e) => {
                start.current = point(e);
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerUp={cover}
              onPointerCancel={() => {
                start.current = null;
              }}
            />
            <div className="photo-actions">
              <Button size="small" onClick={coverAll}>
                Cover entire photo
              </Button>
              <Button
                size="small"
                onClick={drawBase}
                startIcon={<RotateCcw size={14} />}
              >
                Reset
              </Button>
              <Button
                size="small"
                onClick={() => {
                  setBitmap(null);
                  setPhoto(null);
                }}
                startIcon={<Trash2 size={14} />}
              >
                Remove
              </Button>
            </div>
            <FormControlLabel
              control={
                <Checkbox
                  required
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
              }
              label="I reviewed and covered all identifying details."
            />
          </section>
        )}
        <FormControlLabel
          control={
            <Checkbox
              required
              checked={safe}
              onChange={(e) => setSafe(e.target.checked)}
            />
          }
          label="I’m in a safe place and this is my own observation."
        />
        <div className="privacy-note">
          <ShieldCheck size={15} />
          <span>
            {SERVER_MODE
              ? "Saved to your local test server. No agency is notified."
              : "Test reports stay in this browser. No agency is notified."}
          </span>
        </div>
        {error && <Alert severity="error">{error}</Alert>}
        <div className="dialog-actions">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="contained"
            type="submit"
            disabled={busy || loadingPhoto}
            endIcon={
              busy ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <ArrowRight size={17} />
              )
            }
          >
            {busy ? "Saving…" : "Save test report"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
