import { REGISTRY_BY_TITLE } from "@/data/service-registry";
import type {
  ApiEnvelope,
  AuditLogEntry,
  CatalogueStatus,
  CreateAuditLogPayload,
  ServiceAccessConfig,
  ServiceSummary,
} from "./types";

const PROCESSING_API_URL = import.meta.env.VITE_PROCESSING_API_URL as string;
const AIRTABLE_BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID as string;
const AIRTABLE_TABLE_NAME = import.meta.env.VITE_AIRTABLE_TABLE_NAME as string;
const AIRTABLE_TOKEN = import.meta.env.VITE_AIRTABLE_TOKEN as string;

// Raw field names as they appear in the Airtable table.
// All fields are optional because Airtable omits empty fields from the API
// response entirely rather than returning null — any field can be absent.
type AirtableServiceFields = {
  "Service Name"?: string;
  // Single-select: "Backlog" means not yet implemented; all other values are treated as implemented
  Status?: string;
  Ministry?: string;
  // Full URL to the service on the portal — may include subpage paths like /start
  Link?: string;
};

type AirtableRecord = {
  id: string;
  fields: AirtableServiceFields;
};

type AirtableResponse = {
  records: AirtableRecord[];
  offset?: string;
};

/**
 * Normalises the raw Airtable "Status" string to a CatalogueStatus value.
 * Matching is case-insensitive to handle inconsistent Airtable entries.
 * Unknown values fall back to "backlog".
 */
function parseCatalogueStatus(raw: string): CatalogueStatus {
  switch (raw.toLowerCase().trim()) {
    case "public":
      return "public";
    case "backlog":
      return "backlog";
    case "in progress":
    case "in-progress":
      return "in-progress";
    case "feature flagged":
    case "feature-flagged":
      return "feature-flagged";
    case "consider next":
    case "consider-next":
      return "consider-next";
    default:
      return "backlog";
  }
}

/** Services with these statuses have a deployed form implementation. */
const IMPLEMENTED_STATUSES = new Set<CatalogueStatus>([
  "public",
  "feature-flagged",
]);

const NON_ALPHANUMERIC_RE = /[^a-z0-9]+/g;
const LEADING_TRAILING_HYPHEN_RE = /^-|-$/g;

/**
 * Converts a ministry name to a URL-safe slug.
 * e.g. "Ministry of Health & Wellness" → "ministry-of-health-wellness"
 */
function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(NON_ALPHANUMERIC_RE, "-")
    .replace(LEADING_TRAILING_HYPHEN_RE, "");
}

// --- Services metadata (Airtable) -------------------------------------------

/**
 * Fetches the full service catalogue from Airtable, handling pagination
 * automatically. Airtable caps responses at 100 records per page and signals
 * more pages via an `offset` token in the response body.
 *
 * Each record is matched against the static SERVICE_REGISTRY (by title) to
 * resolve the correct serviceSlug, categorySlug, and hasImplementation flag.
 * Airtable remains the source of truth for catalogueStatus (workflow state),
 * while the registry is the source of truth for portal slugs.
 */
export async function fetchServices(): Promise<ServiceSummary[]> {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(
      `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`
    );
    if (offset) {
      url.searchParams.set("offset", offset);
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch services from Airtable: ${res.status}`);
    }

    const json: AirtableResponse = await res.json();
    records.push(...json.records);
    offset = json.offset;
  } while (offset);

  return records.map((record) => {
    const title = record.fields["Service Name"] ?? "";
    const ministry = record.fields.Ministry ?? "";
    const catalogueStatus = parseCatalogueStatus(record.fields.Status ?? "");

    // Match against the static registry for correct portal slugs.
    // Falls back to a generated slug from the title for Airtable-only entries
    // that don't exist in the alpha-preview content directory.
    const registryEntry = REGISTRY_BY_TITLE.get(title.toLowerCase());

    return {
      serviceSlug: registryEntry?.serviceSlug ?? toSlug(title),
      title,
      categoryTitle: registryEntry?.categoryTitle ?? ministry,
      categorySlug: registryEntry?.categorySlug ?? toSlug(ministry),
      catalogueStatus,
      hasImplementation:
        registryEntry?.hasImplementation ??
        IMPLEMENTED_STATUSES.has(catalogueStatus),
    };
  });
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
 * Every implemented service in alpha-preview has these two subpages.
 * The form-processor-api stores protection at the subpage level, so we always
 * cascade the toggle to both so the DB entries are created/updated correctly.
 */
const FLAGGED_SUBPAGE_SLUGS = ["start", "form"];

/** Toggles the service-level feature flag and cascades to start + form subpages. */
export function updateFeatureFlag(
  serviceSlug: string,
  isProtected: boolean,
  accessToken: string
): Promise<ServiceAccessConfig> {
  return patchFeatureFlag(
    `${PROCESSING_API_URL}/services/${serviceSlug}/feature-flag`,
    { isProtected, subpageSlugs: FLAGGED_SUBPAGE_SLUGS },
    accessToken
  );
}

/** Toggles the feature flag for a single subpage. */
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

// --- Audit log (form-processor-api) -----------------------------------------

export async function createAuditLogEntry(
  payload: CreateAuditLogPayload,
  accessToken: string
): Promise<AuditLogEntry> {
  const res = await fetch(`${PROCESSING_API_URL}/audit-logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create audit log entry: ${res.status} ${text}`);
  }

  const json: ApiEnvelope<AuditLogEntry> = await res.json();
  return json.data;
}

/**
 * The audit-logs GET endpoint returns a paginated wrapper:
 *   { success, data: { entries: [...], total, limit, offset, hasMore } }
 *
 * We normalise both possible shapes (paginated object vs plain array)
 * so the rest of the client always receives AuditLogEntry[].
 */
type PaginatedAuditLogs = {
  entries: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

export async function fetchAuditLogs(
  accessToken: string,
  serviceSlug?: string
): Promise<AuditLogEntry[]> {
  const url = new URL(`${PROCESSING_API_URL}/audit-logs`);
  if (serviceSlug) {
    url.searchParams.set("serviceSlug", serviceSlug);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch audit logs: ${res.status}`);
  }

  const json = (await res.json()) as
    | ApiEnvelope<PaginatedAuditLogs>
    | ApiEnvelope<AuditLogEntry[]>;

  const payload = json.data;

  if (Array.isArray(payload)) {
    return payload;
  }

  // Paginated shape — unwrap the entries array
  if (payload && "entries" in payload && Array.isArray(payload.entries)) {
    return payload.entries;
  }

  return [];
}
