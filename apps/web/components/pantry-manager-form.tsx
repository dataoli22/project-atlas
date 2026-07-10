"use client";

import { useState, useTransition } from "react";

import { addPantryItem, removePantryItem } from "@/lib/nutrition-data";

type PantryManagerFormProps = {
  initialItems: string[];
};

export function PantryManagerForm({ initialItems }: PantryManagerFormProps) {
  const [items, setItems] = useState<string[]>(initialItems);
  const [newItem, setNewItem] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function addItem() {
    const trimmed = newItem.trim();
    if (!trimmed) {
      return;
    }
    startTransition(async () => {
      const result = await addPantryItem(trimmed);
      setItems(result.data);
      setNewItem("");
      setStatus(
        result.source === "api"
          ? null
          : "Backend unavailable - this item won't be saved until Atlas is reachable again."
      );
    });
  }

  function removeItem(name: string) {
    startTransition(async () => {
      const result = await removePantryItem(name);
      setItems(result.data);
    });
  }

  return (
    <section className="atlas-panel atlas-stack">
      <div className="atlas-panel__eyebrow">Pantry - already have this</div>
      <p className="atlas-note">
        Add ingredients you already have on hand. Matching shopping list items are flagged and
        excluded from the &quot;still need to buy&quot; total instead of being bought again.
      </p>

      <div className="atlas-form-grid">
        <label className="atlas-form-field">
          <span>Add pantry item</span>
          <input
            type="text"
            value={newItem}
            placeholder="e.g. Onions"
            onChange={(event) => setNewItem(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addItem();
              }
            }}
          />
        </label>
      </div>

      <button type="button" className="atlas-button" onClick={addItem} disabled={isPending || !newItem.trim()}>
        {isPending ? "Saving..." : "Add to pantry"}
      </button>

      {status ? <p className="atlas-note">{status}</p> : null}

      <div className="atlas-meta">
        {items.length === 0 ? (
          <span className="atlas-note">No pantry items yet.</span>
        ) : (
          items.map((item) => (
            <span key={item} className="atlas-source-badge">
              {item}
              <button
                type="button"
                onClick={() => removeItem(item)}
                aria-label={`Remove ${item} from pantry`}
                style={{
                  marginLeft: 8,
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  color: "inherit",
                  font: "inherit"
                }}
              >
                &times;
              </button>
            </span>
          ))
        )}
      </div>
    </section>
  );
}
