/**
 * Geocoding service using OpenStreetMap's Nominatim API.
 *
 * - No API key required.
 * - Nominatim's usage policy asks for ≤ 1 request/second + a descriptive
 *   User-Agent / Referer. We respect both via an in-flight rate-limit gate
 *   and rely on the browser's Referer header (we can't override User-Agent).
 * - Results are cached in localStorage forever (geocodes effectively never
 *   change for a city/zip) and — for real Firestore-backed pros — also
 *   persisted onto the professional's document so subsequent visitors don't
 *   re-geocode at all.
 */
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface Coordinates {
  lat: number;
  lng: number;
}

const CACHE_PREFIX = 'geo:v1:';
const NEGATIVE_CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 1 day for "not found"

/** Normalize a query string into a stable cache key. */
function cacheKey(q: string): string {
  return CACHE_PREFIX + q.trim().toLowerCase().replace(/\s+/g, ' ');
}

function readCache(q: string): Coordinates | null | undefined {
  try {
    const raw = localStorage.getItem(cacheKey(q));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (parsed === null) return null;
    if (parsed && parsed._notFoundAt) {
      if (Date.now() - parsed._notFoundAt < NEGATIVE_CACHE_TTL_MS) return null;
      return undefined;
    }
    if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
      return { lat: parsed.lat, lng: parsed.lng };
    }
  } catch {
    // ignore
  }
  return undefined;
}

function writeCache(q: string, coords: Coordinates | null) {
  try {
    if (coords) {
      localStorage.setItem(cacheKey(q), JSON.stringify(coords));
    } else {
      localStorage.setItem(cacheKey(q), JSON.stringify({ _notFoundAt: Date.now() }));
    }
  } catch {
    // localStorage might be full / disabled — non-fatal
  }
}

// --- Rate-limited request queue ----------------------------------------
// Nominatim allows up to ~1 req/sec from a single client.
let lastRequestAt = 0;
const MIN_INTERVAL_MS = 1100;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const wait = lastRequestAt + MIN_INTERVAL_MS - now;
  if (wait > 0) {
    await new Promise((r) => setTimeout(r, wait));
  }
  lastRequestAt = Date.now();
}

/** Build a Nominatim-friendly search string from the parts we have. */
function buildQuery(input: {
  city?: string;
  state?: string;
  zip_code?: string;
  location?: string;
}): string | null {
  const zip = (input.zip_code || '').trim();
  const city = (input.city || '').trim();
  const state = (input.state || '').trim();
  const loc = (input.location || '').trim();

  // ZIP is the most precise — prefer it when available.
  if (zip) {
    const parts = [zip];
    if (state) parts.push(state);
    parts.push('USA');
    return parts.join(', ');
  }
  if (city || state) {
    const parts = [city, state, 'USA'].filter(Boolean);
    return parts.join(', ');
  }
  if (loc) {
    return loc.includes('USA') ? loc : `${loc}, USA`;
  }
  return null;
}

/**
 * Geocode a professional. Returns null if we couldn't resolve coordinates.
 * Uses (in order): localStorage cache → existing lat/lng on the prof → Nominatim.
 */
export async function geocodeProfessional(prof: {
  id: string;
  city?: string;
  state?: string;
  zip_code?: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<Coordinates | null> {
  // 1. Already on the doc → use as-is.
  if (
    typeof prof.latitude === 'number' &&
    typeof prof.longitude === 'number' &&
    !Number.isNaN(prof.latitude) &&
    !Number.isNaN(prof.longitude)
  ) {
    return { lat: prof.latitude, lng: prof.longitude };
  }

  const query = buildQuery(prof);
  if (!query) return null;

  // 2. localStorage cache (positive or negative).
  const cached = readCache(query);
  if (cached !== undefined) return cached;

  // 3. Hit Nominatim.
  await rateLimit();
  try {
    const url =
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=' +
      encodeURIComponent(query);
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      writeCache(query, null);
      return null;
    }
    const arr = await res.json();
    if (!Array.isArray(arr) || arr.length === 0) {
      writeCache(query, null);
      return null;
    }
    const lat = parseFloat(arr[0].lat);
    const lng = parseFloat(arr[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      writeCache(query, null);
      return null;
    }
    const coords: Coordinates = { lat, lng };
    writeCache(query, coords);

    // 4. Best-effort: persist on the Firestore doc so future loads skip
    //    Nominatim entirely. We do NOT await/await failures here — sample
    //    professionals (string ids like "1", "gerald-shava-001") may not
    //    exist in Firestore, and that's OK.
    persistCoordinates(prof.id, coords).catch(() => {
      /* ignore — caching to Firestore is opportunistic */
    });

    return coords;
  } catch {
    return null;
  }
}

/** Write lat/lng back to the professional's Firestore doc. Best-effort. */
async function persistCoordinates(id: string, coords: Coordinates): Promise<void> {
  if (!id) return;
  try {
    const ref = doc(db, 'professionals', id);
    await updateDoc(ref, {
      latitude: coords.lat,
      longitude: coords.lng,
      geocoded_at: new Date().toISOString(),
    });
  } catch {
    // Doc may not exist (sample data) or rules may forbid the write.
    // We silently swallow — localStorage cache still benefits this session.
  }
}
