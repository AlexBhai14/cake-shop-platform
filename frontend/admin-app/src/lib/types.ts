export type { Address, Category, HistoryEntry, OrderItem, OrderStatus, Page, Profile, Slot } from './shared-types';
import type { Address, HistoryEntry, OrderItem, OrderStatus } from './shared-types';

export interface Variant {
  id: string;
  cakeId: string;
  flavour: string;
  weightGrams: number;
  eggless: boolean;
  price: string;
  isActive: boolean;
}

export interface Cake {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  isActive: boolean;
  categoryId: string;
  category?: { id: string; name: string };
  variants: Variant[];
}

export interface VariantInput {
  flavour: string;
  weightGrams: number;
  eggless: boolean;
  price: number;
}

export interface AdminOrder {
  id: string;
  userId: string;
  customerEmail: string | null;
  status: OrderStatus;
  totalAmount: string;
  currency: string;
  deliveryDate: string;
  deliverySlot: string;
  deliveryAddress: Partial<Address>;
  cancelReason: string | null;
  paymentId: string | null;
  createdAt: string;
  items: OrderItem[];
  history?: HistoryEntry[];
}

export interface AdminUser {
  id: string;
  email: string;
  role: 'CUSTOMER' | 'ADMIN';
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
}

export interface StockItem {
  id: string;
  variantId: string;
  onHand: number;
  reserved: number;
  available: number;
}

export interface StockMovement {
  id: string;
  onHandDelta: number;
  reservedDelta: number;
  reason: string;
  orderId: string | null;
  createdAt: string;
}

export interface SlotRow {
  date: string;
  slot: string;
  capacity: number;
  booked: number;
  available: number;
}

export interface DayBucket {
  date: string;
  orders: number;
  revenue: string;
}

export interface Stats {
  totalOrders: number;
  revenue: string;
  currency: string;
  statusCounts: Record<string, number>;
  daily: DayBucket[];
  topCakes: Array<{ cakeName: string; quantity: number }>;
}

export interface PaymentTx {
  id: string;
  type: 'CHARGE' | 'REFUND';
  amount: string;
  status: string;
  createdAt: string;
}

export interface AdminPayment {
  id: string;
  orderId: string;
  userId: string;
  customerEmail: string | null;
  status: string;
  amount: string;
  currency: string;
  createdAt: string;
  transactions?: PaymentTx[];
  notice?: string;
}

export interface NotificationRow {
  id: string;
  orderId: string | null;
  type: string;
  subject: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  toEmail: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}
