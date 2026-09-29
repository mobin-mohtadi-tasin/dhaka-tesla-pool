# Offline Dhaka street map

The map displays a bundled OpenStreetMap vector extract, projected in Web Mercator. Streets, railways, parks and water follow the source geometry. Zoom, drag-to-pan, keyboard panning, marker details, a scale bar and a fit-to-zones control run locally in the browser. The map automatically frames both endpoints when the route or container size changes.

The map is independent of matching, seat reservations and fare calculations. The dashed segment connects two representative zone points; it is **not a road route**. There is no live vehicle position, routing engine, traffic estimate or road-access validation. Users can open a marker to see its representative landmark and confirm the actual meeting spot with their driver.

## Coverage and source

- Geographic bounds: longitude 90.360–90.430, latitude 23.770–23.885.
- Dataset: `apps/web/public/maps/dhaka.json`, including source, download timestamp and license metadata.
- Source API: <https://api.openstreetmap.org/api/0.6/map>.
- Attribution: © OpenStreetMap contributors, <https://www.openstreetmap.org/copyright>.
- The bundled derived database is available under ODbL 1.0: <https://opendatacommons.org/licenses/odbl/1-0/>.
- The download is a snapshot. Roads and place records may change; detail is limited to the bundled area. The subdued background outside its boundary represents missing coverage.

`apps/web/features/map/lib/map-zones.ts` records a source OSM object for every marker. Banani uses Kakoli/Banani bus stop near Kamal Ataturk Avenue; Mohakhali uses the bus station near the rail gate; Gulshan 1 and Gulshan 2 use points by their circles; Mirpur 10 uses the circle bus stop; Uttara uses Azampur bus stop. These are display reference points, not verified boarding locations or new service boundaries.

## Reproduce the extract

Run `python scripts/build-dhaka-map.py` with Python 3 and network access. No third-party Python packages are needed. The script downloads raw OSM XML, splits requests when the API's node limit is reached, caches responses in the system temporary directory, extracts the selected feature classes, assembles complete multipolygon rings, and writes compact JSON. Failed requests never replace the committed map with an incomplete result. OSM tile servers are not used.

Cached responses preserve the downloaded snapshot when rerunning the script. For a fresh snapshot, use a fresh system temporary directory for the script process. Inspect changes and rerun map tests before accepting updated place coordinates. Normal app builds and browser map rendering require no external mapping service or API key.

## Verify

Use Node.js 22.18 or newer for the built-in TypeScript stripping in the map tests:

```text
node --experimental-strip-types --test apps/web/test/map.test.mjs
npm run typecheck -w @dtp/web
npm run lint -w @dtp/web
```

The tests check north/east orientation, fit margins for every supported route at mobile and desktop sizes, marker provenance, polygon closure, and pan/zoom limits.
