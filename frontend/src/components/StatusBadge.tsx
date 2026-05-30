import clsx from "clsx";
import { STATUS_BADGE_CLASS, STATUS_LABELS } from "../lib/constants";
import type { LeadStatus } from "../types/api";

type Props = {
  status: LeadStatus;
};

export function StatusBadge({ status }: Props) {
  return (
    <span
      className={clsx(
        "inline-flex min-w-[92px] items-center justify-center rounded-md border px-2.5 py-1 text-xs font-semibold",
        STATUS_BADGE_CLASS[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
