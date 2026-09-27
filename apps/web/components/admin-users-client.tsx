"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  baseCurrency: string;
  role: "USER" | "ADMIN";
  status: "ACTIVE" | "SUSPENDED";
  themePreference: string;
  lastLoginAt: string | null;
  createdAt: string;
};

type PageData = {
  items: UserRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
};

export function AdminUsersClient() {
  const [data, setData] = useState<PageData | null>(null);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setMessage("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (query) params.set("search", query);
      setData(await apiFetch<PageData>(`/admin/users?${params.toString()}`));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load users.");
    }
  }, [page, query]);

  useEffect(() => {
    void load();
  }, [load]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  async function patchUser(id: string, change: Partial<Pick<UserRow, "role" | "status">>) {
    setMessage("");
    try {
      await apiFetch(`/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(change),
      });
      setMessage("User updated.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update user.");
    }
  }

  return (
    <div className="app-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">User management</span>
          <h1>Accounts</h1>
          <p>Search, activate, suspend and manage administrator access without exposing authentication secrets.</p>
        </div>
      </div>

      <section className="panel">
        <form className="admin-filter-row" onSubmit={submit}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email"
            aria-label="Search users"
          />
          <button className="button button-dark" type="submit">Search</button>
          {query && (
            <button
              className="button button-light"
              type="button"
              onClick={() => {
                setSearch("");
                setQuery("");
                setPage(1);
              }}
            >
              Clear
            </button>
          )}
          <span className="admin-result-count">{data ? `${data.total} users` : "Loading…"}</span>
        </form>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Base</th>
                <th>Last login</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.items.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.name || "Unnamed user"}</strong>
                    <small>{user.email}</small>
                  </td>
                  <td>
                    <select
                      value={user.role}
                      onChange={(event) => patchUser(user.id, { role: event.target.value as UserRow["role"] })}
                      aria-label={`Role for ${user.email}`}
                    >
                      <option value="USER">User</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                  </td>
                  <td><span className={user.status === "ACTIVE" ? "status-pill" : "status-pill status-danger"}>{user.status}</span></td>
                  <td>{user.baseCurrency}</td>
                  <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button
                      type="button"
                      className={user.status === "ACTIVE" ? "button button-light button-small" : "button button-dark button-small"}
                      onClick={() => patchUser(user.id, { status: user.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })}
                    >
                      {user.status === "ACTIVE" ? "Suspend" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
              {data && !data.items.length && <tr><td colSpan={7} className="empty-cell">No users found.</td></tr>}
            </tbody>
          </table>
        </div>

        {data && data.pages > 1 && (
          <div className="pagination-row">
            <button className="button button-light button-small" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
            <span>Page {data.page} of {data.pages}</span>
            <button className="button button-light button-small" disabled={page >= data.pages} onClick={() => setPage((value) => value + 1)}>Next</button>
          </div>
        )}
      </section>

      {message && <div className="inline-message">{message}</div>}
    </div>
  );
}
