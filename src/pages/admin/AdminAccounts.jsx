import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";
import { api } from "../../services/api.js";
import AdminSearchForm from "../../components/admin/AdminSearchForm.jsx";
import Pagination from "../../components/common/Pagination.jsx";
import { formatDate } from "../../utils/helpers.js";

export default function AdminAccounts({ users = [] }) {
  const {
    adminSearch,
    setAdminSearch,
    resetCredential,
    setResetCredential,
    setError,
    setMessage
  } = useApp();

  const [currentPage, setCurrentPage] = useState(0);
  const [copied, setCopied] = useState(false);
  const pageSize = 15;

  const query = adminSearch.trim().toLowerCase();
  const rows = users.filter(
    (account) =>
      !query ||
      `${account.name} ${account.email} ${account.identifier} ${account.role} ${account.department}`
        .toLowerCase()
        .includes(query)
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(currentPage, pageCount - 1);
  const paginated = rows.slice(
    safePage * pageSize,
    safePage * pageSize + pageSize
  );

  async function handleIssueResetCode(userId) {
    try {
      const cred = await api(
        `/api/admin/users/${encodeURIComponent(userId)}/reset-code`,
        {
          method: "POST",
          body: "{}"
        }
      );
      setResetCredential(cred);
      setMessage(
        `Reset code issued for ${cred.email}. It expires in ${cred.expiresInMinutes} minutes.`
      );
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCopyCode() {
    if (resetCredential?.code) {
      try {
        await navigator.clipboard.writeText(resetCredential.code);
        setCopied(true);
        setMessage("Reset code copied to the clipboard.");
        setTimeout(() => setCopied(false), 3000);
      } catch (err) {
        setError(
          "Clipboard access is unavailable. Copy the code from the credential field."
        );
      }
    }
  }

  return (
    <section className="panel">
      <div className="panel-header section-header">
        <div>
          <p className="eyebrow">Campus accounts</p>
          <h2>Accounts</h2>
        </div>
        <span className="demo-tag">
          {users.length} registered account{users.length === 1 ? "" : "s"}
        </span>
      </div>

      <AdminSearchForm
        search={adminSearch}
        onSearchChange={(v) => {
          setAdminSearch(v);
          setCurrentPage(0);
        }}
        onClear={() => {
          setAdminSearch("");
          setCurrentPage(0);
        }}
        placeholder="Search name, email, or ID"
      />

      {resetCredential && (
        <div className="credential-panel" role="status">
          <strong>One-time reset code for {resetCredential.email}</strong>
          <code>{resetCredential.code}</code>
          <div>
            <button
              type="button"
              className="secondary-button"
              onClick={handleCopyCode}
            >
              {copied ? "✓ Copied!" : "Copy code"}
            </button>
          </div>
          <p>
            Expires in {resetCredential.expiresInMinutes} minutes and can be shown
            only once. Share it with the account owner through an approved
            channel.
          </p>
        </div>
      )}

      {rows.length ? (
        <>
          <Pagination
            totalItems={rows.length}
            pageSize={pageSize}
            currentPage={safePage}
            onPageChange={setCurrentPage}
            scope="accounts"
          />

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Institutional ID</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Created</th>
                  <th>Password recovery</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((account) => (
                  <tr key={account.id}>
                    <td>
                      <strong>{account.name}</strong>
                    </td>
                    <td>{account.email}</td>
                    <td>{account.identifier}</td>
                    <td>
                      <span className="chip soft">{account.role}</span>
                    </td>
                    <td>{account.department || "Not reported"}</td>
                    <td>{formatDate(account.created_at)}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary-button compact-button"
                        onClick={() => handleIssueResetCode(account.id)}
                      >
                        Issue reset code
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <h3>No records to display</h3>
          <p>No user accounts match the search criteria.</p>
        </div>
      )}
    </section>
  );
}
