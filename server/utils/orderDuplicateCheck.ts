export type OrderLike = {
  status?: string;
  productName?: string;
  phoneNumber?: string;
};

export function hasActiveProcessingConflict(existingOrders: OrderLike[]) {
  void existingOrders;
  return false;
}
