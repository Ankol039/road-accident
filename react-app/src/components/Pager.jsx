/**
 * Pager used by the reports, users and audit tables.
 * Mirrors the [data-pager] markup from js/ui.js.
 */
import { pageSummary } from '../utils/format.js'

export default function Pager({ page, totalPages, total, onPage, onPrev, onNext, hasPrev, hasNext }) {
  return (
    <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mt-3">
      <span className="text-secondary small">{pageSummary(total ?? totalPages, page, totalPages)}</span>
      <div className="btn-group">
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          disabled={!hasPrev}
          onClick={onPrev}
        >
          Previous
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary"
          disabled={!hasNext}
          onClick={onNext}
        >
          Next
        </button>
      </div>
    </div>
  )
}
