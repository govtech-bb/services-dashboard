import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "react-oidc-context";
import {
  fetchServiceConfigs,
  fetchServices,
  updateFeatureFlag,
  updateSubpageFeatureFlag,
} from "./client";
import type {
  EnrichedService,
  ServiceAccessConfig,
  ServiceSummary,
} from "./types";

export const queryKeys = {
  services: ["services"] as const,
  configs: ["service-configs"] as const,
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

export function useToggleFeatureFlag() {
  const queryClient = useQueryClient();
  const auth = useAuth();

  return useMutation({
    mutationFn: ({
      serviceSlug,
      isProtected,
      subPageSlugs,
    }: {
      serviceSlug: string;
      isProtected: boolean;
      subPageSlugs?: string[];
    }) => {
      const token = auth.user?.access_token;
      if (!token) {
        throw new Error("Not authenticated");
      }
      return updateFeatureFlag(serviceSlug, isProtected, token, subPageSlugs);
    },

    // Optimistically update service-level flag and cascade to subpages
    onMutate: async ({ serviceSlug, isProtected, subPageSlugs }) => {
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

          const updatedSubpages = (
            current: ServiceAccessConfig["subpages"]
          ) => {
            if (!subPageSlugs?.length) {
              return current;
            }
            // Apply the new flag to each cascaded subpage, adding rows that don't exist yet
            const updatedSlugs = new Set(subPageSlugs);
            const updated = current.map((sp) =>
              updatedSlugs.has(sp.slug) ? { ...sp, isProtected } : sp
            );
            const existingSlugs = new Set(current.map((sp) => sp.slug));
            const newEntries = subPageSlugs
              .filter((s) => !existingSlugs.has(s))
              .map((s) => ({ slug: s, isProtected }));
            return [...updated, ...newEntries];
          };

          if (exists) {
            return old.map((c) =>
              c.serviceSlug === serviceSlug
                ? { ...c, isProtected, subpages: updatedSubpages(c.subpages) }
                : c
            );
          }

          return [
            ...old,
            {
              serviceSlug,
              isProtected,
              subpages: updatedSubpages([]),
            },
          ];
        }
      );

      return { previous };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.configs, context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configs });
    },
  });
}

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

          const serviceExists = old.some((c) => c.serviceSlug === serviceSlug);

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

          // Service had no DB entry yet — create a minimal one
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

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.configs, context.previous);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.configs });
    },
  });
}

// --- Derived data -----------------------------------------------------------

function mergeServicesWithConfigs(
  services: ServiceSummary[],
  configs: ServiceAccessConfig[]
): EnrichedService[] {
  const configBySlug = new Map(configs.map((c) => [c.serviceSlug, c]));

  return services.map((service) => {
    const config = configBySlug.get(service.serviceSlug);
    const isProtected = config?.isProtected ?? false;
    const subpages = config?.subpages ?? [];

    // A service is feature-flagged if the service itself is protected,
    // or if any of its subpages are protected
    const hasAnyFlag = isProtected || subpages.some((sp) => sp.isProtected);

    let status: EnrichedService["status"];
    if (!service.hasImplementation) {
      status = "backlog";
    } else if (hasAnyFlag) {
      status = "feature-flagged";
    } else {
      status = "live";
    }

    return {
      ...service,
      isProtected,
      subpages,
      status,
    };
  });
}
