import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type SheetProps = {
  children: ReactNode;
  onClose: () => void;
  open: boolean;
  title?: string;
};

/**
 * A right-anchored slide-in panel with a backdrop overlay.
 * Focus is trapped inside while open and Escape dismisses it.
 */
export function Sheet({ children, onClose, open, title }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity duration-300",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        aria-label={title}
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[380px] flex-col border-gray-200 border-l bg-white shadow-xl transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full"
        )}
        role="dialog"
      >
        {title && (
          <div className="flex items-center justify-between border-gray-200 border-b px-5 py-4">
            <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
            <button
              aria-label="Close"
              className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              onClick={onClose}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </>
  );
}
