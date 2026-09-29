import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { project, fitPoints, toScreen, constrainView } from '../features/map/lib/map-geometry.ts';
import { mapZones } from '../features/map/lib/map-zones.ts';

const data = JSON.parse(await readFile(new URL('../public/maps/dhaka.json', import.meta.url), 'utf8'));
const routes = [
  ['BANANI', 'MOHAKHALI'], ['BANANI', 'GULSHAN_1'], ['BANANI', 'GULSHAN_2'],
  ['GULSHAN_2', 'GULSHAN_1'], ['MOHAKHALI', 'BANANI'], ['MIRPUR_10', 'UTTARA'],
];

test('north remains up and east remains right in the geographic projection', () => {
  const centre = project([90.4, 23.8]);
  assert.ok(project([90.4, 23.81]).y < centre.y);
  assert.ok(project([90.41, 23.8]).x > centre.x);
  assert.ok(project(mapZones.BANANI.coordinate).y < project(mapZones.MOHAKHALI.coordinate).y);
  assert.ok(project(mapZones.GULSHAN_2.coordinate).x > project(mapZones.BANANI.coordinate).x);
  assert.ok(project(mapZones.UTTARA.coordinate).y < project(mapZones.MIRPUR_10.coordinate).y);
});

test('all supported routes fit both markers on mobile and desktop with usable margins', () => {
  for (const [from, to] of routes) {
    for (const [width, height] of [[280, 300], [360, 360], [700, 420]]) {
      const points = [project(mapZones[from].coordinate), project(mapZones[to].coordinate)];
      const view = fitPoints(points, width, height);
      for (const point of points) {
        const screen = toScreen(point, view, width, height);
        assert.ok(screen.x >= 60 && screen.x <= width - 60, `${from}/${to}: horizontal clipping`);
        assert.ok(screen.y >= 70 && screen.y <= height - 70, `${from}/${to}: vertical clipping`);
      }
    }
  }
});

test('map markers match their cited OSM place or way rather than decorative coordinates', () => {
  for (const zone of Object.values(mapZones)) {
    const source = data.places.find((place) => place.id === zone.source) ?? data.features.find((feature) => feature.id === zone.source);
    assert.ok(source, `Missing source for ${zone.name}`);
    const coordinates = source.point ? [source.point] : source.paths.flat();
    assert.ok(coordinates.some(([lon, lat]) => Math.abs(lon - zone.coordinate[0]) < 0.000001 && Math.abs(lat - zone.coordinate[1]) < 0.000001), `Coordinates drifted for ${zone.name}`);
    const [west, south, east, north] = data.bounds;
    assert.ok(zone.coordinate[0] > west && zone.coordinate[0] < east && zone.coordinate[1] > south && zone.coordinate[1] < north);
  }
});

test('the bundled extract has real roads and water; every coordinate is finite', () => {
  assert.ok(data.features.filter((feature) => feature.kind === 'major').length > 100);
  assert.ok(data.features.filter((feature) => feature.kind === 'water').length > 10);
  for (const feature of data.features) {
    for (const path of feature.paths) {
      assert.ok(path.length >= 2);
      assert.ok(path.every(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat)));
      if (['water', 'green'].includes(feature.kind)) assert.deepEqual(path[0], path.at(-1), `Unclosed polygon ${feature.id}`);
    }
  }
});

test('extreme pan and zoom inputs stay bounded and keep a positive scale', () => {
  const extent = { left: -1000, top: -2000, right: 1000, bottom: 2000 };
  const zoomed = constrainView({ x: 1e9, y: -1e9, scale: 0 }, extent, 400, 400);
  assert.deepEqual(zoomed, { x: 1000, y: -2000, scale: 0.5 });
  assert.ok(constrainView({ x: 0, y: 0, scale: 1e9 }, extent, 400, 400).scale <= 11.5);
});
