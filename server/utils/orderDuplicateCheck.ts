export type OrderLike = {
  status?: string;
  productName?: string;
  phoneNumber?: string;
};

export function hasActiveProcessingConflict(existingOrders: OrderLike[]) {
  return existingOrders.some((order) => (order.status || "").toLowerCase() === "processing");
}
