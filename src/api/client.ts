import type { ApiEnvelope, ServiceAccessConfig, ServiceSummary } from "./types";

const ALPHA_PREVIEW_URL = import.meta.env.VITE_ALPHA_PREVIEW_URL as string;
const PROCESSING_API_URL = import.meta.env.VITE_PROCESSING_API_URL as string;

// --- Services metadata (alpha-preview) --------------------------------------

export async function fetchServices(): Promise<ServiceSummary[]> {
  const res = await fetch(`${ALPHA_PREVIEW_URL}/api/services`);

  if (!res.ok) {
    throw new Error(`Failed to fetch services: ${res.status}`);
  }

  const json: ApiEnvelope<ServiceSummary[]> = await res.json();
  return json.data;
}

// --- Feature flag configs (form-processor-api) ------------------------------

export async function fetchServiceConfigs(): Promise<ServiceAccessConfig[]> {
  const res = await fetch(`${PROCESSING_API_URL}/services`);

  if (!res.ok) {
    throw new Error(`Failed to fetch service configs: ${res.status}`);
  }

  const json: ApiEnvelope<ServiceAccessConfig[]> = await res.json();
  return json.data;
}

async function patchFeatureFlag(
  url: string,
  body: Record<string, unknown>,
  accessToken: string
): Promise<ServiceAccessConfig> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update feature flag: ${res.status} ${text}`);
  }

  const json: ApiEnvelope<ServiceAccessConfig> = await res.json();
  return json.data;
}

/**
 * Toggles the service-level feature flag.
 *
 * When subpageSlugs is provided the same isProtected value is also applied
 * to each listed subpage in the same request (cascade on toggle).
 */
export function updateFeatureFlag(
  serviceSlug: string,
  isProtected: boolean,
  accessToken: string,
  subpageSlugs?: string[]
): Promise<ServiceAccessConfig> {
  return patchFeatureFlag(
    `${PROCESSING_API_URL}/services/${serviceSlug}/feature-flag`,
    { isProtected, ...(subpageSlugs && { subpageSlugs }) },
    accessToken
  );
}

export function updateSubpageFeatureFlag(
  serviceSlug: string,
  subpageSlug: string,
  isProtected: boolean,
  accessToken: string
): Promise<ServiceAccessConfig> {
  return patchFeatureFlag(
    `${PROCESSING_API_URL}/services/${serviceSlug}/subpages/${subpageSlug}/feature-flag`,
    { isProtected },
    accessToken
  );
}
