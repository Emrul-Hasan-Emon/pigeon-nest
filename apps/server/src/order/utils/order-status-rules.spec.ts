import { describe, expect, it } from 'vitest';
import { AuthUserType } from '../../database/enums/auth-user-type.enum';
import { OrderStatus } from '../../database/enums/order-status.enum';
import { allowedTargets, transitionDenied } from './order-status-rules';

const { ADMIN, SELLER, USER } = AuthUserType;
const { PENDING, CONFIRMED, CANCELLED, PACKED, SHIPPED, DELIVERED } = OrderStatus;

describe('order status rules', () => {
  it('lets a customer cancel only while pending', () => {
    expect(transitionDenied(USER, PENDING, CANCELLED)).toBeNull();
    for (const from of [CONFIRMED, PACKED, SHIPPED, DELIVERED]) {
      expect(transitionDenied(USER, from, CANCELLED)).not.toBeNull();
    }
    expect(transitionDenied(USER, PENDING, CONFIRMED)).not.toBeNull();
  });

  it('lets a seller confirm or cancel a pending order', () => {
    expect(transitionDenied(SELLER, PENDING, CONFIRMED)).toBeNull();
    expect(transitionDenied(SELLER, PENDING, CANCELLED)).toBeNull();
  });

  it('moves a confirmed order forward one step at a time', () => {
    expect(transitionDenied(SELLER, CONFIRMED, PACKED)).toBeNull();
    expect(transitionDenied(SELLER, PACKED, SHIPPED)).toBeNull();
    expect(transitionDenied(SELLER, SHIPPED, DELIVERED)).toBeNull();
    expect(transitionDenied(SELLER, CONFIRMED, SHIPPED)).not.toBeNull();
    expect(transitionDenied(SELLER, PENDING, PACKED)).not.toBeNull();
    expect(transitionDenied(SELLER, PACKED, CONFIRMED)).not.toBeNull();
  });

  it('stops a seller cancelling or reopening after confirmation', () => {
    for (const from of [CONFIRMED, PACKED, SHIPPED, DELIVERED]) {
      expect(transitionDenied(SELLER, from, CANCELLED)).toContain('admin');
    }
    expect(transitionDenied(SELLER, CANCELLED, PENDING)).toContain('admin');
    expect(transitionDenied(SELLER, DELIVERED, SHIPPED)).not.toBeNull();
  });

  it('lets an admin move an order to any other status', () => {
    for (const from of Object.values(OrderStatus)) {
      for (const to of Object.values(OrderStatus)) {
        expect(transitionDenied(ADMIN, from, to) === null).toBe(from !== to);
      }
    }
  });

  it('refuses a move to the same status for everyone', () => {
    for (const who of [ADMIN, SELLER, USER]) {
      expect(transitionDenied(who, PENDING, PENDING)).toContain('already');
    }
  });

  it('lists what each role may do next', () => {
    expect(allowedTargets(USER, PENDING)).toEqual([CANCELLED]);
    expect(allowedTargets(USER, CONFIRMED)).toEqual([]);
    expect(allowedTargets(SELLER, PENDING).sort()).toEqual([CANCELLED, CONFIRMED].sort());
    expect(allowedTargets(SELLER, CONFIRMED)).toEqual([PACKED]);
    expect(allowedTargets(SELLER, DELIVERED)).toEqual([]);
    expect(allowedTargets(ADMIN, DELIVERED)).toHaveLength(5);
  });
});
