import { isAddress } from "viem";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "./lendaswap";

const STORAGE_KEY = "crypto_card_config";

export type CardConfig = {
  label?: string;
  destinationAddress: `0x${string}`;
  chainId: number;
  currency: SupportedCurrency;
};

export function loadCardConfig(): CardConfig | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CardConfig>;
    if (
      !parsed.destinationAddress ||
      !isAddress(parsed.destinationAddress) ||
      typeof parsed.chainId !== "number" ||
      !parsed.currency ||
      !SUPPORTED_CURRENCIES.includes(parsed.currency)
    ) {
      return null;
    }
    return {
      label: parsed.label,
      destinationAddress: parsed.destinationAddress,
      chainId: parsed.chainId,
      currency: parsed.currency,
    };
  } catch {
    return null;
  }
}

export function saveCardConfig(config: CardConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearCardConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}
