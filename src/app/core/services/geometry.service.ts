import { Injectable } from '@angular/core';
export interface Point {
  x: number;
  y: number;
}
export interface Segment {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  points: number[];
}
@Injectable({ providedIn: 'root' })
export class GeometryService {
  simplify(points: Point[], tolerance = 12): Point[] {
    if (points.length < 3) return points;
    const out = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
      const a = out[out.length - 1],
        b = points[i],
        c = points[i + 1];
      const area = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x));
      const base = Math.hypot(c.x - a.x, c.y - a.y) || 1;
      if (area / base >= tolerance) out.push(b);
    }
    out.push(points[points.length - 1]);
    return out;
  }
  snapOrthogonal(points: Point[], angleTolerance = 18): Point[] {
    return points.map((p, i) => {
      if (i === 0 || i === points.length - 1) return p;
      const prev = points[i - 1],
        next = points[i + 1];
      const dx = next.x - prev.x,
        dy = next.y - prev.y;
      const angle = Math.abs((Math.atan2(dy, dx) * 180) / Math.PI);
      if (Math.min(angle, 180 - angle) < angleTolerance || Math.abs(angle - 180) < angleTolerance)
        return { x: p.x, y: (prev.y + next.y) / 2 };
      if (Math.abs(angle - 90) < angleTolerance) return { x: (prev.x + next.x) / 2, y: p.y };
      return p;
    });
  }
  toSegments(points: Point[]): Segment[] {
    const clean = this.simplify(this.snapOrthogonal(points));
    const segs: Segment[] = [];
    for (let i = 1; i < clean.length; i++) {
      const a = clean[i - 1],
        b = clean[i];
      const dx = b.x - a.x,
        dy = b.y - a.y;
      segs.push({
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.max(Math.abs(dx), 4),
        height: Math.max(Math.abs(dy), 4),
        rotation: 0,
        points: [a.x, a.y, b.x, b.y],
      });
    }
    return segs;
  }
}
