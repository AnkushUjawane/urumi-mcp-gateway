import { config } from "../config.js";

export type Provider = { name: string; baseUrl: string; model: string; apiKey: string };

// A provider counts as configured only if it has a key, a URL and a model. Order = try order (primary, then fallback).
export function getProviders(): Provider[] {
  const raw = [
    { name: config.LLM_PRIMARY_NAME, baseUrl: config.LLM_PRIMARY_BASE_URL, model: config.LLM_PRIMARY_MODEL, apiKey: config.LLM_PRIMARY_API_KEY },
    { name: config.LLM_FALLBACK_NAME, baseUrl: config.LLM_FALLBACK_BASE_URL, model: config.LLM_FALLBACK_MODEL, apiKey: config.LLM_FALLBACK_API_KEY },
  ];
  return raw.filter((p) => p.apiKey && p.baseUrl && p.model) as Provider[];
}

// What may be shown to users: names and models only. Never keys.
export const describeProviders = () =>
  getProviders().map((p, i) => ({ name: p.name, model: p.model, role: i === 0 ? "primary" : "fallback" }));
