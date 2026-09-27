"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="system-state-page">
      <div className="system-state-card panel">
        <span className="eyebrow">Something went wrong</span>
        <h1>NextFi could not finish that request.</h1>
        <p>{error.message || "An unexpected application error occurred."}</p>
        {error.digest && <code>Error reference: {error.digest}</code>}
        <div><button className="button button-dark" type="button" onClick={reset}>Try again</button><Link className="button button-light" href="/app">Back to app</Link></div>
      </div>
    </main>
  );
}
