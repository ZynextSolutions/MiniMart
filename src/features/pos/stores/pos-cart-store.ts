import { create } from "zustand";
import {
  calculateCartTotals,
  calculateLine,
  type Discount,
} from "@/lib/services/pos-calculation";
import type { TaxMode } from "@/lib/utils/tax";
import { normalizeTaxRatePercent } from "@/lib/utils/tax";

export interface ProductLookup {
  productId: string;
  variantId: string;
  name: string;
  sku: string;
  sellingPrice: number;
  costPrice?: number;
  taxRateId?: string;
  taxRate: number;
  unit: string;
  imageUrl?: string | null;
  barcode?: string | null;
}

export interface CartItem {
  lineId: string;
  variantId: string;
  productId: string;
  productName: string;
  sku: string;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  taxRateId?: string;
  taxRate: number;
  lineDiscount: Discount | null;
  unit: string;
  imageUrl?: string | null;
}

interface PosCartState {
  items: CartItem[];
  customerId: string | null;
  customerName: string | null;
  couponCode: string | null;
  couponDiscount: number;
  orderDiscount: Discount | null;
  selectedLineId: string | null;
  lastSaleId: string | null;
  taxMode: TaxMode;

  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;

  addItem: (product: ProductLookup, qty?: number) => void;
  updateQty: (lineId: string, qty: number) => void;
  removeItem: (lineId: string) => void;
  applyLineDiscount: (lineId: string, discount: Discount | null) => void;
  applyOrderDiscount: (discount: Discount | null) => void;
  setCoupon: (code: string | null, discount?: number) => void;
  setCustomer: (id: string | null, name?: string | null) => void;
  selectLine: (lineId: string | null) => void;
  setLastSaleId: (id: string | null) => void;
  setTaxMode: (mode: TaxMode) => void;
  clear: () => void;
  loadCart: (data: {
    items: CartItem[];
    customerId?: string | null;
    customerName?: string | null;
    couponCode?: string | null;
    couponDiscount?: number;
    orderDiscount?: Discount | null;
  }) => void;
  getSnapshot: () => object;
}

function recalc(
  state: Pick<PosCartState, "items" | "orderDiscount" | "couponDiscount" | "taxMode">,
) {
  const lineInputs = state.items.map((i) => ({
    unitPrice: i.unitPrice,
    quantity: i.quantity,
    taxRate: i.taxRate,
    lineDiscount: i.lineDiscount,
  }));
  const totals = calculateCartTotals(
    lineInputs,
    state.orderDiscount,
    state.couponDiscount,
    state.taxMode,
  );
  return {
    subtotal: totals.subtotal,
    discountTotal: totals.lineDiscountTotal + totals.orderDiscountAmount + totals.couponDiscount,
    taxTotal: totals.taxTotal,
    grandTotal: totals.grandTotal,
  };
}

function newLineId() {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export const usePosCartStore = create<PosCartState>((set, get) => ({
  items: [],
  customerId: null,
  customerName: null,
  couponCode: null,
  couponDiscount: 0,
  orderDiscount: null,
  selectedLineId: null,
  lastSaleId: null,
  taxMode: "EXCLUSIVE",
  subtotal: 0,
  discountTotal: 0,
  taxTotal: 0,
  grandTotal: 0,

  addItem: (product, qty = 1) => {
    set((state) => {
      const existing = state.items.find((i) => i.variantId === product.variantId);
      let items: CartItem[];

      if (existing) {
        items = state.items.map((i) =>
          i.variantId === product.variantId
            ? { ...i, quantity: i.quantity + qty }
            : i,
        );
      } else {
        items = [
          ...state.items,
          {
            lineId: newLineId(),
            variantId: product.variantId,
            productId: product.productId,
            productName: product.name,
            sku: product.sku,
            unitPrice: product.sellingPrice,
            costPrice: product.costPrice ?? 0,
            quantity: qty,
            taxRateId: product.taxRateId,
            taxRate: normalizeTaxRatePercent(product.taxRate),
            lineDiscount: null,
            unit: product.unit,
            imageUrl: product.imageUrl,
          },
        ];
      }

      const next = { ...state, items };
      return { ...next, ...recalc(next) };
    });
  },

  updateQty: (lineId, qty) => {
    set((state) => {
      const items =
        qty <= 0
          ? state.items.filter((i) => i.lineId !== lineId)
          : state.items.map((i) => (i.lineId === lineId ? { ...i, quantity: qty } : i));
      const next = { ...state, items };
      return { ...next, ...recalc(next) };
    });
  },

  removeItem: (lineId) => {
    set((state) => {
      const items = state.items.filter((i) => i.lineId !== lineId);
      const next = { ...state, items, selectedLineId: null };
      return { ...next, ...recalc(next) };
    });
  },

  applyLineDiscount: (lineId, discount) => {
    set((state) => {
      const items = state.items.map((i) =>
        i.lineId === lineId ? { ...i, lineDiscount: discount } : i,
      );
      const next = { ...state, items };
      return { ...next, ...recalc(next) };
    });
  },

  applyOrderDiscount: (discount) => {
    set((state) => {
      const next = { ...state, orderDiscount: discount };
      return { ...next, ...recalc(next) };
    });
  },

  setCoupon: (code, discount = 0) => {
    set((state) => {
      const next = { ...state, couponCode: code, couponDiscount: discount };
      return { ...next, ...recalc(next) };
    });
  },

  setCustomer: (id, name = null) => {
    set({ customerId: id, customerName: name });
  },

  selectLine: (lineId) => set({ selectedLineId: lineId }),

  setLastSaleId: (id) => set({ lastSaleId: id }),
  setTaxMode: (mode) =>
    set((state) => {
      const next = { ...state, taxMode: mode };
      return { ...next, ...recalc(next) };
    }),

  clear: () =>
    set({
      items: [],
      customerId: null,
      customerName: null,
      couponCode: null,
      couponDiscount: 0,
      orderDiscount: null,
      taxMode: "EXCLUSIVE",
      selectedLineId: null,
      subtotal: 0,
      discountTotal: 0,
      taxTotal: 0,
      grandTotal: 0,
    }),

  loadCart: (data) => {
    set((state) => {
      const next = {
        ...state,
        items: data.items.map((item) => ({
          ...item,
          taxRate: normalizeTaxRatePercent(item.taxRate),
        })),
        customerId: data.customerId ?? null,
        customerName: data.customerName ?? null,
        couponCode: data.couponCode ?? null,
        couponDiscount: data.couponDiscount ?? 0,
        orderDiscount: data.orderDiscount ?? null,
      };
      return { ...next, ...recalc(next) };
    });
  },

  getSnapshot: () => {
    const s = get();
    return {
      items: s.items,
      customerId: s.customerId,
      customerName: s.customerName,
      couponCode: s.couponCode,
      couponDiscount: s.couponDiscount,
      orderDiscount: s.orderDiscount,
    };
  },
}));

export function getLineTotal(item: CartItem, taxMode: TaxMode = "EXCLUSIVE") {
  const calculated = calculateLine(
    {
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      taxRate: item.taxRate,
      lineDiscount: item.lineDiscount,
    },
    taxMode,
  );

  // EXCLUSIVE: show pre-tax line amount and add tax in summary.
  // INCLUSIVE: show original tax-inclusive line amount.
  return taxMode === "INCLUSIVE" ? calculated.lineTotal : calculated.afterDiscount;
}
