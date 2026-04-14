import { createFileRoute } from "@tanstack/react-router";
import { AlertCircle, History, RefreshCw } from "lucide-react";
import { useState } from "react";
import {
  useAuditLogs,
  useEnrichedServices,
  useToggleFeatureFlag,
  useToggleSubpageFeatureFlag,
} from "@/api/queries";
import type { EnrichedService } from "@/api/types";
import { ActivityLog } from "@/components/activity-log";
import { ServicesTable } from "@/components/services-table";
import { Sheet } from "@/components/ui/sheet";

export const Route = createFileRoute("/")({
  component: ServicesPage,
});

type Tab = "all" | EnrichedService["status"];

const tabs: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "backlog", label: "Backlog" },
  { id: "in-progress", label: "In progress" },
  { id: "feature-flagged", label: "Feature flagged" },
  { id: "public", label: "Public" },
];

function ServicesPage() {
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [showActivityLog, setShowActivityLog] = useState(false);

  const { data, isLoading, isError, error } = useEnrichedServices();
  const toggleMutation = useToggleFeatureFlag();
  const toggleSubpageMutation = useToggleSubpageFeatureFlag();
  const auditLogsQuery = useAuditLogs();

  const counts = data
    ? {
        all: data.length,
        backlog: data.filter((s) => s.status === "backlog").length,
        "in-progress": data.filter((s) => s.status === "in-progress").length,
        "feature-flagged": data.filter((s) => s.status === "feature-flagged")
          .length,
        public: data.filter((s) => s.status === "public").length,
      }
    : { all: 0, backlog: 0, "in-progress": 0, "feature-flagged": 0, public: 0 };

  const filtered: EnrichedService[] = data
    ? data
        .filter(
          (s) =>
            (activeTab === "all" || s.status === activeTab) &&
            (search === "" ||
              s.title.toLowerCase().includes(search.toLowerCase()) ||
              s.serviceSlug.toLowerCase().includes(search.toLowerCase()) ||
              s.categoryTitle.toLowerCase().includes(search.toLowerCase()))
        )
        .sort((a, b) => {
          // "Public" services float to the top, then alphabetical by title
          if (a.status === "public" && b.status !== "public") {
            return -1;
          }
          if (a.status !== "public" && b.status === "public") {
            return 1;
          }
          return a.title.localeCompare(b.title);
        })
    : [];

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="font-semibold text-gray-900 text-xl">Services</h1>
          <p className="mt-1 text-gray-500 text-sm">
            {data
              ? `${data.length} services total — manage visibility and feature flags`
              : "Loading services…"}
          </p>
        </div>
        <button
          className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
            showActivityLog
              ? "bg-blue-50 text-blue-600"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          }`}
          onClick={() => setShowActivityLog((prev) => !prev)}
          type="button"
        >
          <History className="h-4 w-4" />
          Activity log
        </button>
      </div>

      {/* Tab bar */}
      <div className="mb-4 border-gray-200 border-b">
        <nav className="-mb-px flex gap-6">
          {tabs.map((tab) => (
            <button
              className={`flex items-center gap-1.5 border-b-2 pb-3 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
              {data && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-xs ${
                    activeTab === tab.id
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {counts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-80"
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, slug or category…"
          type="search"
          value={search}
        />
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="border-gray-200 border-b bg-gray-50 px-4 py-3">
            <div className="h-4 w-48 animate-pulse rounded bg-gray-200" />
          </div>
          {(["a", "b", "c", "d", "e"] as const).map((key) => (
            <div
              className="flex gap-4 border-gray-100 border-b px-4 py-3 last:border-0"
              key={key}
            >
              <div className="h-4 w-48 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-32 animate-pulse rounded bg-gray-100" />
              <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            Failed to load services:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </span>
          <button
            className="ml-auto flex items-center gap-1 text-red-600 hover:text-red-800"
            onClick={() => window.location.reload()}
            type="button"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Empty state — search returned nothing */}
      {!(isLoading || isError) && data && filtered.length === 0 && search && (
        <p className="py-8 text-center text-gray-500 text-sm">
          No services match &ldquo;{search}&rdquo;.
        </p>
      )}

      {/* Table */}
      {!(isLoading || isError) && (
        <ServicesTable
          data={filtered}
          onToggleFeatureFlag={(slug, isProtected) =>
            toggleMutation.mutate({ serviceSlug: slug, isProtected })
          }
          onToggleSubpageFeatureFlag={(
            serviceSlug,
            subpageSlug,
            isProtected
          ) =>
            toggleSubpageMutation.mutate({
              serviceSlug,
              subpageSlug,
              isProtected,
            })
          }
          togglingSlug={
            toggleMutation.isPending
              ? toggleMutation.variables?.serviceSlug
              : undefined
          }
          togglingSubpage={
            toggleSubpageMutation.isPending
              ? toggleSubpageMutation.variables
              : undefined
          }
        />
      )}

      {/* Activity log drawer */}
      <Sheet
        onClose={() => setShowActivityLog(false)}
        open={showActivityLog}
        title="Recent activity"
      >
        <ActivityLog
          entries={auditLogsQuery.data}
          isLoading={auditLogsQuery.isLoading}
        />
      </Sheet>
    </div>
  );
}
