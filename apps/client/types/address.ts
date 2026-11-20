export interface AddressView {
  id: number;
  userId: number;
  type: 'shipping' | 'billing';
  recipientName: string;
  phone: string;
  countryCode: string;
  countryName: string;
  /** State, province or division. */
  state: string | null;
  /** City or district. */
  city: string;
  /** The full address in words. */
  address: string;
  zipCode: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddressInput {
  recipientName: string;
  phone: string;
  countryCode: string;
  state?: string | null;
  city: string;
  address: string;
  zipCode?: string | null;
  isDefault?: boolean;
}
