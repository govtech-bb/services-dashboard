import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md px-2 py-0.5 font-medium text-xs ring-1 ring-inset",
  {
    variants: {
      variant: {
        backlog: "bg-gray-50 text-gray-600 ring-gray-500/10",
        "feature-flagged": "bg-amber-50 text-amber-700 ring-amber-600/20",
        live: "bg-green-50 text-green-700 ring-green-600/20",
      },
    },
    defaultVariants: { variant: "backlog" },
  }
);

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
