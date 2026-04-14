/**
 * Normalised Airtable "Status" values.
 *
 * "consider-next" has no dedicated filter tab and is grouped into "backlog"
 * when computing the final EnrichedService status.
 */
export type CatalogueStatus =
  | "public"
  | "backlog"
  | "in-progress"
  | "feature-flagged"
  | "consider-next";

/** Canonical shape for a single service entry in the catalogue. */
export type ServiceSummary = {
  catalogueStatus: CatalogueStatus;
  categorySlug: string;
  categoryTitle: string;
  /**
   * true when the service has a deployed form implementation ("public" or
   * "feature-flagged" in Airtable). Controls whether the feature-flag toggle
   * is shown in the table.
   */
  hasImplementation: boolean;
  serviceSlug: string;
  title: string;
};

/**
 * Mirrors ServiceAccessSummary from form-processor-api.
 *
 * The API stores protection at both the service level and per-subpage.
 * The dashboard toggle always cascades to the start + form subpages,
 * so both levels may have entries.
 */
export type ServiceAccessConfig = {
  isProtected: boolean;
  serviceSlug: string;
  subpages: Array<{ slug: string; isProtected: boolean }>;
};

export type ApiEnvelope<T> = {
  data: T;
  message?: string;
  success: boolean;
};

// --- Audit log ---------------------------------------------------------------

export type AuditLogAction = "enable" | "disable";

/** Scope differentiates service-level vs subpage-level toggles. */
export type AuditLogScope = "service" | "subpage";

export type AuditLogEntry = {
  id: string;
  serviceSlug: string;
  /** null for service-level toggles */
  subpageSlug: string | null;
  scope: AuditLogScope;
  action: AuditLogAction;
  performedBy: string;
  /** Human-readable display name — null for entries created before this field existed. */
  performedByName: string | null;
  performedAt: string;
};

export type CreateAuditLogPayload = Omit<AuditLogEntry, "id" | "performedAt">;

/**
 * A service enriched with both its catalogue metadata and its feature flag state.
 *
 * status derivation:
 *   backlog         — Airtable status is "backlog" or "consider-next"
 *   in-progress     — Airtable status is "in-progress" (form being built, not yet deployed)
 *   feature-flagged — Airtable status is "feature-flagged", OR status is "public" but
 *                     isProtected is true in the form-processor-api
 *   public          — Airtable status is "public" and isProtected is false
 */
export type EnrichedService = ServiceSummary &
  Pick<ServiceAccessConfig, "isProtected" | "subpages"> & {
    status: "backlog" | "in-progress" | "feature-flagged" | "public";
  };
