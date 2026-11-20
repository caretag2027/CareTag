/**
 * CareTag — Simple Dashboard
 *
 * One screen, four things:
 *   1. Status banner  — is the child safe right now?
 *   2. Map            — child, safe places, recent path
 *   3. Safe places    — add / remove
 *   4. Alerts         — what happened, newest first
 * Plus "Try a demo" to watch a pretend child leave a safe place and trigger an alert.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import api from "../api";
import alertStore from "../alertStore";
import deviceStore from "../deviceStore";
import voiceAlarm from "../voiceAlarm";
import { subscribeHardwareTelemetry } from "../firebase";
import { DEVICE_STATUS } from "../utils/dashboardUtils";
import {
  checkPosition,
  createAlertMonitor,
  getStatus,
  zoneCenter,
  zoneName,
} from "../simple/safety";
import { DEMO_ZONE, SCENARIOS, buildScenario } from "../simple/demoScenarios";
import CareTagLogo from "./CareTagLogo";
import "./SimpleDashboard.css";

const DEMO_STEP_MS = 1000;
const STATUS_COLORS = {
  safe: "#16A34A",
  outside: "#DC2626",
  no_gps: "#64748B",
  offline: "#64748B",
  no_zones: "#2563EB",
};

function childIcon(kind, initial) {
  const color = STATUS_COLORS[kind] || "#64748B";
  return L.divIcon({
    className: "",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `<div class="sd-child-marker${kind === "outside" ? " sd-child-marker--alert" : ""}" style="background:${color}">${initial}</div>`,
  });
}

function timeAgo(iso, now) {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ago`;
}

function clock(iso) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Moves the map to `target` whenever its `key` changes. */
function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target)
      map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 16), {
        duration: 0.6,
      });
  }, [target?.key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function MapClicks({ onClick }) {
  useMapEvents({
    click: (e) => onClick && onClick({ lat: e.latlng.lat, lng: e.latlng.lng }),
  });
  return null;
}

/** Converts a stored alertStore record into the simple list item shape. */
function fromStore(a) {
  return {
    id: a.id,
    kind:
      a.type === "nominal" || a.category === "nominal" ? "returned" : "left",
    text: a.message,
    time: a.timestamp,
    isDemo: false,
    seen: Boolean(a.acknowledged),
  };
}

export default function SimpleDashboard({ session, onLogout, onGoToLanding }) {
  const userId = session.userId;
  const [deviceKey, setDeviceKey] = useState(() =>
    deviceStore.getActiveDeviceKey(userId, session.deviceKey || "CARE-TAG-01"),
  );
  const devices = useMemo(() => deviceStore.loadUserDevices(userId), [userId]);
  const profile = deviceStore.getActiveDeviceProfile(userId, deviceKey);
  const childName = profile?.nickname || deviceKey;
  const initial = (childName.trim()[0] || "C").toUpperCase();

  // ── Data ──
  const [zones, setZones] = useState([]);
  const [live, setLive] = useState({
    position: null,
    hasGps: false,
    online: false,
    lastSeen: null,
  });
  const [alerts, setAlerts] = useState(() =>
    alertStore.loadDeviceAlerts(userId, deviceKey).map(fromStore),
  );
  const [trail, setTrail] = useState([]);
  const [now, setNow] = useState(Date.now());

  // ── Demo ──
  const [demo, setDemo] = useState(null); // { id, steps, index }

  // ── Add safe place ──
  const [adding, setAdding] = useState(null); // null | { lat?, lng?, name, radius }
  const [flyTarget, setFlyTarget] = useState(null);

  const zonesRef = useRef(zones);
  zonesRef.current = zones;
  const liveMonitor = useRef(createAlertMonitor());
  const demoMonitor = useRef(createAlertMonitor());

  // Start at the top (the landing page may have left the page scrolled down).
  useEffect(() => {
    const root = document.getElementById("root");
    if (root) root.scrollTop = 0;
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Safe places: load once, then stay in sync with Firebase.
  useEffect(() => {
    let alive = true;
    api
      .fetchGeofences(deviceKey, userId)
      .then((list) => alive && Array.isArray(list) && setZones(list))
      .catch(() => {});
    const unsub = api.subscribeSafeZones(
      deviceKey,
      userId,
      (list) => alive && Array.isArray(list) && setZones(list),
    );
    return () => {
      alive = false;
      if (unsub) unsub();
    };
  }, [deviceKey, userId]);

  const addAlertItem = useCallback((item) => {
    setAlerts((prev) => [item, ...prev].slice(0, 50));
  }, []);

  /** Runs one reading (real or demo) through the alert monitor. */
  const handleEvent = useCallback(
    (event, position, isDemo) => {
      if (!event) return;
      const time = new Date().toISOString();
      if (event.type === "left") {
        const text = `Left ${event.zoneName} — ${event.metersOutside} m outside`;
        voiceAlarm.trigger("boundary_breach", {
          customMessage: `CareTag alert. ${childName} has left ${event.zoneName}.`,
          alertId: `${isDemo ? "demo" : "live"}-${time}`,
        });
        if (isDemo) {
          addAlertItem({
            id: `demo-${time}`,
            kind: "left",
            text,
            time,
            isDemo: true,
            seen: false,
          });
        } else {
          const saved = alertStore.saveAlert(userId, {
            type: "boundary_breach",
            deviceId: deviceKey,
            latitude: position.lat,
            longitude: position.lng,
            nearestGeofence: event.zoneName,
            distanceMeters: event.metersOutside,
            message: text,
            source: "hardware",
          });
          addAlertItem(fromStore(saved));
        }
      } else if (event.type === "returned") {
        const text = `Back inside ${event.zoneName}`;
        if (isDemo) {
          addAlertItem({
            id: `demo-${time}`,
            kind: "returned",
            text,
            time,
            isDemo: true,
            seen: true,
          });
        } else {
          const saved = alertStore.saveAlert(userId, {
            type: "nominal",
            deviceId: deviceKey,
            message: text,
            acknowledged: true,
            source: "hardware",
          });
          addAlertItem(fromStore(saved));
        }
      }
    },
    [addAlertItem, childName, deviceKey, userId],
  );

  // Live band data from Firebase.
  useEffect(() => {
    liveMonitor.current.reset();
    setTrail([]);
    const unsub = subscribeHardwareTelemetry(
      (packet) => {
        if (!packet) return;
        const hasGps = Boolean(packet.gps?.valid);
        const position = hasGps
          ? { lat: packet.latitude, lng: packet.longitude }
          : null;
        setLive((prev) => ({
          ...prev,
          hasGps,
          position: position || prev.position,
        }));
        if (position) {
          setTrail((prev) => {
            const last = prev[prev.length - 1];
            if (last && last[0] === position.lat && last[1] === position.lng)
              return prev;
            return [...prev, [position.lat, position.lng]].slice(-50);
          });
          handleEvent(
            liveMonitor.current.update(
              checkPosition(position, zonesRef.current),
            ),
            position,
            false,
          );
        }
      },
      (status) => {
        const online =
          status.deviceStatus === DEVICE_STATUS.LIVE ||
          status.deviceStatus === DEVICE_STATUS.STALE;
        setLive((prev) => ({
          ...prev,
          online,
          lastSeen: status.lastVerifiedAt,
        }));
      },
      { deviceKey },
    );
    return () => unsub && unsub();
  }, [deviceKey, handleEvent]);

  // ── Demo runner ──
  const demoZones = zones.length > 0 ? zones : [DEMO_ZONE];
  const demoStep = demo ? demo.steps[demo.index] : null;

  const startDemo = (id) => {
    const steps = buildScenario(id, demoZones[0]);
    demoMonitor.current.reset();
    setAlerts((prev) => prev.filter((a) => !a.isDemo));
    setTrail([]);
    setDemo({ id, steps, index: 0 });
    // Bring the banner and map into view so the demo can be watched.
    const root = document.getElementById("root");
    if (root && root.scrollTo) root.scrollTo({ top: 0, behavior: "smooth" });
    setFlyTarget({ ...zoneCenter(demoZones[0]), key: `demo-${Date.now()}` });
  };
  const stopDemo = () => {
    setDemo(null);
    setTrail([]);
    setAlerts((prev) => prev.filter((a) => !a.isDemo));
  };

  // Each demo step: record the path and check for alerts.
  useEffect(() => {
    if (!demoStep) return;
    if (demoStep.hasGps) {
      const p = { lat: demoStep.lat, lng: demoStep.lng };
      setTrail((prev) => [...prev, [p.lat, p.lng]]);
      handleEvent(
        demoMonitor.current.update(checkPosition(p, demoZones)),
        p,
        true,
      );
    }
  }, [demo?.index, demo?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Advance one step per second until the scenario ends (then stay on the last step).
  useEffect(() => {
    if (!demo || demo.index >= demo.steps.length - 1) return;
    const t = setTimeout(
      () => setDemo((d) => d && { ...d, index: d.index + 1 }),
      DEMO_STEP_MS,
    );
    return () => clearTimeout(t);
  }, [demo]);

  // ── What to show ──
  const lastDemoFix = demo
    ? [...demo.steps.slice(0, demo.index + 1)].reverse().find((s) => s.hasGps)
    : null;
  const shown = demo
    ? {
        online: true,
        hasGps: Boolean(demoStep?.hasGps),
        position: lastDemoFix
          ? { lat: lastDemoFix.lat, lng: lastDemoFix.lng }
          : null,
        zones: demoZones,
      }
    : {
        online: live.online,
        hasGps: live.hasGps,
        position: live.position,
        zones,
      };

  const status = getStatus({
    bandOnline: shown.online,
    hasGps: shown.hasGps,
    position: shown.position,
    zones: shown.zones,
  });
  const markerKind = shown.hasGps ? status.kind : "no_gps";
  const unseen = alerts.filter((a) => a.kind === "left" && !a.seen).length;

  const mapCenter = useMemo(() => {
    const z = (zones[0] && zoneCenter(zones[0])) || zoneCenter(DEMO_ZONE);
    return [z.lat, z.lng];
  }, [zones]);

  // Fly to the child the first time we get a real fix.
  const hadFix = useRef(false);
  useEffect(() => {
    if (!demo && live.position && !hadFix.current) {
      hadFix.current = true;
      setFlyTarget({ ...live.position, key: "first-fix" });
    }
  }, [live.position, demo]);

  // ── Actions ──
  const markAllSeen = () => {
    alertStore.acknowledgeAll(userId);
    setAlerts((prev) => prev.map((a) => ({ ...a, seen: true })));
  };

  const saveZone = async (e) => {
    e.preventDefault();
    if (!adding?.lat || !adding.name.trim()) return;
    const zone = await api.createGeofence(
      {
        label: adding.name.trim(),
        centerLatitude: adding.lat,
        centerLongitude: adding.lng,
        radiusMeters: Number(adding.radius),
        category: "custom",
      },
      deviceKey,
      userId,
    );
    setZones((prev) => [
      ...prev.filter((z) => String(z.id) !== String(zone.id)),
      zone,
    ]);
    setAdding(null);
  };

  const removeZone = async (zone) => {
    if (!window.confirm(`Remove “${zoneName(zone)}”?`)) return;
    setZones((prev) => prev.filter((z) => z.id !== zone.id));
    await api.deleteGeofence(deviceKey, zone.id, userId);
  };

  const switchDevice = (key) => {
    deviceStore.setActiveDeviceKey(userId, key);
    setDeviceKey(key);
    setZones([]);
    setAlerts(alertStore.loadDeviceAlerts(userId, key).map(fromStore));
    setLive({ position: null, hasGps: false, online: false, lastSeen: null });
    hadFix.current = false;
  };

  return (
    <div className="sd">
      <div className="sd-top">
        <header className="sd-header">
          <button
            className="sd-logo"
            onClick={onGoToLanding}
            aria-label="CareTag home"
          >
            <CareTagLogo size="sm" />
          </button>
          <div className="sd-device">
            <span className="sd-device-name">
              <span
                className={`sd-dot ${live.online ? "sd-dot--on" : ""}`}
                aria-hidden="true"
              />
              {devices.length > 1 ? (
                <select
                  value={deviceKey}
                  onChange={(e) => switchDevice(e.target.value)}
                  aria-label="Choose band"
                >
                  {devices.map((d) => (
                    <option key={d.deviceKey} value={d.deviceKey}>
                      {d.nickname || d.deviceKey}
                    </option>
                  ))}
                </select>
              ) : (
                <strong>{childName}</strong>
              )}
            </span>
            <span className="sd-muted">
              {live.online ? "Band online" : "Band offline"}
              {live.lastSeen ? ` · ${timeAgo(live.lastSeen, now)}` : ""}
            </span>
          </div>
          <button className="sd-btn sd-btn--ghost" onClick={onLogout}>
            Sign out
          </button>
        </header>

        {demo && (
          <div className="sd-demo-ribbon" role="status">
            <span>
              <strong>Demo mode:</strong>{" "}
              {SCENARIOS.find((s) => s.id === demo.id)?.label} — this is a
              pretend child, not your band.
            </span>
            <button className="sd-btn sd-btn--small" onClick={stopDemo}>
              Stop demo
            </button>
          </div>
        )}

        <section
          className={`sd-banner sd-banner--${status.kind}`}
          role="status"
          aria-live="polite"
          data-testid="status-banner"
        >
          <div>
            <h1>{status.title}</h1>
            <p>{status.detail}</p>
          </div>
          {unseen > 0 && (
            <button className="sd-btn" onClick={markAllSeen}>
              Mark alerts as seen
            </button>
          )}
        </section>
      </div>

      <main className="sd-main">
        <div className="sd-map">
          {adding && (
            <div className="sd-map-hint">
              {adding.lat
                ? "Now name it and press Save."
                : "Tap the map where the safe place should be."}
            </div>
          )}
          <MapContainer
            center={mapCenter}
            zoom={16}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FlyTo target={flyTarget} />
            <MapClicks
              onClick={(p) => adding && setAdding((a) => ({ ...a, ...p }))}
            />
            {shown.zones.map((z) => {
              const c = zoneCenter(z);
              const isAlertZone =
                status.kind === "outside" && status.check?.zone?.id === z.id;
              return (
                <Circle
                  key={z.id}
                  center={[c.lat, c.lng]}
                  radius={Number(z.radiusMeters) || 100}
                  pathOptions={{
                    color: isAlertZone ? "#DC2626" : "#16A34A",
                    fillOpacity: 0.12,
                    weight: 2,
                  }}
                />
              );
            })}
            {adding?.lat && (
              <Circle
                center={[adding.lat, adding.lng]}
                radius={Number(adding.radius)}
                pathOptions={{
                  color: "#2563EB",
                  dashArray: "6 6",
                  fillOpacity: 0.1,
                }}
              />
            )}
            {trail.length > 1 && (
              <Polyline
                positions={trail}
                pathOptions={{ color: "#2563EB", weight: 3, opacity: 0.6 }}
              />
            )}
            {shown.position && (
              <Marker
                position={[shown.position.lat, shown.position.lng]}
                icon={childIcon(markerKind, initial)}
              />
            )}
          </MapContainer>
        </div>

        <aside className="sd-side">
          {/* ── Safe places ── */}
          <section className="sd-card">
            <div className="sd-card-head">
              <h2>Safe places</h2>
              {!adding && (
                <button
                  className="sd-btn sd-btn--small"
                  onClick={() => setAdding({ name: "", radius: 100 })}
                >
                  + Add safe place
                </button>
              )}
            </div>

            {adding && (
              <form className="sd-form" onSubmit={saveZone}>
                <p className="sd-muted">
                  {adding.lat
                    ? "Spot picked on the map."
                    : "Step 1: tap the map to pick a spot."}
                </p>
                <label>
                  Name
                  <input
                    value={adding.name}
                    onChange={(e) =>
                      setAdding((a) => ({ ...a, name: e.target.value }))
                    }
                    placeholder="e.g. Home, School"
                    required
                  />
                </label>
                <label>
                  Size: {adding.radius} m around the spot
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="10"
                    value={adding.radius}
                    onChange={(e) =>
                      setAdding((a) => ({ ...a, radius: e.target.value }))
                    }
                  />
                </label>
                <div className="sd-form-actions">
                  <button
                    type="button"
                    className="sd-btn sd-btn--ghost"
                    onClick={() => setAdding(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="sd-btn"
                    disabled={!adding.lat || !adding.name.trim()}
                  >
                    Save
                  </button>
                </div>
              </form>
            )}

            {zones.length === 0 && !adding ? (
              <p className="sd-muted">No safe places yet.</p>
            ) : (
              <ul className="sd-list">
                {zones.map((z) => (
                  <li key={z.id}>
                    <button
                      className="sd-link"
                      onClick={() =>
                        setFlyTarget({
                          ...zoneCenter(z),
                          key: `zone-${z.id}-${Date.now()}`,
                        })
                      }
                    >
                      {zoneName(z)}
                    </button>
                    <span className="sd-muted">
                      {Number(z.radiusMeters) || 100} m
                    </span>
                    <button
                      className="sd-icon-btn"
                      onClick={() => removeZone(z)}
                      aria-label={`Remove ${zoneName(z)}`}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Alerts ── */}
          <section className="sd-card">
            <div className="sd-card-head">
              <h2>
                Alerts{" "}
                {unseen > 0 && <span className="sd-badge">{unseen}</span>}
              </h2>
            </div>
            {alerts.length === 0 ? (
              <p className="sd-muted">
                No alerts. You will see one here if the child leaves a safe
                place.
              </p>
            ) : (
              <ul className="sd-list sd-alerts" data-testid="alert-list">
                {alerts.slice(0, 15).map((a) => (
                  <li
                    key={a.id}
                    className={`sd-alert sd-alert--${a.kind}${a.seen ? "" : " sd-alert--new"}`}
                  >
                    <span>
                      {a.kind === "left" ? "⚠️" : "✅"} {a.text}
                      {a.isDemo && <em className="sd-tag">demo</em>}
                    </span>
                    <span className="sd-muted">{clock(a.time)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ── Demo ── */}
          <section className="sd-card">
            <div className="sd-card-head">
              <h2>Try a demo</h2>
            </div>
            <p className="sd-muted">
              Watch a pretend child walk around{" "}
              {zones.length ? `“${zoneName(zones[0])}”` : "a demo safe place"}.
              Your real alerts are not affected.
            </p>
            <div className="sd-demo-grid">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  className={`sd-demo-btn${demo?.id === s.id ? " sd-demo-btn--active" : ""}`}
                  onClick={() => startDemo(s.id)}
                >
                  <strong>{s.label}</strong>
                  <span>{s.expect}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
