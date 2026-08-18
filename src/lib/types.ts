export type UserRole = "dealer" | "agent" | "user" | "admin";

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  whatsapp?: string;
  momo?: string;
  password?: string;
  role: UserRole;
  network: string;
  status: "approved" | "pending" | "rejected";
  emailVerified: boolean;
  emailVerificationToken?: string;
  phoneVerified: boolean;
  walletBalance: number;
  commissionEarned: number;
  referralCode: string;
  totalReferrals: number;
  referredBy?: string;
  initials: string;
  createdAt?: string;
}

export interface DataPackage {
  id: string;
  name: string;
  size: string;
  price: number;
  userPrice?: number;
  agentPrice?: number;
  accountPrice?: number | null;
  validity: string;
  network: "MTN" | "AirtelTigo" | "Telecel";
}

export interface Order {
  id: string;
  size: string;
  recipient: string;
  network: "MTN" | "AirtelTigo" | "Telecel";
  status: "Pending" | "Processing" | "Completed" | "Failed" | "Cancelled" | "Canceled" | "Refunded";
  source: "web" | "api";
  paid: boolean;
  amount: number;
  balBefore: number;
  balAfter: number;
  date: string;
  userId?: string;
  packageName?: string;
}

export interface Deposit {
  id: string;
  userId?: string;
  amount: number;
  method: string;
  platform: string;
  reference: string;
  status: "Credited" | "Pending" | "Failed";
  balBefore: number;
  balAfter: number;
  handledBy: string;
  date: string;
}

export interface Refund {
  id: string;
  orderId: string;
  userId?: string;
  recipient: string;
  bundle: string;
  amount: number;
  method: string;
  status: "Refunded";
  balBefore: number;
  balAfter: number;
  source: "web" | "api";
  date: string;
}

export interface CartItem {
  id: string;
  network: string;
  packageName: string;
  size: string;
  price: number;
  recipient: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
}
