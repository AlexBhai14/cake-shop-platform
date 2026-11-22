import { api } from '../lib/api';
import {
  AdminOrder, AdminPayment, AdminUser, Cake, SlotRow, Stats, StockItem, StockMovement, VariantInput,
} from '../lib/types';
import { Category, OrderStatus, Page, Profile } from '../lib/shared-types';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

// _skipRefresh: a 401 here means "wrong password", not "token expired"
const noRefresh = { _skipRefresh: true } as object;

export const authApi = {
  login: async (email: string, password: string) =>
    (await api.post<TokenPair>('/auth/login', { email, password }, noRefresh)).data,
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }, noRefresh),
  users: async (page: number, limit = 100) =>
    (await api.get<Page<AdminUser>>('/auth/admin/users', { params: { page, limit } })).data,
  setStatus: async (id: string, status: 'ACTIVE' | 'SUSPENDED') =>
    (await api.patch(`/auth/admin/users/${id}/status`, { status })).data,
};

export const usersApi = {
  profiles: async (page: number, limit = 100) =>
    (await api.get<Page<Profile>>('/users', { params: { page, limit } })).data,
};

export const catalogApi = {
  categories: async () => (await api.get<Category[]>('/categories/admin/all')).data,
  createCategory: async (data: { name: string; description?: string }) => (await api.post<Category>('/categories', data)).data,
  updateCategory: async (id: string, data: { name?: string; description?: string; isActive?: boolean }) =>
    (await api.patch<Category>(`/categories/${id}`, data)).data,
  cakes: async (page: number, limit = 100) =>
    (await api.get<Page<Cake>>('/cakes/admin/all', { params: { page, limit } })).data,
  createCake: async (data: { name: string; description: string; categoryId: string; imageUrl?: string; discountPercent?: number; variants: VariantInput[] }) =>
    (await api.post<Cake>('/cakes', data)).data,
  updateCake: async (id: string, data: { name?: string; description?: string; categoryId?: string; imageUrl?: string; discountPercent?: number; isActive?: boolean }) =>
    (await api.patch<Cake>(`/cakes/${id}`, data)).data,
  addVariant: async (cakeId: string, data: VariantInput) => (await api.post(`/cakes/${cakeId}/variants`, data)).data,
  updateVariant: async (id: string, data: { price?: number; isActive?: boolean }) =>
    (await api.patch(`/variants/${id}`, data)).data,
};

export const inventoryApi = {
  items: async (page: number, limit = 100) =>
    (await api.get<Page<StockItem>>('/inventory/items', { params: { page, limit } })).data,
  setStock: async (variantId: string, onHand: number) => (await api.put(`/inventory/items/${variantId}`, { onHand })).data,
  adjust: async (variantId: string, delta: number, reason: string) =>
    (await api.post(`/inventory/items/${variantId}/adjustments`, { delta, reason })).data,
  history: async (variantId: string) => (await api.get<StockMovement[]>(`/inventory/items/${variantId}/history`)).data,
  slots: async (date: string) => (await api.get<SlotRow[]>('/inventory/slots', { params: { date } })).data,
  setSlot: async (date: string, slot: string, capacity: number) =>
    (await api.put('/inventory/slots', { date, slot, capacity })).data,
};

export const ordersApi = {
  list: async (params: { status?: string; page?: number; limit?: number }) =>
    (await api.get<Page<AdminOrder>>('/orders/admin/all', { params })).data,
  get: async (id: string) => (await api.get<AdminOrder>(`/orders/${id}`)).data,
  setStatus: async (id: string, status: OrderStatus) => (await api.patch<AdminOrder>(`/orders/${id}/status`, { status })).data,
  cancel: async (id: string) => (await api.post<AdminOrder>(`/orders/${id}/cancel`)).data,
  stats: async (days: number) => (await api.get<Stats>('/orders/admin/stats', { params: { days } })).data,
};

export const paymentsApi = {
  list: async (page: number, limit = 20) =>
    (await api.get<Page<AdminPayment> & { notice: string }>('/payments/admin/all', { params: { page, limit } })).data,
  get: async (orderId: string) => (await api.get<AdminPayment>(`/payments/orders/${orderId}`)).data,
  refund: async (orderId: string) => (await api.post<AdminPayment>(`/payments/orders/${orderId}/refund`)).data,
};
