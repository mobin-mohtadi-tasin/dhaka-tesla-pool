'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { constrainView, fitPoints, pathFor, project, toScreen, type Coordinate, type Extent, type View } from '@/features/map/lib/map-geometry';
import { mapZones } from '@/features/map/lib/map-zones';

type Feature = { id: string; kind: string; name: string; paths: Coordinate[][] };
type MapData = { bounds: [number, number, number, number]; features: Feature[]; downloadedAt: string };
type PreparedMap = { layers: Record<string, string>; areas: { id: string; kind: string; path: string }[]; labels: { name: string; point: ReturnType<typeof project> }[]; extent: Extent };
let mapRequest: Promise<PreparedMap> | undefined;

function loadMap() {
  if (!mapRequest) {
    mapRequest = fetch('/maps/dhaka.json').then(async (response) => {
      if (!response.ok) throw new Error('Map data could not be loaded.');
      const data: MapData = await response.json();
      const layers: Record<string, string[]> = {};
      const areas: PreparedMap['areas'] = [];
      const named = new Map<string, { length: number; point: ReturnType<typeof project> }>();
      for (const feature of data.features) {
        if (['green', 'water'].includes(feature.kind)) {
          areas.push({ id: feature.id, kind: feature.kind, path: feature.paths.map((points) => pathFor(points, true)).join(' ') });
        } else {
          (layers[feature.kind] ??= []).push(...feature.paths.map((points) => pathFor(points)));
        }
        if (feature.kind !== 'major' || !feature.name) continue;
        const points = feature.paths[0].map(project);
        const length = points.reduce((total, point, i) => i ? total + Math.hypot(point.x - points[i - 1].x, point.y - points[i - 1].y) : total, 0);
        if (length > (named.get(feature.name)?.length ?? 180)) named.set(feature.name, { length, point: points[Math.floor(points.length / 2)] });
      }
      const topLeft = project([data.bounds[0], data.bounds[3]]);
      const bottomRight = project([data.bounds[2], data.bounds[1]]);
      return {
        layers: Object.fromEntries(Object.entries(layers).map(([kind, paths]) => [kind, paths.join(' ')])),
        areas: areas.sort((a, b) => a.kind.localeCompare(b.kind)),
        labels: Array.from(named, ([name, { point }]) => ({ name, point })),
        extent: { left: topLeft.x, top: topLeft.y, right: bottomRight.x, bottom: bottomRight.y },
      };
    }).catch((error) => { mapRequest = undefined; throw error; });
  }
  return mapRequest;
}

export function RouteMap({ from = 'BANANI', to = 'MOHAKHALI' }: { from?: string; to?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; view: View; pointerId: number } | null>(null);
  const [size, setSize] = useState({ width: 600, height: 400 });
  const [data, setData] = useState<PreparedMap | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [manualView, setManualView] = useState<{ key: string; view: View } | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const origin = mapZones[from];
  const destination = mapZones[to];
  const routeKey = `${from}/${to}/${size.width}/${size.height}`;
  const endpoints = useMemo(() => origin && destination ? [project(origin.coordinate), project(destination.coordinate)] : [], [origin, destination]);
  const fitted = useMemo(() => endpoints.length ? fitPoints(endpoints, size.width, size.height) : { x: 0, y: 0, scale: 10 }, [endpoints, size]);
  const view = manualView?.key === routeKey ? manualView.view : fitted;

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: Math.max(1, entry.contentRect.width), height: Math.max(1, entry.contentRect.height) }));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    setError(false);
    loadMap().then((value) => { if (active) setData(value); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [retry]);

  function move(next: View) {
    if (data) setManualView({ key: routeKey, view: constrainView(next, data.extent, size.width, size.height) });
  }

  const labels = useMemo(() => {
    if (!data) return [];
    const placed: { x: number; y: number; name: string }[] = [];
    for (const road of data.labels) {
      const point = toScreen(road.point, view, size.width, size.height);
      if (point.x < 75 || point.x > size.width - 85 || point.y < 55 || point.y > size.height - 60) continue;
      if (placed.some((previous) => Math.abs(previous.x - point.x) < 145 && Math.abs(previous.y - point.y) < 35)) continue;
      if (endpoints.some((end) => { const marker = toScreen(end, view, size.width, size.height); return Math.abs(marker.x - point.x) < 85 && Math.abs(marker.y - point.y) < 42; })) continue;
      placed.push({ ...point, name: road.name });
      if (placed.length >= 9) break;
    }
    return placed;
  }, [data, view, size, endpoints]);

  const fromScreen = endpoints[0] && toScreen(endpoints[0], view, size.width, size.height);
  const toScreenPoint = endpoints[1] && toScreen(endpoints[1], view, size.width, size.height);
  const scaleMetres = 100 * view.scale * Math.cos(23.8 * Math.PI / 180);
  const scaleLabel = scaleMetres >= 1000 ? `${(scaleMetres / 1000).toFixed(1)} km` : `${Math.round(scaleMetres / 10) * 10} m`;

  return <div className="route-map geographic-map">
    <div className="geo-map-surface" ref={container}>
      {!origin || !destination ? <div className="geo-map-message">This zone has no map reference yet.</div> : !data ? <div className="geo-map-message" role="status">{error ? <>Map could not load.<button className="secondary" onClick={() => setRetry((value) => value + 1)}>Retry map</button></> : <><span className="spinner" />Loading Dhaka’s streets…</>}</div> : <>
        <svg className="geo-map-canvas" viewBox={`0 0 ${size.width} ${size.height}`} tabIndex={0} role="group" aria-label={`Street map from ${origin.name} to ${destination.name}. Use arrow keys to pan, plus and minus to zoom, or zero to fit both zones.`}
          onKeyDown={(event) => {
            const shifts: Record<string, [number, number]> = { ArrowLeft: [-60, 0], ArrowRight: [60, 0], ArrowUp: [0, -60], ArrowDown: [0, 60] };
            if (shifts[event.key]) { event.preventDefault(); move({ ...view, x: view.x + shifts[event.key][0] * view.scale, y: view.y + shifts[event.key][1] * view.scale }); }
            if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); move({ ...view, scale: view.scale * (event.key === '-' ? 1.4 : 1 / 1.4) }); }
            if (event.key === '0') { event.preventDefault(); setManualView(null); }
          }}
          onPointerDown={(event) => {
            if (event.button !== 0 || !event.isPrimary) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = { x: event.clientX, y: event.clientY, view, pointerId: event.pointerId };
          }}
          onPointerMove={(event) => {
            const start = drag.current;
            if (!start || start.pointerId !== event.pointerId) return;
            move({ ...start.view, x: start.view.x - (event.clientX - start.x) * start.view.scale, y: start.view.y - (event.clientY - start.y) * start.view.scale });
          }}
          onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
          <title>Dhaka street map, © OpenStreetMap contributors</title>
          <g transform={`translate(${size.width / 2 - view.x / view.scale},${size.height / 2 - view.y / view.scale}) scale(${1 / view.scale})`}>
            <rect x={data.extent.left} y={data.extent.top} width={data.extent.right - data.extent.left} height={data.extent.bottom - data.extent.top} className="geo-coverage" />
            {data.areas.map((area) => <path key={area.id} d={area.path} className={`geo-${area.kind}`} fillRule="evenodd" vectorEffect="non-scaling-stroke" />)}
            {['waterway', 'street', 'major', 'rail'].map((kind) => <g key={kind}>{['street', 'major'].includes(kind) && <path d={data.layers[kind]} className={`geo-${kind}-casing`} vectorEffect="non-scaling-stroke" />}<path d={data.layers[kind]} className={`geo-${kind}`} vectorEffect="non-scaling-stroke" /></g>)}
          </g>
          {labels.map((road) => <text key={road.name} x={road.x} y={road.y} className="geo-road-label" textAnchor="middle">{road.name.length > 31 ? road.name.slice(0, 29) + '…' : road.name}</text>)}
          {fromScreen && toScreenPoint && <line x1={fromScreen.x} y1={fromScreen.y} x2={toScreenPoint.x} y2={toScreenPoint.y} className="geo-zone-connection" />}
          {Object.entries(mapZones).map(([zone, place]) => {
            const point = toScreen(project(place.coordinate), view, size.width, size.height);
            const endpoint = zone === from || zone === to;
            if (point.x < 10 || point.y < 45 || point.x > size.width - 10 || point.y > size.height - 28) return null;
            return <g key={zone} transform={`translate(${point.x},${point.y})`} className="geo-marker" role="button" tabIndex={0} aria-label={`${zone === from ? 'Pickup: ' : zone === to ? 'Destination: ' : ''}${place.name}. ${place.reference}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => setFocus(focus === zone ? null : zone)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); setFocus(focus === zone ? null : zone); } }}>
              <title>{place.name} — {place.reference}</title>
              <circle r={endpoint ? 17 : 5} className={zone === from ? 'geo-pickup-pin' : zone === to ? 'geo-destination-pin' : 'geo-other-pin'} />
              {endpoint && <text y="5" textAnchor="middle" className="geo-pin-letter">{zone === from ? 'A' : 'B'}</text>}
              <text y={endpoint ? -26 : -12} textAnchor={point.x < 95 ? 'start' : point.x > size.width - 130 ? 'end' : 'middle'} className={`geo-zone-label ${endpoint ? 'geo-selected-label' : ''}`}>{place.name}</text>
            </g>;
          })}
        </svg>
        <div className="geo-map-heading"><span>Dhaka street map</span><span aria-label="North is up">N ↑</span></div>
        <div className="geo-map-controls" aria-label="Map controls"><button onClick={() => move({ ...view, scale: view.scale / 1.4 })} aria-label="Zoom in">+</button><button onClick={() => move({ ...view, scale: view.scale * 1.4 })} aria-label="Zoom out">−</button><button className="geo-fit" onClick={() => { setManualView(null); setFocus(null); }} aria-label="Fit pickup and destination">Fit</button></div>
        {focus && mapZones[focus] && <div className="geo-place-card"><button aria-label="Close place details" onClick={() => setFocus(null)}>×</button><b>{mapZones[focus].name}</b><span>{mapZones[focus].reference}</span><small>Representative zone point · confirm your meeting spot with the driver.</small></div>}
        <div className="geo-scale" aria-label={`Scale bar approximately ${scaleLabel}`}><span>{scaleLabel}</span><i /></div>
      </>}
      <a className="geo-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap contributors</a>
    </div>
    <div className="geo-map-legend"><span><i className="geo-legend-line" /> Zone connection · not road directions</span><span>Drag to pan · + / − to zoom</span></div>
    {origin && destination && <div className="geo-endpoints"><span><b>A</b>{origin.name}</span><span aria-hidden="true">→</span><span><b>B</b>{destination.name}</span></div>}
  </div>;
}
