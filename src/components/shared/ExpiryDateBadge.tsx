import { differenceInCalendarDays, parseISO, format } from "date-fns";
import { cn } from "@/lib/utils/cn";

interface Props {
  expiryDate: string | null;
  showDate?: boolean;
}

export function ExpiryDateBadge({ expiryDate, showDate = true }: Props) {
  if (!expiryDate) {
    return <span className="text-xs text-slate-400">No date set</span>;
  }

  const days = differenceInCalendarDays(parseISO(expiryDate), new Date());
  const label = showDate ? format(parseISO(expiryDate), "dd MMM yyyy") : `${days}d`;

  const color =
    days < 0
      ? "bg-red-100 text-red-700 border-red-200"
      : days <= 7
      ? "bg-red-100 text-red-700 border-red-200"
      : days <= 14
      ? "bg-orange-100 text-orange-700 border-orange-200"
      : days <= 30
      ? "bg-yellow-100 text-yellow-700 border-yellow-200"
      : "bg-green-100 text-green-700 border-green-200";

  const suffix =
    days < 0
      ? `(${Math.abs(days)}d ago)`
      : days === 0
      ? "(today!)"
      : days <= 30
      ? `(${days}d left)`
      : "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border",
        color
      )}
    >
      {label} {suffix}
    </span>
  );
}
