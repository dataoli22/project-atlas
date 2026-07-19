"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type ConnectReminderToastProps = {
  missingLabels: string[];
};

const AUTO_DISMISS_MS = 15000;

export function ConnectReminderToast({ missingLabels }: ConnectReminderToastProps) {
  const [dismissed, setDismissed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (missingLabels.length === 0) {
      return;
    }
    timeoutRef.current = setTimeout(() => setDismissed(true), AUTO_DISMISS_MS);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [missingLabels.length]);

  function close() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setDismissed(true);
  }

  if (dismissed || missingLabels.length === 0) {
    return null;
  }

  return (
    <div className="atlas-toast" role="status">
      <div className="atlas-toast__body">
        <strong>Not fully connected</strong>
        <span>
          {missingLabels.join(", ")} {missingLabels.length === 1 ? "isn't" : "aren't"} connected yet, so some
          training data may be missing. Connect it in{" "}
          <Link href="/settings/integrations">Settings &rarr; Integrations</Link>.
        </span>
      </div>
      <button type="button" className="atlas-toast__close" aria-label="Dismiss reminder" onClick={close}>
        &times;
      </button>
    </div>
  );
}
