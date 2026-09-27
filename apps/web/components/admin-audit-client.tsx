"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type AuditRow = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { email: string; name: string | null };
};

export function AdminAuditClient() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<AuditRow[]>("/admin/audit")
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load audit log."));
  }, []);

  return (
    <div className="app-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Administrator activity</span>
          <h1>Audit log</h1>
          <p>Recent security-sensitive admin mutations are recorded with actor, target and timestamp.</p>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.createdAt).toLocaleString()}</td>
                  <td><strong>{row.actor.name || row.actor.email}</strong><small>{row.actor.email}</small></td>
                  <td>{row.action}</td>
                  <td>{row.targetType}{row.targetId ? ` · ${row.targetId.slice(0, 8)}` : ""}</td>
                  <td><code className="audit-json">{row.metadata ? JSON.stringify(row.metadata) : "—"}</code></td>
                </tr>
              ))}
              {!rows.length && !error && <tr><td colSpan={5} className="empty-cell">No administrator mutations recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
