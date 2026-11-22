import { api } from '../lib/api';
import {
  Address,
  AddressInput,
  Cake,
  CartView,
  Category,
  Order,
  Page,
  Payment,
  Profile,
  Scenario,
  Slot,
  Wallet,
  WalletTx,
} from '../lib/types';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
}

// _skipRefresh: a 401 here means "wrong password", not "token expired"
const noRefresh = { _skipRefresh: true } as object;

export const authApi = {
  register: (email: string, password: string) => api.post('/auth/register', { email, password }, noRefresh),
  login: async (email: string, password: string) =>
    (await api.post<TokenPair>('/auth/login', { email, password }, noRefresh)).data,
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }, noRefresh),
};

export interface CakeQuery {
  search?: string;
  categoryId?: string;
  eggless?: boolean;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  limit?: number;
}

export const catalogApi = {
  categories: async () => (await api.get<Category[]>('/categories')).data,
  cakes: async (params: CakeQuery) => (await api.get<Page<Cake>>('/cakes', { params })).data,
  cake: async (id: string) => (await api.get<Cake>(`/cakes/${id}`)).data,
};

export const cartApi = {
  get: async () => (await api.get<CartView>('/cart')).data,
  add: async (variantId: string, quantity: number, message?: string) =>
    (await api.post<CartView>('/cart/items', { variantId, quantity, message: message || undefined })).data,
  setQuantity: async (itemId: string, quantity: number) =>
    (await api.patch<CartView>(`/cart/items/${itemId}`, { quantity })).data,
  remove: async (itemId: string) => (await api.delete<CartView>(`/cart/items/${itemId}`)).data,
  clear: async () => (await api.delete<CartView>('/cart')).data,
};

export const usersApi = {
  me: async () => (await api.get<Profile>('/users/me')).data,
  update: async (data: { fullName?: string; phone?: string }) => (await api.patch<Profile>('/users/me', data)).data,
  addresses: async () => (await api.get<Address[]>('/users/me/addresses')).data,
  addAddress: async (data: AddressInput) => (await api.post<Address>('/users/me/addresses', data)).data,
  updateAddress: async (id: string, data: Partial<AddressInput>) =>
    (await api.patch<Address>(`/users/me/addresses/${id}`, data)).data,
  setDefault: async (id: string) => (await api.patch<Address>(`/users/me/addresses/${id}/default`)).data,
  deleteAddress: async (id: string) => (await api.delete(`/users/me/addresses/${id}`)).data,
};

export const inventoryApi = {
  slots: async (date: string) => (await api.get<Slot[]>('/inventory/slots', { params: { date } })).data,
};

export interface CheckoutInput {
  addressId: string;
  deliveryDate: string;
  deliverySlot: string;
}

export const ordersApi = {
  checkout: async (data: CheckoutInput, idempotencyKey: string) =>
    (await api.post<Order>('/orders/checkout', data, { headers: { 'Idempotency-Key': idempotencyKey } })).data,
  list: async () => (await api.get<Order[]>('/orders')).data,
  get: async (id: string) => (await api.get<Order>(`/orders/${id}`)).data,
  cancel: async (id: string) => (await api.post<Order>(`/orders/${id}/cancel`)).data,
};

export const paymentsApi = {
  get: async (orderId: string) => (await api.get<Payment>(`/payments/orders/${orderId}`)).data,
  pay: async (orderId: string, scenario: Scenario) =>
    (await api.post<Payment>(`/payments/orders/${orderId}/pay`, { scenario })).data,
};

export const walletApi = {
  get: async () => (await api.get<Wallet>('/payments/wallet')).data,
  transactions: async (page = 1, limit = 20) =>
    (await api.get<Page<WalletTx>>('/payments/wallet/transactions', { params: { page, limit } })).data,
};
