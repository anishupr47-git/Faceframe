import { getMockRecommendations } from "./mockRecommendationService";

function normalizeBaseUrl(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function normalizePath(path) {
  const raw = String(path || "/recommend").trim();
  if (!raw) {
    return "/recommend";
  }

  return raw.startsWith("/") ? raw : `/${raw}`;
}

const configuredBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);
const fallbackBaseUrl = import.meta.env.DEV ? "http://127.0.0.1:8000" : "";
const apiBaseUrl = configuredBaseUrl || fallbackBaseUrl;
const apiPath = normalizePath(import.meta.env.VITE_API_RECOMMEND_PATH || "/recommend");
const API_URL = `${apiBaseUrl}${apiPath}`;

const enableMockFallback =
  import.meta.env.VITE_ENABLE_MOCK_FALLBACK === "true" ||
  (import.meta.env.VITE_ENABLE_MOCK_FALLBACK !== "false" && import.meta.env.DEV);

function normalizeApiResponse(data) {
  return {
    best_match: data.best_match,
    alternatives: Array.isArray(data.alternatives) ? data.alternatives.slice(0, 2) : [],
    explanation: data.explanation || "Recommended based on your detected face profile and preferences.",
    confidence: typeof data.confidence === "number" ? data.confidence : undefined,
    source: "api"
  };
}

export async function getHairstyleRecommendations(payload, context = {}) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API error ${response.status}`);
    }

    const data = await response.json();
    return normalizeApiResponse(data);
  } catch (error) {
    if (enableMockFallback) {
      return getMockRecommendations(payload, context);
    }

    throw error;
  }
}
