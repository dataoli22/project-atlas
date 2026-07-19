"use client";

import { useState } from "react";

export type CoachSupportLinkGroup = {
  type: string;
  label: string;
  links: Array<{ url: string; title: string; whyRecommended: string }>;
};

type CoachSupportModalProps = {
  groups: CoachSupportLinkGroup[];
};

export function CoachSupportModal({ groups }: CoachSupportModalProps) {
  const [open, setOpen] = useState(false);
  const totalLinks = groups.reduce((count, group) => count + group.links.length, 0);

  return (
    <>
      <button type="button" className="atlas-button" onClick={() => setOpen(true)}>
        Coach support resources ({totalLinks})
      </button>

      {open ? (
        <div
          className="atlas-modal-overlay"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="atlas-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Coach support resources"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="atlas-modal__header">
              <div>
                <div className="atlas-panel__eyebrow">Coach support resources</div>
                <p className="atlas-note">
                  Curated, informational resources, not medical advice. Each is tagged with why it
                  is relevant.
                </p>
              </div>
              <button
                type="button"
                className="atlas-toast__close"
                aria-label="Close coach support resources"
                onClick={() => setOpen(false)}
              >
                &times;
              </button>
            </div>

            <div className="atlas-stack">
              {groups.map((group) => (
                <div key={group.type} className="atlas-stack" style={{ gap: "10px" }}>
                  <div className="atlas-panel__eyebrow">{group.label}</div>
                  <div
                    className="atlas-grid"
                    style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}
                  >
                    {group.links.map((link) => (
                      <article key={link.url} className="atlas-list-card atlas-stack" style={{ gap: "8px" }}>
                        <a className="atlas-list-card__title" href={link.url} target="_blank" rel="noreferrer">
                          {link.title}
                        </a>
                        <div className="atlas-list-card__meta">{link.whyRecommended}</div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
