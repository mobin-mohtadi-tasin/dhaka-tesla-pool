export type Coordinate = readonly [longitude: number, latitude: number];
export type Point = { x: number; y: number };
export type View = Point & { scale: number };
export type Extent = { left: number; top: number; right: number; bottom: number };

const EARTH_RADIUS = 6378137;
const ORIGIN_LONGITUDE = 90.39;
const ORIGIN_LATITUDE = 23.8;
const radians = (degrees: number) => degrees * Math.PI / 180;
const mercatorY = (latitude: number) => EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + radians(latitude) / 2));

/** Local Web Mercator metres, with north pointing upward on screen. */
export function project([longitude, latitude]: Coordinate): Point {
  return {
    x: EARTH_RADIUS * radians(longitude - ORIGIN_LONGITUDE),
    y: mercatorY(ORIGIN_LATITUDE) - mercatorY(Math.max(-85, Math.min(85, latitude))),
  };
}

export function toScreen(point: Point, view: View, width: number, height: number): Point {
  return { x: (point.x - view.x) / view.scale + width / 2, y: (point.y - view.y) / view.scale + height / 2 };
}

export function fitPoints(points: Point[], width: number, height: number): View {
  const left = Math.min(...points.map((point) => point.x));
  const right = Math.max(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const bottom = Math.max(...points.map((point) => point.y));
  return {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
    scale: Math.max((right - left) / Math.max(100, width - 140), (bottom - top) / Math.max(100, height - 180), 2.5),
  };
}

/** Keep panning near the bundled extract and zooming within useful bounds. */
export function constrainView(view: View, extent: Extent, width: number, height: number): View {
  const maximum = Math.max((extent.right - extent.left) / width, (extent.bottom - extent.top) / height) * 1.15;
  const scale = Math.max(0.5, Math.min(maximum, view.scale));
  const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
  return {
    x: clamp(view.x, extent.left, extent.right),
    y: clamp(view.y, extent.top, extent.bottom),
    scale,
  };
}

export function pathFor(points: Coordinate[], close = false): string {
  return points.map((coordinate, i) => {
    const { x, y } = project(coordinate);
    return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + (close ? ' Z' : '');
}
