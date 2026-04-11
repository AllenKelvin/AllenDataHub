const API_KEY = process.env.PORTAL02_API_KEY || "dk_WZqU3-BTai3q4IuEoOXqc6IHVfGkAmaH";
const BASE_URL = process.env.PORTAL02_BASE_URL || "https://www.portal-02.com/api/v1";
const BACKEND_URL = process.env.BACKEND_URL || process.env.VITE_API_URL || "http://localhost:5000";

const offerSlugs: Record<string, string> = {
  MTN: "master_beneficiary_data_bundle",
  Telecel: "telecel_expiry_bundle",
  AirtelTigo: "ishare_data_bundle",
};

const availableVolumes: Record<string, number[]> = {
  MTN: [1, 2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30, 40, 50, 100],
  Telecel: [5, 10, 15, 20, 25, 30, 40, 50, 100],
  AirtelTigo: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 20],
};

const networkToEndpoint: Record<string, string> = {
  MTN: "mtn",
  Telecel: "telecel",
  AirtelTigo: "at",
};

function formatPhoneNumber(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.startsWith("0") && cleaned.length === 10) cleaned = "233" + cleaned.substring(1);
  else if (cleaned.startsWith("+233")) cleaned = cleaned.substring(1);
  else if (cleaned.length === 9) cleaned = "233" + cleaned;
  return cleaned;
}

function extractVolumeNumber(size: string | number): number {
  if (typeof size === "number") return size;
  const match = String(size).match(/(\d+(\.\d+)?)/);
  return match ? parseInt(match[1], 10) : 0;
}

function isVolumeAvailable(network: string, volume: number): boolean {
  const volumes = availableVolumes[network];
  return volumes ? volumes.includes(volume) : false;
}

function getOfferSlug(network: string): string {
  const slug = offerSlugs[network];
  if (!slug) throw new Error(`No offer slug found for network: ${network}`);
  return slug;
}

function mapNetworkToEndpoint(network: string): string {
  return networkToEndpoint[network] || network.toLowerCase();
}

class Portal02Service {
  constructor() {
    console.log(`[Portal02] Initialized. Base: ${BASE_URL}, Webhook: ${BACKEND_URL}/api/webhooks/portal02`);
  }

  async purchaseDataBundle(
    phoneNumber: string,
    bundleSize: string | number,
    network: string,
    orderReference?: string | null
  ) {
    const formattedPhone = formatPhoneNumber(phoneNumber);
    const volume = extractVolumeNumber(bundleSize);
    if (volume <= 0) return { success: false, error: "Invalid bundle size" };
    if (!isVolumeAvailable(network, volume)) {
      return { success: false, error: `${volume}GB not available for ${network}` };
    }

    const offerSlug = getOfferSlug(network);
    const webhookUrl = `${BACKEND_URL}/api/webhooks/portal02`;
    const payload: Record<string, unknown> = {
      type: "single",
      volume,
      phone: formattedPhone,
      offerSlug,
      webhookUrl,
    };
    if (orderReference) payload.reference = orderReference;

    const endpoint = mapNetworkToEndpoint(network);
    const url = `${BASE_URL}/order/${endpoint}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "x-api-key": API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = data.message || data.error || `HTTP ${response.status}`;
        return { success: false, platform: "Portal-02.com", error: msg, code: response.status, details: data };
      }
      return {
        success: true,
        transactionId: data.orderId || data.id,
        reference: data.reference || data.orderId,
        status: data.status || "pending",
        message: "Order submitted to Portal-02",
        amount: data.totalAmount,
        currency: data.currency,
        raw: data,
      };
    } catch (error: any) {
      return {
        success: false,
        platform: "Portal-02.com",
        error: error?.message || "Network error",
        code: 500,
        details: null,
      };
    }
  }



  processWebhookPayload(payload: any) {
    const root = payload?.data && typeof payload.data === "object" ? payload.data : payload;
    const event =
      root?.event ||
      root?.event_type ||
      payload?.event ||
      payload?.event_type ||
      payload?.type;
    if (
      event !== "order.status.updated" &&
      event !== "order.status_update" &&
      event !== "order.updated" &&
      event !== "status.updated"
    ) {
      return { success: false, error: `Unknown event: ${event}` };
    }
    const orderId = root?.orderId || root?.order_id || root?.id || payload?.orderId || payload?.order_id || payload?.id;
    const reference =
      root?.reference ||
      root?.clientReference ||
      payload?.reference ||
      payload?.clientReference ||
      orderId;
    const status = root?.status ?? payload?.status;
    const validStatuses = ["pending", "processing", "delivered", "failed", "cancelled", "refunded", "resolved"];
    if (!validStatuses.includes(status)) {
      return { success: false, error: `Invalid status: ${status}` };
    }
    const tsRaw = root?.timestamp ?? root?.updatedAt ?? payload?.timestamp;
    return {
      success: true,
      event,
      orderId,
      reference,
      status,
      recipient: root?.recipient ?? payload?.recipient,
      volume: root?.volume ?? payload?.volume,
      timestamp: tsRaw ? new Date(tsRaw) : new Date(),
    };
  }
}

export const portal02Service = new Portal02Service();
export default portal02Service;
