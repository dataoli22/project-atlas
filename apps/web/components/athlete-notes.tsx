"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "atlas-athlete-notes";

// The old /log page never had real persistence (it was a static placeholder with no save
// action), so there is no existing save logic to reuse. This keeps notes on-device via
// localStorage, matching the app's local-first bias, instead of inventing a new backend endpoint.
export function AthleteNotes() {
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setNotes(stored);
    }
    setLoaded(true);
  }, []);

  function saveNotes() {
    window.localStorage.setItem(STORAGE_KEY, notes);
    setStatus("Saved on this device.");
    window.setTimeout(() => setStatus(null), 3000);
  }

  return (
    <section className="atlas-panel atlas-stack">
      <div className="atlas-panel__eyebrow">Athlete notes</div>
      <p className="atlas-note">
        Quick-entry notes for hydration, RPE, mood, soreness, or anything else worth remembering -
        merged here from the old Daily log page so it lives alongside the rest of today&apos;s
        picture.
      </p>
      <label className="atlas-form-field">
        <span>Today&apos;s notes</span>
        <textarea
          className="atlas-textarea"
          rows={5}
          value={notes}
          disabled={!loaded}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Soreness, hydration, RPE, sleep, terrain, gear - anything worth remembering."
        />
      </label>
      <div className="atlas-control-card__actions">
        <button type="button" className="atlas-button atlas-button--primary" onClick={saveNotes} disabled={!loaded}>
          Save notes
        </button>
        {status ? <span className="atlas-note">{status}</span> : null}
      </div>
    </section>
  );
}
