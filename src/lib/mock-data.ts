import type { CartItem, DataPackage } from "./types";

/**
 * Package catalogs for network data bundles.
 * These are static reference data for available packages.
 */

export const MTN_PACKAGES: DataPackage[] = [
  { id: "mtn-1gb", name: "1GB Bundle", size: "1GB", price: 4.0, validity: "90 Days", network: "MTN" },
  { id: "mtn-2gb", name: "2GB Bundle", size: "2GB", price: 8.0, validity: "90 Days", network: "MTN" },
  { id: "mtn-3gb", name: "3GB Bundle", size: "3GB", price: 12.0, validity: "90 Days", network: "MTN" },
  { id: "mtn-5gb", name: "5GB Bundle", size: "5GB", price: 19.5, validity: "90 Days", network: "MTN" },
  { id: "mtn-6gb", name: "6GB Bundle", size: "6GB", price: 23.0, validity: "90 Days", network: "MTN" },
  { id: "mtn-10gb", name: "10GB Bundle", size: "10GB", price: 38.0, validity: "90 Days", network: "MTN" },
  { id: "mtn-15gb", name: "15GB Bundle", size: "15GB", price: 55.0, validity: "90 Days", network: "MTN" },
  { id: "mtn-20gb", name: "20GB Bundle", size: "20GB", price: 72.0, validity: "90 Days", network: "MTN" },
  { id: "mtn-25gb", name: "25GB Bundle", size: "25GB", price: 88.0, validity: "90 Days", network: "MTN" },
  { id: "mtn-30gb", name: "30GB Bundle", size: "30GB", price: 105.0, validity: "90 Days", network: "MTN" },
  { id: "mtn-40gb", name: "40GB Bundle", size: "40GB", price: 135.0, validity: "90 Days", network: "MTN" },
  { id: "mtn-50gb", name: "50GB Bundle", size: "50GB", price: 165.0, validity: "90 Days", network: "MTN" },
  { id: "mtn-100gb", name: "100GB Bundle", size: "100GB", price: 310.0, validity: "90 Days", network: "MTN" },
  { id: "mtn-150gb", name: "150GB Bundle", size: "150GB", price: 450.0, validity: "90 Days", network: "MTN" },
  { id: "mtn-200gb", name: "200GB Bundle", size: "200GB", price: 580.0, validity: "90 Days", network: "MTN" },
];

export const AT_PACKAGES: DataPackage[] = [
  { id: "at-1gb", name: "1GB Bundle", size: "1GB", price: 4.5, validity: "60 Days", network: "AirtelTigo" },
  { id: "at-2gb", name: "2GB Bundle", size: "2GB", price: 8.5, validity: "60 Days", network: "AirtelTigo" },
  { id: "at-3gb", name: "3GB Bundle", size: "3GB", price: 12.5, validity: "60 Days", network: "AirtelTigo" },
  { id: "at-5gb", name: "5GB Bundle", size: "5GB", price: 20.0, validity: "60 Days", network: "AirtelTigo" },
  { id: "at-10gb", name: "10GB Bundle", size: "10GB", price: 39.0, validity: "60 Days", network: "AirtelTigo" },
  { id: "at-15gb", name: "15GB Bundle", size: "15GB", price: 56.0, validity: "60 Days", network: "AirtelTigo" },
  { id: "at-20gb", name: "20GB Bundle", size: "20GB", price: 74.0, validity: "60 Days", network: "AirtelTigo" },
  { id: "at-30gb", name: "30GB Bundle", size: "30GB", price: 108.0, validity: "60 Days", network: "AirtelTigo" },
];

export const TELECEL_PACKAGES: DataPackage[] = [
  { id: "tc-1gb", name: "1GB Bundle", size: "1GB", price: 4.2, validity: "60 Days", network: "Telecel" },
  { id: "tc-2gb", name: "2GB Bundle", size: "2GB", price: 8.2, validity: "60 Days", network: "Telecel" },
  { id: "tc-3gb", name: "3GB Bundle", size: "3GB", price: 12.2, validity: "60 Days", network: "Telecel" },
  { id: "tc-5gb", name: "5GB Bundle", size: "5GB", price: 19.8, validity: "60 Days", network: "Telecel" },
  { id: "tc-10gb", name: "10GB Bundle", size: "10GB", price: 38.5, validity: "60 Days", network: "Telecel" },
  { id: "tc-20gb", name: "20GB Bundle", size: "20GB", price: 73.0, validity: "60 Days", network: "Telecel" },
  { id: "tc-30gb", name: "30GB Bundle", size: "30GB", price: 106.0, validity: "60 Days", network: "Telecel" },
];


export const TOP_PACKAGES = [
  { name: "MTN 3GB", sales: 48, price: 12 },
  { name: "MTN 6GB", sales: 36, price: 23 },
  { name: "AT 10GB", sales: 22, price: 39 },
  { name: "Telecel 5GB", sales: 18, price: 19.8 },
];

export const EMPTY_CART: CartItem[] = [];

/**
 * Utility functions for formatting monetary values.
 */

export function formatGHS(amount: number) {
  return `GHS ${amount.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatCedi(amount: number) {
  return `₵${amount.toLocaleString("en-GH", {
    minimumFractionDigits: amount >= 1000 ? 2 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function greetingForHour(hour = new Date().getHours()) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

