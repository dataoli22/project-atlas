export const DEFAULT_MARKET = "IN";
export const DEFAULT_CURRENCY = "INR";
export const DEFAULT_LANGUAGE = "en";
export const DEFAULT_API_URL = "http://localhost:8000";

export const SUPPORTED_MARKETS = [
  { code: "EU", label: "Europe", currency: "EUR", languages: ["en", "fr", "de"] },
  { code: "CN", label: "China", currency: "CNY", languages: ["zh"] },
  { code: "IN", label: "India", currency: "INR", languages: ["en"] },
  { code: "UK", label: "United Kingdom", currency: "GBP", languages: ["en"] },
  { code: "US", label: "United States", currency: "USD", languages: ["en"] }
] as const;
