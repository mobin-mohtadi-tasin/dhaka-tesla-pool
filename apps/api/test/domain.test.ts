import { describe, expect, it } from 'vitest';
import { canTransition, fareFor, routeFor } from '../src/domain';

describe('deterministic route and fare rules', () => {
  it('matches Nusrat and Rafiq to the same corridor', () => {
    expect(routeFor('BANANI', 'MOHAKHALI')?.corridor).toBe('CORRIDOR_BANANI_SOUTH');
    expect(routeFor('BANANI', 'GULSHAN_1')?.corridor).toBe('CORRIDOR_BANANI_SOUTH');
    expect(routeFor('MOHAKHALI', 'BANANI')?.corridor).not.toBe('CORRIDOR_BANANI_SOUTH');
    expect(routeFor('BANANI', 'BANANI')).toBeNull();
  });

  it('calculates each passenger fare using integer poysha', () => {
    expect(fareFor('BANANI', 'MOHAKHALI', 1, false).totalFarePoysha).toBe(2500);
    expect(fareFor('BANANI', 'MOHAKHALI', 1, true).totalFarePoysha).toBe(2000);
    expect(fareFor('BANANI', 'GULSHAN_1', 1, true).totalFarePoysha).toBe(2160);
  });

  it('rejects skipped ride transitions and late cancellation', () => {
    expect(canTransition('REQUESTED', 'STARTED')).toBe(false);
    expect(canTransition('MATCHED', 'CANCELLED')).toBe(true);
    expect(canTransition('DRIVER_ARRIVED', 'CANCELLED')).toBe(false);
    expect(canTransition('COMPLETED', 'STARTED')).toBe(false);
  });
});
