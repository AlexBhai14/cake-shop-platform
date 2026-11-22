export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
}

export interface Address {
  id: string;
  label: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

export interface Profile {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  phone: string | null;
}

export interface Slot {
  date: string;
  slot: string;
  capacity: number;
  booked: number;
  available: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export type OrderStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'ACCEPTED'
  | 'PREPARING'
  | 'READY_FOR_DISPATCH'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'PAYMENT_FAILED'
  | 'CANCELLED';

export interface OrderItem {
  id: string;
  variantId: string;
  cakeName: string;
  flavour: string;
  weightGrams: number;
  eggless: boolean;
  unitPrice: string;
  quantity: number;
  message: string | null;
}

export interface HistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string;
  note: string | null;
  createdAt: string;
}
