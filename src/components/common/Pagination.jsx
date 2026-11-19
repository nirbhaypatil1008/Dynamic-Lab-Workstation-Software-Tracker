import React from "react";

export default function Pagination({
  totalItems,
  pageSize,
  currentPage,
  onPageChange,
  scope = "items"
}) {
  if (totalItems <= 0) return null;

  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = currentPage * pageSize;
  const from = totalItems ? start + 1 : 0;
  const to = Math.min(start + pageSize, totalItems);

  if (totalItems <= pageSize) {
    return (
      <p className="list-count">
        Showing {totalItems} {scope}
      </p>
    );
  }

  return (
    <nav className="pagination" aria-label={`${scope} pagination`}>
      <span>
        Showing {from}–{to} of {totalItems}
      </span>
      <div>
        <button
          type="button"
          className="secondary-button compact-button"
          disabled={currentPage === 0}
          onClick={() => onPageChange(Math.max(0, currentPage - 1))}
        >
          Previous
        </button>
        <span className="page-count">
          Page {currentPage + 1} of {pageCount}
        </span>
        <button
          type="button"
          className="secondary-button compact-button"
          disabled={currentPage >= pageCount - 1}
          onClick={() => onPageChange(Math.min(pageCount - 1, currentPage + 1))}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
