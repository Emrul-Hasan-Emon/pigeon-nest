import { http, sellerHttp, userHttp } from './http';
import { ENDPOINTS } from '../endpoints';
import type { AddressInput, AddressView } from '@/types/address';

export type AddressOwner =
  | { kind: 'me' }
  | { kind: 'user'; userId: number }
  /** A seller entering an order: can read and add to a customer's address book, nothing more. */
  | { kind: 'sellerCustomer'; userId: number };

/** A customer's address book: their own (`me`), or an admin managing a customer's. */
export function addressApi(owner: AddressOwner) {
  if (owner.kind === 'me') {
    const e = ENDPOINTS.user.addresses;
    return {
      list: () => userHttp.get<{ results: AddressView[] }>(e.list).then((r) => r.results),
      create: (input: AddressInput) => userHttp.post<AddressView>(e.list, input),
      update: (id: number, input: Partial<AddressInput>) => userHttp.patch<AddressView>(e.detail(id), input),
      remove: (id: number) => userHttp.delete<void>(e.detail(id)),
    };
  }
  if (owner.kind === 'sellerCustomer') {
    const path = ENDPOINTS.seller.orders.customerAddresses(owner.userId);
    const refuse = () => Promise.reject(new Error('A seller can only add addresses while entering an order.'));
    return {
      list: () => sellerHttp.get<{ results: AddressView[] }>(path).then((r) => r.results),
      create: (input: AddressInput) => sellerHttp.post<AddressView>(path, input),
      update: (_id: number, _input: Partial<AddressInput>): Promise<AddressView> => refuse(),
      remove: (_id: number): Promise<void> => refuse(),
    };
  }
  const e = ENDPOINTS.admin.users;
  return {
    list: () => http.get<{ results: AddressView[] }>(e.addresses(owner.userId)).then((r) => r.results),
    create: (input: AddressInput) => http.post<AddressView>(e.addresses(owner.userId), input),
    update: (id: number, input: Partial<AddressInput>) => http.patch<AddressView>(e.address(owner.userId, id), input),
    remove: (id: number) => http.delete<void>(e.address(owner.userId, id)),
  };
}
