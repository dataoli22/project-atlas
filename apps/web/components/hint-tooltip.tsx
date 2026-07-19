import type { ReactNode } from "react";

type HintTooltipProps = {
  label: string;
  children: ReactNode;
};

export function HintTooltip({ label, children }: HintTooltipProps) {
  return (
    <span className="atlas-hint">
      <button type="button" className="atlas-hint__trigger" aria-label={label}>
        ?
      </button>
      <span className="atlas-hint__bubble" role="tooltip">
        {children}
      </span>
    </span>
  );
}
