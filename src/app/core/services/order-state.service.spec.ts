import { TestBed } from '@angular/core/testing';
import { OrderStateService } from './order-state.service';
describe('OrderStateService', () => {
  let s: OrderStateService;
  beforeEach(() => (s = TestBed.inject(OrderStateService)));
  it('allows pending to placed', () => expect(s.canTransition('PENDING', 'PLACED')).toBe(true));
  it('does not allow placed back to pending', () => expect(s.canTransition('PLACED', 'PENDING')).toBe(false));
  it('counts pending quantity', () =>
    expect(
      s.pendingQuantity([
        { status: 'PENDING', quantity: 2 },
        { status: 'PLACED', quantity: 3 },
      ]),
    ).toBe(2));
});
