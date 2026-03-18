import {
  createColumnHelper,
  type ExpandedState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";
import type { EnrichedService } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type TogglingSubpage = { serviceSlug: string; subpageSlug: string } | undefined;

interface ServicesTableProps {
  data: EnrichedService[];
  /**
   * Called when the service-level flag is toggled.
   * subPageSlugs contains all subpages to cascade the change to by default.
   */
  onToggleFeatureFlag: (
    serviceSlug: string,
    isProtected: boolean,
    subPageSlugs: string[]
  ) => void;
  onToggleSubpageFeatureFlag: (
    serviceSlug: string,
    subpageSlug: string,
    isProtected: boolean
  ) => void;
  togglingSlug: string | undefined;
  togglingSubpage: TogglingSubpage;
}

const columnHelper = createColumnHelper<EnrichedService>();

const statusLabel: Record<EnrichedService["status"], string> = {
  backlog: "Backlog",
  "feature-flagged": "Feature flagged",
  live: "Live",
};

function SortIcon({ isSorted }: { isSorted: false | "asc" | "desc" }) {
  if (isSorted === "asc") {
    return <ArrowUp className="h-3.5 w-3.5" />;
  }
  if (isSorted === "desc") {
    return <ArrowDown className="h-3.5 w-3.5" />;
  }
  return <ArrowUpDown className="h-3.5 w-3.5 text-gray-400" />;
}

export function ServicesTable({
  data,
  onToggleFeatureFlag,
  onToggleSubpageFeatureFlag,
  togglingSlug,
  togglingSubpage,
}: ServicesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const columns = [
    columnHelper.display({
      id: "expander",
      header: () => null,
      cell: ({ row }) => {
        if (!row.original.hasImplementation) {
          return null;
        }
        return (
          <button
            aria-label={row.getIsExpanded() ? "Collapse row" : "Expand row"}
            className="rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            onClick={row.getToggleExpandedHandler()}
            type="button"
          >
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform",
                row.getIsExpanded() && "rotate-90"
              )}
            />
          </button>
        );
      },
    }),
    columnHelper.accessor("title", {
      header: "Service",
      cell: (info) => (
        <div>
          <p className="font-medium text-gray-900">{info.getValue()}</p>
          <p className="mt-0.5 font-mono text-gray-400 text-xs">
            {info.row.original.serviceSlug}
          </p>
        </div>
      ),
    }),
    columnHelper.accessor("categoryTitle", {
      header: "Category",
      cell: (info) => (
        <span className="text-gray-600 text-sm">{info.getValue()}</span>
      ),
    }),
    columnHelper.accessor("status", {
      header: "Status",
      cell: (info) => (
        <Badge variant={info.getValue()}>{statusLabel[info.getValue()]}</Badge>
      ),
    }),
    columnHelper.accessor("isProtected", {
      header: "Feature flag",
      enableSorting: false,
      cell: (info) => {
        const service = info.row.original;
        const isToggling = togglingSlug === service.serviceSlug;

        if (!service.hasImplementation) {
          return <span className="text-gray-400 text-xs">—</span>;
        }

        return (
          <div className="flex items-center gap-2">
            {isToggling && (
              <span className="text-gray-400 text-xs">Saving…</span>
            )}
            <Switch
              checked={info.getValue()}
              disabled={isToggling}
              onCheckedChange={(checked) =>
                onToggleFeatureFlag(
                  service.serviceSlug,
                  checked,
                  service.subPageSlugs
                )
              }
            />
          </div>
        );
      },
    }),
  ];

  const table = useReactTable({
    data,
    columns,
    state: { sorting, expanded },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getRowCanExpand: (row) => row.original.hasImplementation,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const colSpan = columns.length;

  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-gray-500 text-sm">
        No services in this category.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  className={cn(
                    "px-4 py-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wide",
                    header.column.getCanSort() &&
                      "cursor-pointer select-none hover:text-gray-700"
                  )}
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  <div className="flex items-center gap-1.5">
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                    {header.column.getCanSort() && (
                      <SortIcon isSorted={header.column.getIsSorted()} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {table.getRowModel().rows.map((row) => (
            <Fragment key={row.id}>
              <tr
                className={cn(
                  "hover:bg-gray-50",
                  row.getIsExpanded() && "bg-gray-50"
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td className="px-4 py-3 text-sm" key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>

              {row.getIsExpanded() && (
                <tr className="bg-gray-50">
                  <td className="px-4 pt-0 pb-4" colSpan={colSpan}>
                    <SubpageFlags
                      onToggle={onToggleSubpageFeatureFlag}
                      service={row.original}
                      togglingSubpage={togglingSubpage}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Subpage flags panel ----------------------------------------------------

interface SubpageFlagsProps {
  onToggle: (
    serviceSlug: string,
    subpageSlug: string,
    isProtected: boolean
  ) => void;
  service: EnrichedService;
  togglingSubpage: TogglingSubpage;
}

function SubpageFlags({
  service,
  onToggle,
  togglingSubpage,
}: SubpageFlagsProps) {
  // Build a lookup of current DB state; slugs absent from DB default to false
  const dbState = new Map(
    service.subpages.map((sp) => [sp.slug, sp.isProtected])
  );

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3">
      <p className="mb-3 font-medium text-gray-400 text-xs uppercase tracking-wide">
        Subpage flags
      </p>
      <div className="space-y-2">
        {service.subPageSlugs.map((slug) => {
          const isProtected = dbState.get(slug) ?? false;
          const isToggling =
            togglingSubpage?.serviceSlug === service.serviceSlug &&
            togglingSubpage?.subpageSlug === slug;

          return (
            <div className="flex items-center justify-between gap-4" key={slug}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-gray-600 text-xs">/{slug}</span>
                {isProtected && (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-600 text-xs">
                    protected
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {isToggling && (
                  <span className="text-gray-400 text-xs">Saving…</span>
                )}
                <Switch
                  checked={isProtected}
                  disabled={isToggling}
                  onCheckedChange={(checked) =>
                    onToggle(service.serviceSlug, slug, checked)
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
