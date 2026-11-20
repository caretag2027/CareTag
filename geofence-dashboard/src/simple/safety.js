/**
 * CareTag safety logic — the whole "is the child safe?" decision in one place.
 *
 *   checkPosition(position, zones)  → is this point inside any safe place?
 *   getStatus({...})                → one plain-language status for the banner
 *   createAlertMonitor()            → turns a stream of checks into alert events
 *                                     (one alert when the child leaves, one notice
 *                                     when they come back — never a flood)
 */

/** Extra metres allowed past the edge before we call it "outside" (GPS wobble). */
export const GPS_WOBBLE_METERS = 15;

/** Straight-line distance between two { lat, lng } points, in metres. */
export function distanceMeters(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Reads the zone shape used across CareTag (centerLatitude/centerLongitude/radiusMeters). */
export function zoneCenter(zone) {
  return {
    lat: Number(zone.centerLatitude ?? zone.latitude ?? zone.lat),
    lng: Number(zone.centerLongitude ?? zone.longitude ?? zone.lng),
  };
}

export function zoneName(zone) {
  return zone.label || zone.name || 'Safe place';
}

function isZoneOn(zone) {
  return zone.enabled !== false && zone.isActive !== false;
}

/**
 * Is `position` inside any safe place?
 * Returns null if there is no position or no safe place to compare against.
 *
 * @returns {{ inside: boolean, zone: object, zoneName: string, metersOutside: number } | null}
 *   `zone` is the zone the child is in, or the nearest one when outside.
 */
export function checkPosition(position, zones, wobbleMeters = GPS_WOBBLE_METERS) {
  if (!position || position.lat == null || position.lng == null) return null;
  const active = (zones || []).filter(isZoneOn);
  if (active.length === 0) return null;

  let nearest = null;
  for (const zone of active) {
    const radius = Number(zone.radiusMeters) || 100;
    const gap = distanceMeters(position, zoneCenter(zone)) - radius; // < 0 means inside
    if (gap <= wobbleMeters) {
      return { inside: true, zone, zoneName: zoneName(zone), metersOutside: 0 };
    }
    if (!nearest || gap < nearest.gap) nearest = { zone, gap };
  }
  return {
    inside: false,
    zone: nearest.zone,
    zoneName: zoneName(nearest.zone),
    metersOutside: Math.round(nearest.gap),
  };
}

/**
 * One status for the big banner at the top of the dashboard.
 *
 * @param {object} p
 * @param {boolean} p.bandOnline  band is sending data right now
 * @param {boolean} p.hasGps      latest reading has a real GPS fix
 * @param {object|null} p.position { lat, lng }
 * @param {Array} p.zones
 * @returns {{ kind: 'no_zones'|'offline'|'no_gps'|'safe'|'outside', title: string, detail: string, check: object|null }}
 */
export function getStatus({ bandOnline, hasGps, position, zones }) {
  const activeZones = (zones || []).filter(isZoneOn);

  if (activeZones.length === 0) {
    return {
      kind: 'no_zones',
      title: 'Add a safe place to start',
      detail: 'Tap “Add safe place” and pick a spot on the map, like home or school.',
      check: null,
    };
  }
  if (!bandOnline) {
    return {
      kind: 'offline',
      title: 'Band is offline',
      detail: 'No data from the band. Check that it is switched on and has internet.',
      check: null,
    };
  }
  if (!hasGps || !position) {
    return {
      kind: 'no_gps',
      title: 'Waiting for GPS',
      detail: 'The band is connected but has no location yet. Move outdoors with a clear view of the sky.',
      check: null,
    };
  }

  const check = checkPosition(position, activeZones);
  if (check.inside) {
    return { kind: 'safe', title: `Safe — inside ${check.zoneName}`, detail: 'Everything looks normal.', check };
  }
  return {
    kind: 'outside',
    title: `Outside safe place — ${check.metersOutside} m from ${check.zoneName}`,
    detail: 'The child has left all safe places.',
    check,
  };
}

/**
 * Watches successive checks and reports only *changes*:
 *   - 'left'     the child went from inside (or unknown) to outside → raise an alert
 *   - 'returned' the child came back inside after an alert
 * Readings without GPS are ignored, so a lost signal never causes a false alert.
 */
export function createAlertMonitor() {
  let wasOutside = false;

  return {
    /** @param {ReturnType<typeof checkPosition>} check  @returns {null | {type, zoneName, metersOutside}} */
    update(check) {
      if (!check) return null;
      if (!check.inside && !wasOutside) {
        wasOutside = true;
        return { type: 'left', zoneName: check.zoneName, metersOutside: check.metersOutside };
      }
      if (check.inside && wasOutside) {
        wasOutside = false;
        return { type: 'returned', zoneName: check.zoneName, metersOutside: 0 };
      }
      return null;
    },
    reset() {
      wasOutside = false;
    },
    get isOutside() {
      return wasOutside;
    },
  };
}
