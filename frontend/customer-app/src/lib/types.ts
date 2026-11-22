export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
}

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
  category?: Category;
  variants: Variant[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CartLine {
  id: string;
  variantId: string;
  quantity: number;
  message: string | null;
  cakeName: string;
  flavour: string | null;
  weightGrams: number | null;
  eggless: boolean | null;
  unitPrice: string;
  lineTotal: string;
  available: boolean;
}

export interface CartView {
  items: CartLine[];
  subtotal: string;
  currency: string;
  hasUnavailableItems: boolean;
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

export type AddressInput = {
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  isDefault?: boolean;
};

export interface Profile {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  phone: string | null;
  addresses: Address[];
}

export interface Slot {
  date: string;
  slot: string;
  capacity: number;
  booked: number;
  available: number;
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

export interface Order {
  id: string;
  userId: string;
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

export interface PaymentTx {
  id: string;
  type: 'CHARGE' | 'REFUND';
  amount: string;
  status: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  orderId: string;
  status: string;
  amount: string;
  currency: string;
  transactions: PaymentTx[];
  notice: string;
}

export type Scenario = 'SUCCESS' | 'FAILURE' | 'TIMEOUT';

export interface Wallet {
  balance: string;
  currency: string;
  notice: string;
}

export interface WalletTx {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  amount: string;
  balanceAfter: string;
  orderId: string | null;
  reason: string | null;
  createdAt: string;
}
