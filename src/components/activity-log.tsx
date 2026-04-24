import { CircleCheck, CircleX, History } from "lucide-react";
import type { AuditLogEntry } from "@/api/types";

function formatRelativeTime(isoDate: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(isoDate).getTime()) / 1000
  );

  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }

  return new Date(isoDate).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function ActionLabel({ entry }: { entry: AuditLogEntry }) {
  const actor = entry.performedBy;
  const verb = entry.action === "enable" ? "enabled" : "disabled";
  const target =
    entry.scope === "subpage" && entry.subpageSlug
      ? `/${entry.subpageSlug}`
      : entry.serviceSlug;

  return (
    <span>
      <span className="text-gray-600">{actor}</span>{" "}
      <span className={`font-medium ${entry.action === "enable" ? "text-green-600" : "text-red-600"}`}>{verb}</span>{" "}
      {entry.scope === "subpage" ? "subpage " : ""}
      <span className="font-mono text-gray-700">{target}</span>
      {entry.scope === "subpage" && (
        <span className="text-gray-400">
          {" "}
          on {entry.serviceSlug}
        </span>
      )}
    </span>
  );
}

type ActivityLogProps = {
  entries: AuditLogEntry[] | undefined;
  isLoading: boolean;
};

export function ActivityLog({ entries, isLoading }: ActivityLogProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {(["a", "b", "c"] as const).map((key) => (
          <div className="flex gap-3" key={key}>
            <div className="h-4 w-4 animate-pulse rounded-full bg-gray-200" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-3/4 animate-pulse rounded bg-gray-200" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <History className="h-6 w-6 text-gray-300" />
        <p className="text-gray-400 text-sm">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-0 divide-y divide-gray-100">
      {entries.map((entry) => (
        <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0" key={entry.id}>
          {entry.action === "enable" ? (
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
          ) : (
            <CircleX className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-gray-600 text-sm leading-snug">
              <ActionLabel entry={entry} />
            </p>
            <p className="mt-0.5 text-gray-400 text-xs">
              <time dateTime={entry.performedAt}>
                {formatRelativeTime(entry.performedAt)}
              </time>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
