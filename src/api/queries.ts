import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import {
  createAuditLogEntry,
  fetchAuditLogs,
  fetchServiceConfigs,
  fetchServices,
  updateFeatureFlag,
  updateSubpageFeatureFlag,
} from "./client";
import type {
  CreateAuditLogPayload,
  EnrichedService,
  ServiceAccessConfig,
  ServiceSummary,
} from "./types";


export const queryKeys = {
  services: ["services"] as const,
  configs: ["service-configs"] as const,
  auditLogs: (serviceSlug?: string) =>
    serviceSlug
      ? (["audit-logs", serviceSlug] as const)
      : (["audit-logs"] as const),
};

/** Fetches and merges services + feature flag configs into enriched entries. */
export function useEnrichedServices() {
  const servicesQuery = useQuery({
    queryKey: queryKeys.services,
    queryFn: fetchServices,
    staleTime: 5 * 60 * 1000,
  });

  const configsQuery = useQuery({
    queryKey: queryKeys.configs,
    queryFn: fetchServiceConfigs,
    staleTime: 60 * 1000,
  });

  const data: EnrichedService[] | undefined =
    servicesQuery.data && configsQuery.data
      ? mergeServicesWithConfigs(servicesQuery.data, configsQuery.data)
      : undefined;

  return {
    data,
    isLoading: servicesQuery.isLoading || configsQuery.isLoading,
    isError: servicesQuery.isError || configsQuery.isError,
    error: servicesQuery.error ?? configsQuery.error,
  };
}

/** Toggles the service-level flag and cascades to all subpages. */
export function useToggleFeatureFlag() {
  const queryClient = useQueryClient();
  const auth = useAuth();

  return useMutation({
    mutationFn: ({
      serviceSlug,
      isProtected,
    }: {
      serviceSlug: string;
      isProtected: boolean;
    }) => {
      const token = auth.user?.access_token;
      if (!token) {
        throw new Error("Not authenticated");
      }
      return updateFeatureFlag(serviceSlug, isProtected, token);
    },

    onMutate: async ({ serviceSlug, isProtected }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.configs });

      const previous = queryClient.getQueryData<ServiceAccessConfig[]>(
        queryKeys.configs
      );

      queryClient.setQueryData<ServiceAccessConfig[]>(
        queryKeys.configs,
        (old) => {
          if (!old) {
            return old;
          }

          const exists = old.some((c) => c.serviceSlug === serviceSlug);

          if (exists) {
            return old.map((c) =>
              c.serviceSlug === serviceSlug
                ? {
                    ...c,
                    isProtected,
                    subpages: [
                      { slug: "start", isProtected },
                      { slug: "form", isProtected },
                    ],
                  }
                : c
            );
          }

          return [
            ...old,
            {
              serviceSlug,
              isProtected,
              subpages: [
                { slug: "start", isProtected },
                { slug: "form", isProtected },
              ],
            },
          ];
        }
      );

      return { previous };
    },

    onSuccess: (_data, { serviceSlug, isProtected }) => {
      const token = auth.user?.access_token;
      if (!token) {
        return;
      }

      const payload: CreateAuditLogPayload = {
        serviceSlug,
        subpageSlug: null,
        scope: "service",
        action: isProtected ? "enable" : "disable",
      };

      createAuditLogEntry(payload, token).catch(() => {
        // Audit logging is best-effort — never block the toggle flow
      });
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.configs, context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configs });
      queryClient.invalidateQueries({ queryKey: queryKeys.auditLogs() });
    },
  });
}

/** Toggles a single subpage's feature flag independently. */
export function useToggleSubpageFeatureFlag() {
  const queryClient = useQueryClient();
  const auth = useAuth();

  return useMutation({
    mutationFn: ({
      serviceSlug,
      subpageSlug,
      isProtected,
    }: {
      serviceSlug: string;
      subpageSlug: string;
      isProtected: boolean;
    }) => {
      const token = auth.user?.access_token;
      if (!token) {
        throw new Error("Not authenticated");
      }
      return updateSubpageFeatureFlag(
        serviceSlug,
        subpageSlug,
        isProtected,
        token
      );
    },

    onMutate: async ({ serviceSlug, subpageSlug, isProtected }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.configs });

      const previous = queryClient.getQueryData<ServiceAccessConfig[]>(
        queryKeys.configs
      );

      queryClient.setQueryData<ServiceAccessConfig[]>(
        queryKeys.configs,
        (old) => {
          if (!old) {
            return old;
          }

          const serviceExists = old.some(
            (c) => c.serviceSlug === serviceSlug
          );

          if (serviceExists) {
            return old.map((c) => {
              if (c.serviceSlug !== serviceSlug) {
                return c;
              }

              const subpageExists = c.subpages.some(
                (sp) => sp.slug === subpageSlug
              );

              return {
                ...c,
                subpages: subpageExists
                  ? c.subpages.map((sp) =>
                      sp.slug === subpageSlug ? { ...sp, isProtected } : sp
                    )
                  : [...c.subpages, { slug: subpageSlug, isProtected }],
              };
            });
          }

          return [
            ...old,
            {
              serviceSlug,
              isProtected: false,
              subpages: [{ slug: subpageSlug, isProtected }],
            },
          ];
        }
      );

      return { previous };
    },

    onSuccess: (_data, { serviceSlug, subpageSlug, isProtected }) => {
      const token = auth.user?.access_token;
      if (!token) {
        return;
      }

      const payload: CreateAuditLogPayload = {
        serviceSlug,
        subpageSlug,
        scope: "subpage",
        action: isProtected ? "enable" : "disable",
      };

      createAuditLogEntry(payload, token).catch(() => {
        // Audit logging is best-effort — never block the toggle flow
      });
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.configs, context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configs });
      queryClient.invalidateQueries({ queryKey: queryKeys.auditLogs() });
    },
  });
}

// --- Audit logs --------------------------------------------------------------

export function useAuditLogs(serviceSlug?: string) {
  const auth = useAuth();

  return useQuery({
    queryKey: queryKeys.auditLogs(serviceSlug),
    queryFn: () => {
      const token = auth.user?.access_token;
      if (!token) {
        throw new Error("Not authenticated");
      }
      return fetchAuditLogs(token, serviceSlug);
    },
    enabled: !!auth.user?.access_token,
    staleTime: 30 * 1000,
  });
}

// --- Derived data -----------------------------------------------------------

/**
 * A service is considered feature-flagged when either its service-level
 * isProtected flag is true OR any of its subpage entries are protected.
 * This matches how the form-processor-api stores protection at the subpage level.
 */
function hasAnyProtection(config: ServiceAccessConfig): boolean {
  return (
    config.isProtected || config.subpages.some((sp) => sp.isProtected)
  );
}

/**
 * Every implemented service has start + form subpages. When the API has no
 * entries yet we seed defaults so the expand panel always has rows to show.
 */
const DEFAULT_SUBPAGES: ServiceAccessConfig["subpages"] = [
  { slug: "start", isProtected: false },
  { slug: "form", isProtected: false },
];

function mergeServicesWithConfigs(
  services: ServiceSummary[],
  configs: ServiceAccessConfig[]
): EnrichedService[] {
  const configBySlug = new Map(configs.map((c) => [c.serviceSlug, c]));

  return services.map((service) => {
    const config = configBySlug.get(service.serviceSlug);
    const subpages =
      config && config.subpages.length > 0
        ? config.subpages
        : DEFAULT_SUBPAGES;

    // The top-level switch means "flag everything" — it should only show ON
    // when every subpage is protected. Individual subpages can be toggled
    // independently in the expanded panel.
    const allSubpagesProtected =
      subpages.length > 0 && subpages.every((sp) => sp.isProtected);

    // Status uses "any" protection — a service is feature-flagged if at least
    // one subpage is protected, even if the top-level switch is off.
    const hasFlag = config ? hasAnyProtection(config) : false;

    let status: EnrichedService["status"];
    const cs = service.catalogueStatus;

    if (cs === "consider-next") {
      status = "backlog";
    } else if (cs === "public" && hasFlag) {
      status = "feature-flagged";
    } else {
      status = cs;
    }

    return {
      ...service,
      isProtected: allSubpagesProtected,
      subpages,
      status,
    };
  });
}
