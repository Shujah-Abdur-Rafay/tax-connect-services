import { useEffect, useRef, useState } from 'react';
import { Loader2, MapPin, AlertCircle } from 'lucide-react';
import { geocodeProfessional, type Coordinates } from '@/services/geocodingService';

// Leaflet is loaded globally via <script> in index.html (CDN).
declare global {
  interface Window {
    L?: any;
  }
}

export interface MapProfessional {
  id: string;
  name: string;
  rating: number;
  reviewCount?: number;
  specialties?: string[];
  city?: string;
  state?: string;
  zip_code?: string;
  location?: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface Props {
  professionals: MapProfessional[];
  /** Called when a popup's "View Profile" link is clicked. */
  onViewProfile?: (id: string) => void;
}

/**
 * Wait for the global Leaflet script (loaded via CDN in index.html) to
 * become available. Resolves to true when ready, or false after timing out.
 */
function waitForLeaflet(timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && window.L) return resolve(true);
    const start = Date.now();
    const iv = setInterval(() => {
      if (typeof window !== 'undefined' && window.L) {
        clearInterval(iv);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(iv);
        resolve(false);
      }
    }, 100);
  });
}

/** Render a star rating string like "★ 4.8 (47)". */
function ratingText(rating: number, reviews?: number): string {
  const r = (Math.round(rating * 10) / 10).toFixed(1);
  if (typeof reviews === 'number' && reviews > 0) return `${r} (${reviews})`;
  return r;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const ProfessionalMapView = ({ professionals, onViewProfile }: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [geocodedCount, setGeocodedCount] = useState(0);
  const [totalToGeocode, setTotalToGeocode] = useState(0);
  const [skipped, setSkipped] = useState(0);

  // 1. Initialize the map exactly once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await waitForLeaflet();
      if (cancelled) return;
      if (!ok || !window.L || !containerRef.current) {
        setStatus('error');
        return;
      }
      const L = window.L;
      // Center on geographic middle of the US, zoomed out to show all 48.
      const map = L.map(containerRef.current, {
        center: [39.8283, -98.5795],
        zoom: 4,
        scrollWheelZoom: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      markersLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
      setStatus('ready');
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersLayerRef.current = null;
      }
    };
  }, []);

  // 2. Whenever the map is ready or the prof list changes, geocode + plot.
  useEffect(() => {
    if (status !== 'ready' || !mapRef.current || !markersLayerRef.current) return;
    if (!window.L) return;
    const L = window.L;
    const map = mapRef.current;
    const layer = markersLayerRef.current;

    let cancelled = false;
    layer.clearLayers();
    setGeocodedCount(0);
    setSkipped(0);
    setTotalToGeocode(professionals.length);

    const bounds = L.latLngBounds([]);
    let plotted = 0;
    let skippedLocal = 0;

    // Delegated click handler for "View Profile" links inside popups.
    // Leaflet popups are detached DOM, but the popup container ends up
    // inside our map container, so a delegated listener on that root works.
    const containerEl = containerRef.current;
    const clickHandler = (ev: Event) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      const link = target.closest('a[data-prof-id]') as HTMLAnchorElement | null;
      if (!link) return;
      if (onViewProfile) {
        ev.preventDefault();
        onViewProfile(link.getAttribute('data-prof-id') || '');
      }
    };
    containerEl?.addEventListener('click', clickHandler);

    (async () => {
      for (const prof of professionals) {
        if (cancelled) break;
        const coords: Coordinates | null = await geocodeProfessional({
          id: prof.id,
          city: prof.city,
          state: prof.state,
          zip_code: prof.zip_code,
          location: prof.location,
          latitude: prof.latitude ?? undefined,
          longitude: prof.longitude ?? undefined,
        });
        if (cancelled) break;

        if (!coords) {
          skippedLocal += 1;
          setSkipped(skippedLocal);
          continue;
        }

        const locLine = prof.location || [prof.city, prof.state].filter(Boolean).join(', ');
        const specialties = (prof.specialties || []).slice(0, 4);
        const specialtyHtml = specialties.length
          ? `<div style="margin:6px 0 8px;display:flex;flex-wrap:wrap;gap:4px;">${specialties
              .map(
                (s) =>
                  `<span style="display:inline-block;background:#eff6ff;color:#1d4ed8;border-radius:9999px;padding:2px 8px;font-size:11px;font-weight:500;">${escapeHtml(
                    s
                  )}</span>`
              )
              .join('')}</div>`
          : '';

        const html = `
          <div style="min-width:200px;max-width:240px;font-family:inherit;">
            <div style="font-weight:600;color:#111827;font-size:14px;line-height:1.3;">${escapeHtml(
              prof.name
            )}</div>
            <div style="color:#6b7280;font-size:12px;margin-top:2px;">${escapeHtml(
              locLine
            )}</div>
            <div style="margin-top:4px;color:#f59e0b;font-size:12px;font-weight:600;">
              <span style="color:#f59e0b;">★</span>
              <span style="color:#111827;">${escapeHtml(
                ratingText(prof.rating || 0, prof.reviewCount)
              )}</span>
            </div>
            ${specialtyHtml}
            <a
              href="/professional/${encodeURIComponent(prof.id)}"
              data-prof-id="${escapeHtml(prof.id)}"
              style="display:inline-block;margin-top:4px;background:#2563eb;color:#fff;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none;"
            >View Profile</a>
          </div>
        `;

        const marker = L.marker([coords.lat, coords.lng]);
        marker.bindPopup(html, { maxWidth: 260 });
        marker.addTo(layer);
        bounds.extend([coords.lat, coords.lng]);
        plotted += 1;
        setGeocodedCount(plotted);
      }

      if (!cancelled && plotted > 0 && bounds.isValid()) {
        try {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
        } catch {
          // ignore — bad bounds shouldn't crash the page
        }
      }
    })();

    return () => {
      cancelled = true;
      containerEl?.removeEventListener('click', clickHandler);
    };
  }, [status, professionals, onViewProfile]);

  return (
    <div className="relative w-full">
      <div
        ref={containerRef}
        className="w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm"
        style={{ height: '600px', background: '#f3f4f6' }}
      />

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-xl">
          <div className="flex items-center gap-2 text-gray-700">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading map…</span>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-xl">
          <div className="text-center max-w-sm px-4">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="font-semibold text-gray-900">Map failed to load</p>
            <p className="text-sm text-gray-500 mt-1">
              We couldn't load the OpenStreetMap library. Check your network connection and try again.
            </p>
          </div>
        </div>
      )}

      {status === 'ready' && totalToGeocode > 0 && geocodedCount < totalToGeocode && (
        <div className="absolute top-3 right-3 bg-white shadow-md rounded-lg px-3 py-2 text-xs text-gray-700 flex items-center gap-2 border border-gray-100">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
          <span>
            Placing markers… {geocodedCount}/{totalToGeocode}
          </span>
        </div>
      )}

      {status === 'ready' && totalToGeocode > 0 && geocodedCount === totalToGeocode && (
        <div className="absolute top-3 right-3 bg-white shadow-md rounded-lg px-3 py-2 text-xs text-gray-700 flex items-center gap-2 border border-gray-100">
          <MapPin className="h-3.5 w-3.5 text-blue-600" />
          <span>
            {geocodedCount} professional{geocodedCount === 1 ? '' : 's'} shown
            {skipped > 0 ? ` · ${skipped} without an address` : ''}
          </span>
        </div>
      )}
    </div>
  );
};

export default ProfessionalMapView;
