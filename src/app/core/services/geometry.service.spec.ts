import { TestBed } from '@angular/core/testing';
import { GeometryService } from './geometry.service';
describe('GeometryService', () => {
  let service: GeometryService;
  beforeEach(() => {
    service = TestBed.inject(GeometryService);
  });
  it('simplifies a nearly straight path', () => {
    const out = service.simplify(
      [
        { x: 0, y: 0 },
        { x: 50, y: 2 },
        { x: 100, y: 0 },
      ],
      5,
    );
    expect(out.length).toBe(2);
  });
  it('converts a polyline into deterministic segments', () => {
    const out = service.toSegments([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
    expect(out.length).toBe(2);
    expect(out[0].points).toEqual([0, 0, 100, 0]);
  });
});
