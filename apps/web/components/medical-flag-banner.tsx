import type { EnduranceMedicalFlag } from "@atlas/shared";

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
            <br />
            <span className="atlas-note">{flag.detail}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
