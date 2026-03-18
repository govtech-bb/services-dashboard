/** Mirrors ServiceSummary from alpha-preview's /api/services */
export interface ServiceSummary {
  categorySlug: string;
  categoryTitle: string;
  hasImplementation: boolean;
  serviceSlug: string;
  subPageSlugs: string[];
  title: string;
}

/** Mirrors ServiceAccessSummary from form-processor-api */
export interface ServiceAccessConfig {
  isProtected: boolean;
  serviceSlug: string;
  subpages: Array<{ slug: string; isProtected: boolean }>;
}

export interface ApiEnvelope<T> {
  data: T;
  message?: string;
  success: boolean;
}

/**
 * A service enriched with both its content metadata and its feature flag state.
 *
 * status derivation:
 *   backlog        — no form implementation exists yet
 *   feature-flagged — isProtected is true (hidden from public, visible to research users)
 *   live           — has an implementation and is not protected
 */
export type EnrichedService = ServiceSummary &
  Pick<ServiceAccessConfig, "isProtected" | "subpages"> & {
    status: "backlog" | "feature-flagged" | "live";
  };
