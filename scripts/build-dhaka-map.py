"""Build a small offline OSM extract using only Python's standard library.

Raw XML responses are cached in the system temp directory, not the repository.
The generated map contains geographic data, never routing or fare decisions.
"""
import hashlib
from datetime import datetime, timezone
import json
import tempfile
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = Path(tempfile.gettempdir()) / 'dtp-osm-extract'
BOUNDS = [90.360, 23.770, 90.430, 23.885]  # west, south, east, north
nodes, ways, relations = {}, {}, {}
download_times = []
requests_made = 0


def fetch(bounds, depth=0):
    global requests_made
    bbox = ','.join(f'{n:.6f}' for n in bounds)
    cached = CACHE / (hashlib.sha256(bbox.encode()).hexdigest()[:16] + '.osm')
    if not cached.exists():
        if requests_made >= 40:
            raise RuntimeError('Download limit reached; rerun to continue from cache.')
        requests_made += 1
        request = urllib.request.Request(
            'https://api.openstreetmap.org/api/0.6/map?bbox=' + bbox,
            headers={'User-Agent': 'DhakaTeslaPool/1.0 (offline internship map preparation)'},
        )
        print('Fetching', bbox, flush=True)
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                content = response.read()
            cached.write_bytes(content)
            time.sleep(1)
        except urllib.error.HTTPError as error:
            reason = error.read().decode(errors='replace')
            if error.code == 400 and 'too many nodes' in reason.lower() and depth < 7:
                west, south, east, north = bounds
                if east - west > north - south:
                    middle = (west + east) / 2
                    fetch([west, south, middle, north], depth + 1)
                    fetch([middle, south, east, north], depth + 1)
                else:
                    middle = (south + north) / 2
                    fetch([west, south, east, middle], depth + 1)
                    fetch([west, middle, east, north], depth + 1)
                return
            raise RuntimeError(f'OSM download failed: {error.code} {reason[:250]}') from error
    root = ET.parse(cached).getroot()
    download_times.append(cached.stat().st_mtime)
    for item in root:
        tags = {tag.attrib['k']: tag.attrib['v'] for tag in item.findall('tag')}
        if item.tag == 'node':
            nodes[item.attrib['id']] = {
                'point': [float(item.attrib['lon']), float(item.attrib['lat'])],
                'tags': tags,
            }
        elif item.tag == 'way':
            ways[item.attrib['id']] = {
                'nodes': [nd.attrib['ref'] for nd in item.findall('nd')], 'tags': tags,
            }
        elif item.tag == 'relation':
            relations[item.attrib['id']] = {
                'members': [m.attrib for m in item.findall('member')], 'tags': tags,
            }
    print(f'Loaded {len(nodes)} nodes and {len(ways)} ways so far', flush=True)


def kind(tags):
    road = tags.get('highway')
    if road in {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'}:
        return 'major'
    if road in {'residential', 'unclassified', 'living_street', 'service'}:
        return 'street'
    if tags.get('natural') == 'water' or tags.get('waterway') == 'riverbank':
        return 'water'
    if tags.get('waterway') in {'river', 'canal', 'stream'}:
        return 'waterway'
    if tags.get('leisure') in {'park', 'garden', 'golf_course', 'pitch'} or tags.get('landuse') in {'forest', 'grass', 'recreation_ground'}:
        return 'green'
    if tags.get('railway') in {'rail', 'light_rail'}:
        return 'rail'
    return None


def coordinates(refs):
    if not refs or any(ref not in nodes for ref in refs):
        return None
    return [[round(value, 6) for value in nodes[ref]['point']] for ref in refs]


def build():
    CACHE.mkdir(parents=True, exist_ok=True)
    fetch(BOUNDS)
    features = []
    for identity, way in ways.items():
        category = kind(way['tags'])
        if not category:
            continue
        points = coordinates(way['nodes'])
        if not points or len(points) < 2:
            continue
        if category in {'water', 'green'} and way['nodes'][0] != way['nodes'][-1]:
            continue
        features.append({'id': 'way/' + identity, 'kind': category,
                         'name': way['tags'].get('name:en', way['tags'].get('name', '')),
                         'paths': [points]})
    # Assemble complete multipolygon rings, including holes, using OSM node IDs.
    for identity, relation in relations.items():
        category = kind(relation['tags'])
        if category not in {'water', 'green'} or relation['tags'].get('type') != 'multipolygon':
            continue
        rings = []
        complete = True
        for role in ('outer', 'inner'):
            members = [m for m in relation['members'] if m['type'] == 'way' and m.get('role', '') == role]
            if any(m['ref'] not in ways for m in members):
                complete = False
                break
            pieces = [list(ways[m['ref']]['nodes']) for m in members]
            while pieces:
                ring = pieces.pop()
                while ring[0] != ring[-1]:
                    found = False
                    for i, piece in enumerate(pieces):
                        if ring[-1] == piece[0] or ring[-1] == piece[-1]:
                            if ring[-1] == piece[-1]:
                                piece = list(reversed(piece))
                            ring.extend(piece[1:])
                            pieces.pop(i)
                            found = True
                            break
                    if not found:
                        complete = False
                        break
                points = coordinates(ring)
                if not points:
                    complete = False
                else:
                    rings.append(points)
        if complete and rings:
            features.append({'id': 'relation/' + identity, 'kind': category,
                             'name': relation['tags'].get('name:en', relation['tags'].get('name', '')),
                             'paths': rings})
    places = []
    for identity, node in nodes.items():
        tags = node['tags']
        if tags.get('highway') == 'bus_stop' or tags.get('place') in {'suburb', 'quarter', 'neighbourhood'}:
            name = tags.get('name:en', tags.get('name', ''))
            if name:
                places.append({'id': 'node/' + identity, 'name': name, 'point': node['point']})
    result = {
        'source': 'https://api.openstreetmap.org/api/0.6/map',
        'copyright': '© OpenStreetMap contributors',
        'license': 'https://opendatacommons.org/licenses/odbl/1-0/',
        'bounds': BOUNDS,
        'downloadedAt': datetime.fromtimestamp(max(download_times), timezone.utc).isoformat(),
        'features': sorted(features, key=lambda feature: feature['id']),
        'places': sorted(places, key=lambda place: place['id']),
    }
    output = ROOT / 'apps/web/public/maps/dhaka.json'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'Wrote {len(features)} features and {len(places)} places; {output.stat().st_size} bytes', flush=True)


if __name__ == '__main__':
    build()
