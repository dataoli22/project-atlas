import type { EnduranceMedicalFlag } from "@atlas/shared";

import { HintTooltip } from "@/components/hint-tooltip";

export function MedicalFlagBanner({ flags }: { flags: EnduranceMedicalFlag[] }) {
  if (flags.length === 0) {
    return null;
  }

  return (
    <div className="atlas-stack" role="alert" style={{ gap: 10 }}>
      {flags.map((flag) => (
        <div key={flag.flagType} className="atlas-banner atlas-banner--stale">
          <span className="atlas-banner__icon" aria-hidden="true">
            ⚕
          </span>
          <span>
            <strong>Worth a look: </strong>
            {flag.message}
            <HintTooltip label="What this flag means">
              This is an automated pattern check on your logged training data - not a medical
              diagnosis or advice. If something feels off, talk to a doctor rather than relying on
              this.
            </HintTooltip>
            <br />
            <span className="atlas-note">{flag.detail}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
