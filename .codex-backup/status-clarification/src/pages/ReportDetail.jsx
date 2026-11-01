/**
 * One report, for administrators (review, verify, dispatch, flag, remarks).
 * Replaces legacy/js-release-20261020b/pages/report.js.
 *
 * The screen is read from three places:
 *   reports/{id}      the report itself, including status_history and remarks
 *   report_photos    one document per photo, base64 inside the document
 *   settings         arrival_match_radius_m, for the officer arrival check
 *
 * Every action goes through src/services/reports.service.js, which carries the
 * workflow rules from api/core/status.php, so the screen cannot step outside
 * the allowed status moves.
 */
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAsync, useToggle } from '../hooks/useAsync.js'
import { useActor } from '../hooks/useAuth.jsx'
import { useToast } from '../hooks/useToast.jsx'
import {
  getReport,
  listReportPhotos,
  allowedNextStatuses,
  assessArrival,
  updateStatus,
  assignOfficer,
  addRemark,
  setFlag,
  updateReport,
} from '../services/reports.service.js'
import { listUsers } from '../services/users.service.js'
import { listAccidentTypes } from '../services/settings.service.js'
import { readSetting } from '../lib/firestore.js'
import { errorMessage } from '../lib/errors.js'
import {
  INJURY_OPTIONS,
  PHOTO_CATEGORIES,
  REMARK_LABELS,
  STATUS_HELP,
  STATUS_LABELS,
} from '../lib/constants.js'
import { formatDate, formatDateTime, formatTime, isoDate } from '../utils/date.js'
import { place, vehicleSummary } from '../utils/format.js'
import StatusBadge, { RecordKind } from '../components/StatusBadge.jsx'
import { OnePinMap } from '../components/MapView.jsx'
import States from '../components/States.jsx'
import Modal from '../components/Modal.jsx'

/** These moves have their own panel, so they are not offered in the status form. */
const STATUS_FORM_HIDDEN = ['assigned', 'on_scene', 'verified']

/** What the note field asks for, depending on the status being chosen. */
const NOTE_LABELS = {
  duplicate: 'Reason both reports describe the same accident (link the original using Flag first)',
  rejected: 'Reason for rejecting (the reporter sees this)',
  info_required: 'What information is missing? (the reporter sees this)',
  resolved: 'Closing note (optional)',
}

const meters = (m) => (m == null ? 'unknown' : `${Math.round(m)} m`)

const injuryLabel = (value) =>
  INJURY_OPTIONS.find((o) => o.value === value)?.label || value || '—'

export default function ReportDetail() {
  const { id } = useParams()
  const actor = useActor()
  const toast = useToast()

  const [action, setAction] = useState({ key: null, busy: false, error: null, errors: {} })
  const [statusChoice, setStatusChoice] = useState('')
  const [remarkType, setRemarkType] = useState('remark')
  const [editOpen, setEditOpen] = useState(false)
  const [showSensitive, toggleSensitive] = useToggle(false)

  const { data, loading, error, reload } = useAsync(
    async () => {
      const [report, photos, radius] = await Promise.all([
        getReport(id),
        listReportPhotos(id),
        readSetting('arrival_match_radius_m', 120),
      ])
      if (!report) throw new Error('Report not found')
      return { report, photos, radius: Number(radius) || 120 }
    },
    [id],
    null,
  )

  // The officer directory is only needed by the dispatch panel, so it loads on
  // its own: a failure there must not blank out the report.
  const { data: officers, error: officersError } = useAsync(
    () => listUsers({ role: 'officer', status: 'active' }),
    [],
    [],
  )

  const report = data?.report
  const photos = data?.photos || []
  const arrival = useMemo(
    () => (report ? assessArrival(report, data.radius) : null),
    [report, data?.radius],
  )

  /** Run one workflow action, showing its error on the panel that started it. */
  const run = async (key, action_, message) => {
    setAction({ key, busy: true, error: null, errors: {} })
    try {
      await action_()
      toast.success(message)
      setAction({ key: null, busy: false, error: null, errors: {} })
      reload()
      return true
    } catch (err) {
      setAction({
        key,
        busy: false,
        error: err?.errors ? err.message : errorMessage(err),
        errors: err?.errors || {},
      })
      return false
    }
  }

  const panelError = (key) =>
    action.key === key && action.error ? (
      <div className="alert alert-danger" role="alert">
        {action.error}
      </div>
    ) : null

  const fieldError = (key, field) =>
    action.key === key && action.errors?.[field] ? (
      <div className="invalid-feedback d-block">{action.errors[field]}</div>
    ) : null

  const official = ['verified', 'in_progress', 'resolved'].includes(report?.status)

  return (
    <>
      <Link to="/admin/reports" className="small">
        Back to reports
      </Link>

      <States loading={loading} error={error} empty={!report}>
        {report && (
          <>
            <div className="d-flex flex-wrap align-items-center gap-3 mt-2 mb-1">
              <h1 className="h3 mb-0">{report.report_code || 'Report'}</h1>
              <StatusBadge status={report.status} />
              <RecordKind official={official} />
            </div>
            <p className="text-secondary mb-1">
              Submitted {formatDateTime(report.created_at)}
            </p>
            <p className="status-help">{STATUS_HELP[report.status] || ''}</p>

            {report.status === 'rejected' && report.rejection_reason ? (
              <div className="alert alert-danger">Rejected: {report.rejection_reason}</div>
            ) : null}

            {report.status === 'duplicate' ? (
              <div className="alert alert-secondary">
                <strong>Disregarded as a duplicate</strong> of{' '}
                {report.duplicate_of ? (
                  <Link to={`/admin/reports/${report.duplicate_of}`}>
                    {report.duplicate_of_code || 'the earlier report'}
                  </Link>
                ) : (
                  'the earlier report'
                )}
                : that report was received first and is still open.
              </div>
            ) : null}

            {report.flagged ? (
              <div className="alert alert-warning">
                Flagged: {report.flag_reason}
                {report.duplicate_of && report.status !== 'duplicate' ? (
                  <>
                    {' '}
                    (<Link to={`/admin/reports/${report.duplicate_of}`}>see the earlier report</Link>)
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="row g-4">
              {/* ---------- the report itself ---------- */}
              <div className="col-lg-7 stack">
                <section className="panel">
                  <div className="d-flex justify-content-between align-items-start gap-2">
                    <h2 className="h5">Accident details</h2>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => setEditOpen(true)}
                    >
                      Edit details
                    </button>
                  </div>
                  <dl className="review-list">
                    <dt>Date and time</dt>
                    <dd>
                      {formatDate(report.accident_date)} at {formatTime(report.accident_time)}
                    </dd>
                    <dt>Type</dt>
                    <dd>{report.accident_type_name || report.accident_type_id || '—'}</dd>
                    <dt>Injuries</dt>
                    <dd>{injuryLabel(report.injury_status)}</dd>
                    <dt>Vehicles</dt>
                    <dd>{vehicleSummary(report.vehicles)}</dd>
                    <dt>Location</dt>
                    <dd>{place(report) || '—'}</dd>
                    {report.latitude != null ? (
                      <>
                        <dt>Reporter's pin</dt>
                        <dd>
                          {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
                          {report.gps_accuracy_m != null ? (
                            <span className="small text-secondary">
                              (phone GPS ±{Math.round(report.gps_accuracy_m)} m)
                            </span>
                          ) : null}{' '}
                          <a
                            className="small"
                            target="_blank"
                            rel="noopener"
                            href={`https://www.openstreetmap.org/?mlat=${report.latitude}&mlon=${report.longitude}#map=18/${report.latitude}/${report.longitude}`}
                          >
                            open map
                          </a>
                        </dd>
                      </>
                    ) : null}
                    <dt>What happened</dt>
                    <dd className="pre-wrap">{report.description || '—'}</dd>
                    {report.reporter_name ? (
                      <>
                        <dt>Reporter</dt>
                        <dd>{report.reporter_name}</dd>
                      </>
                    ) : null}
                    {report.officer_name ? (
                      <>
                        <dt>Assigned officer</dt>
                        <dd>
                          {report.officer_name}
                          {report.officer_badge_no ? ` (${report.officer_badge_no})` : ''}
                        </dd>
                      </>
                    ) : null}
                    {arrival?.distance_m != null ? (
                      <>
                        <dt>Officer arrival</dt>
                        <dd>
                          {formatDateTime(arrival.at)}, {meters(arrival.distance_m)} from the pin
                          {arrival.count > 1 ? ` (arrival #${arrival.count})` : ''}
                        </dd>
                      </>
                    ) : null}
                    {report.verified_by_name ? (
                      <>
                        <dt>Verified by</dt>
                        <dd>
                          {report.verified_by_name} · {formatDateTime(report.verified_at)}
                        </dd>
                      </>
                    ) : null}
                  </dl>
                </section>

                {report.latitude != null ? (
                  <section className="panel">
                    <h2 className="h5">
                      {arrival?.distance_m != null
                        ? 'Map: reporter pin and officer arrival'
                        : 'Map'}
                    </h2>
                    <OnePinMap report={report} height={arrival?.distance_m != null ? 320 : 260} />
                    {arrival?.distance_m != null ? (
                      <p className="small text-secondary mt-2 mb-0">
                        Blue pin: reporter. Round marker: officer's &quot;I've arrived&quot; location.
                        Match distance: {Math.round(arrival.radius_m)} m.
                      </p>
                    ) : null}
                  </section>
                ) : null}

                <PhotoEvidence photos={photos} showSensitive={showSensitive} toggleSensitive={toggleSensitive} />
              </div>

              {/* ---------- what the administrator can do ---------- */}
              <div className="col-lg-5 stack">
                {report.status === 'on_scene' && arrival ? (
                  <ArrivalCheck
                    report={report}
                    arrival={arrival}
                    actor={actor}
                    action={action}
                    panelError={panelError}
                    fieldError={fieldError}
                    run={run}
                  />
                ) : null}

                <StatusPanel
                  report={report}
                  statusChoice={statusChoice}
                  setStatusChoice={setStatusChoice}
                  actor={actor}
                  action={action}
                  panelError={panelError}
                  fieldError={fieldError}
                  run={run}
                />

                <DispatchPanel
                  report={report}
                  officers={officers || []}
                  officersError={officersError}
                  actor={actor}
                  action={action}
                  panelError={panelError}
                  fieldError={fieldError}
                  run={run}
                />

                <RemarkPanel
                  report={report}
                  remarkType={remarkType}
                  setRemarkType={setRemarkType}
                  actor={actor}
                  action={action}
                  panelError={panelError}
                  fieldError={fieldError}
                  run={run}
                />

                <FlagPanel
                  report={report}
                  actor={actor}
                  action={action}
                  panelError={panelError}
                  fieldError={fieldError}
                  run={run}
                />

                <section className="panel">
                  <h2 className="h5">Status history</h2>
                  <Timeline history={report.status_history} />
                </section>

                {report.remarks?.length ? (
                  <section className="panel">
                    <h2 className="h5">Remarks and findings</h2>
                    <ul className="list-plain mb-0">
                      {report.remarks.map((remark, index) => (
                        <li key={`${remark.at}-${index}`} className="py-2 border-bottom">
                          <span className="small text-secondary">
                            {REMARK_LABELS[remark.type] || remark.type}
                            {remark.is_internal ? ', internal (reporter cannot see it)' : ''}
                          </span>
                          <p className="mb-0 pre-wrap">{remark.content}</p>
                          <span className="small text-secondary">
                            {remark.by || ''}, {formatDateTime(remark.at)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            </div>

            <EditDialog
              open={editOpen}
              onClose={() => setEditOpen(false)}
              report={report}
              actor={actor}
              action={action}
              panelError={panelError}
              run={run}
              onSaved={() => {
                setEditOpen(false)
                reload()
              }}
            />
          </>
        )}
      </States>
    </>
  )
}

/* ---------- the officer has arrived: compare his GPS with the reporter's pin ---------- */

function ArrivalCheck({ report, arrival, actor, action, panelError, fieldError, run }) {
  const radius = Math.round(arrival.radius_m)
  const busy = action.key === 'arrival' && action.busy

  return (
    <section className={`panel arrival-check ${arrival.matches ? 'is-match' : 'is-mismatch'}`}>
      <h2 className="h5">Officer arrival check</h2>
      {arrival.review_required ? (
        <p className="small">
          GPS readings need evidence review; distance alone does not verify an accident.
        </p>
      ) : null}
      <p className="verdict">
        {arrival.matches ? 'Pins are within the configured radius' : 'Pins need review'}
      </p>
      <p className="mb-1">
        {arrival.officer_name || 'The officer'} is{' '}
        <strong>{meters(arrival.distance_m)}</strong> from the reporter's pin (match distance:{' '}
        {radius} m).
      </p>
      <p className="small text-secondary">
        GPS accuracy: officer{' '}
        {arrival.officer_accuracy_m != null ? `±${Math.round(arrival.officer_accuracy_m)} m` : 'not sent'},
        reporter{' '}
        {arrival.reporter_accuracy_m != null
          ? `±${Math.round(arrival.reporter_accuracy_m)} m`
          : 'not sent'}
        . Arrived {formatDateTime(arrival.at)}
        {arrival.count > 1 ? `, arrival #${arrival.count}` : ''}. Compare the photos with the map
        before you decide.
      </p>

      {panelError('arrival')}

      <form
        className="mb-3"
        onSubmit={(event) => {
          event.preventDefault()
          const note = event.target.note.value.trim()
          run(
            'arrival',
            () =>
              updateStatus(report.id, 'verified', {
                note: note || null,
                actor: actor,
              }),
            'Approved. The officer was told to clear the site.',
          )
        }}
      >
        {arrival.matches ? null : (
          <p className="small mb-2">
            The pins are outside {radius} m. Review the GPS accuracy and evidence, then record your
            reason to approve or request a new arrival.
          </p>
        )}
        <label className="form-label small" htmlFor="approve-note">
          {arrival.review_required
            ? 'Evidence checked and approval reason (required)'
            : 'Review note (optional)'}
        </label>
        <input
          id="approve-note"
          name="note"
          className="form-control mb-2"
          placeholder="Plate and vehicles match the photos"
        />
        {fieldError('arrival', 'note')}
        <button className="btn btn-guide w-100" type="submit" disabled={busy}>
          {busy ? 'Approving…' : 'Approve: officer may clear the site'}
        </button>
      </form>

      <form
        className="mb-3"
        onSubmit={(event) => {
          event.preventDefault()
          const note = event.target.note.value.trim()
          run(
            'arrival',
            () => updateStatus(report.id, 'assigned', { note, actor: actor }),
            'The officer was asked to send the arrival again',
          )
        }}
      >
        <label className="form-label small" htmlFor="resend-note">
          Ask the officer to resend his arrival
        </label>
        <textarea
          id="resend-note"
          name="note"
          rows={2}
          className="form-control mb-2"
          placeholder="Go to the pinned spot near the market entrance, then tap I've arrived again."
        />
        <button className="btn btn-outline-guide w-100" type="submit" disabled={busy}>
          Ask officer to resend
        </button>
      </form>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          const reason = event.target.note.value.trim()
          run(
            'arrival',
            () =>
              updateStatus(report.id, 'rejected', {
                reason,
                note: reason,
                actor: actor,
              }),
            'Report closed as rejected',
          )
        }}
      >
        <label className="form-label small" htmlFor="false-reason">
          Reject report after evidence review
        </label>
        <input
          id="false-reason"
          name="note"
          className="form-control mb-2"
          placeholder="Explain the evidence supporting rejection"
        />
        {fieldError('arrival', 'reason')}
        <button className="btn btn-outline-danger w-100" type="submit" disabled={busy}>
          Reject as false report
        </button>
      </form>
    </section>
  )
}

/* ---------- the status workflow ---------- */

function StatusPanel({ report, statusChoice, setStatusChoice, actor, action, panelError, fieldError, run }) {
  if (report.status === 'on_scene') return null

  const busy = action.key === 'status' && action.busy

  if (report.status === 'duplicate') {
    return (
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault()
          const note = event.target.note.value.trim()
          run(
            'status',
            () => updateStatus(report.id, 'submitted', { note, actor: actor }),
            'Report restored to the queue',
          )
        }}
      >
        <h2 className="h5">Not a duplicate?</h2>
        {panelError('status')}
        <p className="small text-secondary">
          If this is a different accident (for example another crash at the same corner), put it
          back in the queue as a new report.
        </p>
        <label className="form-label" htmlFor="restore-note">
          Why it is not a duplicate
        </label>
        <textarea id="restore-note" name="note" rows={2} className="form-control mb-3" />
        {fieldError('status', 'note')}
        <button className="btn btn-outline-guide" type="submit" disabled={busy}>
          Restore as a new report
        </button>
      </form>
    )
  }

  const options = allowedNextStatuses(report).filter((s) => !STATUS_FORM_HIDDEN.includes(s))
  const waiting = report.status === 'assigned'
    ? `Waiting for ${report.officer_name || 'the officer'} to reach the pin and tap "I've arrived" in the app. You will get a notification.`
    : ''
  const clearing = ['verified', 'in_progress'].includes(report.status)
    ? `${report.officer_name || 'The officer'} clears the site and closes the report in the app. You can also close it here.`
    : ''

  if (!options.length) {
    return (
      <section className="panel">
        <h2 className="h5">Update status</h2>
        {waiting ? <p className="small">{waiting}</p> : null}
        {clearing ? <p className="small">{clearing}</p> : null}
        {!waiting && !clearing ? (
          <p className="text-secondary mb-0">No further status changes on this report.</p>
        ) : null}
      </section>
    )
  }

  return (
    <form
      className="panel"
      onSubmit={(event) => {
        event.preventDefault()
        const note = event.target.note.value.trim()
        run(
          'status',
          () =>
            updateStatus(report.id, statusChoice, {
              note: note || null,
              reason: statusChoice === 'rejected' ? note : null,
              actor: actor,
            }),
          'Status updated',
        )
      }}
    >
      <h2 className="h5">Update status</h2>
      {waiting ? <p className="small">{waiting}</p> : null}
      {clearing ? <p className="small">{clearing}</p> : null}
      {['submitted', 'under_review'].includes(report.status) ? (
        <p className="small text-secondary">
          Next step: send the pin to a traffic officer (Dispatch an officer, below).
        </p>
      ) : null}
      {panelError('status')}
      <label className="form-label" htmlFor="next-status">
        Change to
      </label>
      <select
        id="next-status"
        name="status"
        className="form-select mb-2"
        required
        value={statusChoice}
        onChange={(event) => setStatusChoice(event.target.value)}
      >
        <option value="">Choose…</option>
        {options.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      {fieldError('status', 'status')}
      <label className="form-label" htmlFor="status-note">
        {NOTE_LABELS[statusChoice] || 'Note (optional)'}
      </label>
      <textarea id="status-note" name="note" rows={2} className="form-control mb-3" />
      {fieldError('status', 'note')}
      <button className="btn btn-guide" type="submit" disabled={busy || !statusChoice}>
        {busy ? 'Saving…' : 'Save status'}
      </button>
    </form>
  )
}

/* ---------- dispatch: send the pin to a traffic officer ---------- */

function DispatchPanel({ report, officers, officersError, actor, action, panelError, fieldError, run }) {
  const dispatch = ['submitted', 'under_review'].includes(report.status)
  const reassign = ['assigned', 'verified', 'in_progress'].includes(report.status)
  if (!dispatch && !reassign) return null

  const busy = action.key === 'assign' && action.busy

  return (
    <form
      className="panel"
      onSubmit={(event) => {
        event.preventDefault()
        const officer = officers.find((o) => o.id === event.target.officer_id.value)
        run(
          'assign',
          () =>
            assignOfficer(report.id, officer, {
              note: event.target.note.value.trim() || null,
              actor: actor,
            }),
          dispatch ? 'Officer assigned' : 'Officer changed',
        )
      }}
    >
      <h2 className="h5">{dispatch ? 'Dispatch an officer' : 'Change the assigned officer'}</h2>
      {dispatch ? (
        <p className="small text-secondary">
          The officer gets the pin in the app, goes to the scene and taps &quot;I've arrived&quot;.
        </p>
      ) : null}
      {panelError('assign')}

      {officersError ? (
        <p className="small text-secondary">
          The officer list could not be loaded. Deploy the Firestore indexes to enable it.
        </p>
      ) : null}

      <label className="form-label" htmlFor="officer">
        Traffic officer
      </label>
      <select id="officer" name="officer_id" className="form-select mb-2" required defaultValue="">
        <option value="">Choose…</option>
        {officers
          .filter((o) => o.id !== report.officer_id)
          .map((o) => (
            <option key={o.id} value={o.id}>
              {o.full_name} ({o.badge_no || 'no badge'})
            </option>
          ))}
      </select>
      {fieldError('assign', 'officer_id')}
      <label className="form-label" htmlFor="assign-note">
        Instructions for the officer (optional)
      </label>
      <textarea id="assign-note" name="note" rows={2} className="form-control mb-3" />
      <button className="btn btn-guide" type="submit" disabled={busy || Boolean(officersError)}>
        {busy ? 'Sending…' : dispatch ? 'Send the pin to this officer' : 'Change officer'}
      </button>
    </form>
  )
}

/* ---------- remarks, findings, actions taken ---------- */

function RemarkPanel({ report, remarkType, setRemarkType, actor, action, panelError, fieldError, run }) {
  const busy = action.key === 'remark' && action.busy

  return (
    <form
      className="panel"
      onSubmit={(event) => {
        event.preventDefault()
        const content = event.target.content.value.trim()
        const isInternal = event.target.is_internal.checked
        run(
          'remark',
          () =>
            addRemark(
              report.id,
              { type: remarkType, content, is_internal: isInternal },
              actor,
            ),
          'Remark added',
        )
      }}
    >
      <h2 className="h5">Add a remark, finding or action</h2>
      {panelError('remark')}
      <div className="choice-row mb-2" role="radiogroup" aria-label="Kind">
        {Object.entries(REMARK_LABELS).map(([value, label]) => (
          <label key={value} className={`choice${remarkType === value ? ' is-picked' : ''}`}>
            <input
              type="radio"
              name="type"
              value={value}
              checked={remarkType === value}
              onChange={() => setRemarkType(value)}
            />{' '}
            {label}
          </label>
        ))}
      </div>
      <textarea
        name="content"
        rows={3}
        className="form-control mb-2"
        aria-label="Text"
        placeholder="Example: Plate in the photo matches the vehicle at the scene."
      />
      {fieldError('remark', 'content')}
      <div className="form-check mb-3">
        <input className="form-check-input" type="checkbox" name="is_internal" id="is-internal" defaultChecked />
        <label className="form-check-label" htmlFor="is-internal">
          Internal only (the reporter will not see it)
        </label>
      </div>
      <button className="btn btn-guide" type="submit" disabled={busy}>
        {busy ? 'Adding…' : 'Add'}
      </button>
    </form>
  )
}

/* ---------- flag incomplete or duplicate by hand ---------- */

function FlagPanel({ report, actor, action, panelError, fieldError, run }) {
  if (['duplicate', 'resolved', 'rejected'].includes(report.status) && !report.flagged) return null

  const busy = action.key === 'flag' && action.busy

  if (report.flagged) {
    return (
      <form
        className="panel"
        onSubmit={(event) => {
          event.preventDefault()
          run('flag', () => setFlag(report.id, false, { actor: actor }), 'Flag removed')
        }}
      >
        <h2 className="h5">Flag</h2>
        {panelError('flag')}
        <p className="mb-2">This report is flagged: {report.flag_reason}</p>
        <button className="btn btn-outline-secondary" type="submit" disabled={busy}>
          Remove flag
        </button>
      </form>
    )
  }

  return (
    <form
      className="panel"
      onSubmit={(event) => {
        event.preventDefault()
        run(
          'flag',
          () =>
            setFlag(report.id, true, {
              reason: event.target.reason.value.trim() || null,
              duplicate_of: event.target.duplicate_of.value.trim() || null,
              actor: actor,
            }),
          'Report flagged',
        )
      }}
    >
      <h2 className="h5">Flag as incomplete or duplicate</h2>
      {panelError('flag')}
      <p className="small text-secondary">
        Flag a possible duplicate for review. Link the original report here, then use Update status
        to confirm Duplicate with a reason.
      </p>
      <label className="form-label" htmlFor="flag-reason">
        Reason
      </label>
      <input
        id="flag-reason"
        name="reason"
        className="form-control mb-2"
        list="flag-reasons"
        placeholder="Incomplete details"
      />
      <datalist id="flag-reasons">
        <option value="Incomplete details" />
        <option value="Duplicate of another report" />
        <option value="Location cannot be confirmed" />
      </datalist>
      {fieldError('flag', 'reason')}
      <label className="form-label" htmlFor="flag-dup">
        Duplicate of (report ID, optional)
      </label>
      <input
        id="flag-dup"
        name="duplicate_of"
        className="form-control mb-3"
        placeholder="RA-2026-000012"
      />
      {fieldError('flag', 'duplicate_of')}
      <button className="btn btn-outline-danger" type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Flag report'}
      </button>
    </form>
  )
}

/* ---------- photo evidence, one section per kind of proof ---------- */

function PhotoEvidence({ photos, showSensitive, toggleSensitive }) {
  const sections = PHOTO_CATEGORIES.map((category) => {
    const list = photos.filter((p) => p.category === category.key)
    return { ...category, list }
  }).filter((section) => section.list.length || section.required)

  if (!sections.length) {
    return (
      <section className="panel">
        <h2 className="h5">Photo evidence</h2>
        <p className="text-secondary mb-0">No photos were attached.</p>
      </section>
    )
  }

  return (
    <section className="panel">
      <h2 className="h5">Photo evidence</h2>
      {sections.map((section) => (
        <div
          key={section.key}
          className={`photo-section${section.sensitive ? ' is-sensitive' : ''}${
            showSensitive ? ' is-revealed' : ''
          }`}
        >
          <div className="d-flex flex-wrap justify-content-between align-items-baseline gap-2">
            <h3 className="h6 mb-1">
              {section.label}{' '}
              <span className="small text-secondary fw-normal">
                {section.required ? 'required' : 'optional'}
              </span>
            </h3>
            <span className="small text-secondary">{section.list.length} photo(s)</span>
          </div>

          {section.hint ? <p className="small text-secondary mb-1">{section.hint}</p> : null}

          {section.sensitive ? (
            <>
              {section.privacy_note ? (
                <p className="privacy-note">{section.privacy_note}</p>
              ) : null}
              {section.list.length ? (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary mb-2"
                  onClick={toggleSensitive}
                >
                  {showSensitive ? 'Hide sensitive photos' : 'Show sensitive photos'}
                </button>
              ) : null}
            </>
          ) : null}

          {section.list.length ? (
            <div className="photo-grid">
              {section.list.map((photo, index) => (
                <figure className="photo-item" key={photo.id || index}>
                  <a
                    href={photoSrc(photo)}
                    target="_blank"
                    rel="noopener"
                    className="photo-tile"
                    title="Open full size"
                  >
                    <img
                      src={photoSrc(photo)}
                      alt={`${section.label}, photo ${index + 1}`}
                      loading="lazy"
                    />
                  </a>
                  <figcaption>
                    {photo.source === 'camera' ? (
                      <span className="src-badge src-camera">Taken with camera</span>
                    ) : photo.source === 'gallery' ? (
                      <span className="src-badge src-gallery">From gallery</span>
                    ) : null}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="missing-photo mb-0">No photo was sent for this section.</p>
          )}
        </div>
      ))}
    </section>
  )
}

/* ---------- the status timeline ---------- */

function Timeline({ history }) {
  const entries = Array.isArray(history) ? history : []
  if (!entries.length) return <p className="text-secondary">No status changes yet.</p>

  return (
    <ol className="timeline">
      {entries.map((entry, index) => (
        <li key={`${entry.at}-${index}`} className={index === entries.length - 1 ? 'is-current' : ''}>
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <StatusBadge status={entry.status} />
            <time className="small text-secondary">{formatDateTime(entry.at)}</time>
          </div>
          {entry.note ? <p className="mb-0 mt-1">{entry.note}</p> : null}
          <p className="small text-secondary mb-0">
            {entry.by ? `by ${entry.by}` : 'by the system'}
          </p>
        </li>
      ))}
    </ol>
  )
}

/* ---------- admin: edit the accident details ---------- */

function EditDialog({ open, onClose, report, actor, action, panelError, run, onSaved }) {
  const { data: types } = useAsync(() => listAccidentTypes(), [], [])
  const [vehicles, setVehicles] = useState(
    (report.vehicles || []).map((v) => `${v.quantity ?? 1} ${v.type}`).join('\n'),
  )

  const submit = (event) => {
    event.preventDefault()
    const form = event.target
    const parsed = vehicles
      .split('\n')
      .map((line) => line.trim().match(/^(\d+)\s+(.+)$/) || (line.trim() ? [null, '1', line.trim()] : null))
      .filter(Boolean)
      .map(([, quantity, type]) => ({ type, quantity: Number(quantity) }))

    run(
      'edit',
      () =>
        updateReport(
          report.id,
          {
            accident_date: form.accident_date.value,
            accident_time: form.accident_time.value,
            accident_type_id: form.accident_type_id.value,
            injury_status: form.injury_status.value,
            location_text: form.location_text.value,
            barangay: form.barangay.value,
            municipality: form.municipality.value,
            latitude: form.latitude.value === '' ? null : Number(form.latitude.value),
            longitude: form.longitude.value === '' ? null : Number(form.longitude.value),
            vehicles: parsed,
            description: form.description.value,
          },
          actor,
        ),
      'Details saved',
    ).then((saved) => {
      if (saved) onSaved()
    })
  }

  return (
    <Modal
      open={open}
      title={`Edit ${report.report_code || 'report'}`}
      onClose={onClose}
      size="lg"
    >
      <form onSubmit={submit}>
        {panelError('edit')}
        <div className="row g-3">
          <div className="col-sm-6">
            <label className="form-label" htmlFor="e-date">
              Accident date
            </label>
            <input
              id="e-date"
              type="date"
              name="accident_date"
              className="form-control"
              defaultValue={isoDate(report.accident_date)}
            />
          </div>
          <div className="col-sm-6">
            <label className="form-label" htmlFor="e-time">
              Time
            </label>
            <input
              id="e-time"
              type="time"
              name="accident_time"
              className="form-control"
              defaultValue={report.accident_time || ''}
            />
          </div>
          <div className="col-sm-6">
            <label className="form-label" htmlFor="e-type">
              Type
            </label>
            <select
              id="e-type"
              name="accident_type_id"
              className="form-select"
              defaultValue={report.accident_type_id || ''}
            >
              {(types || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="col-sm-6">
            <label className="form-label" htmlFor="e-injury">
              Injuries
            </label>
            <select
              id="e-injury"
              name="injury_status"
              className="form-select"
              defaultValue={report.injury_status || ''}
            >
              {INJURY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="e-loc">
              Road, street or landmark
            </label>
            <input
              id="e-loc"
              name="location_text"
              className="form-control"
              defaultValue={report.location_text || ''}
            />
          </div>
          <div className="col-sm-6">
            <label className="form-label" htmlFor="e-brgy">
              Barangay
            </label>
            <input
              id="e-brgy"
              name="barangay"
              className="form-control"
              defaultValue={report.barangay || ''}
            />
          </div>
          <div className="col-sm-6">
            <label className="form-label" htmlFor="e-mun">
              Municipality
            </label>
            <input
              id="e-mun"
              name="municipality"
              className="form-control"
              defaultValue={report.municipality || ''}
            />
          </div>
          <div className="col-sm-6">
            <label className="form-label" htmlFor="e-lat">
              Latitude
            </label>
            <input
              id="e-lat"
              name="latitude"
              className="form-control"
              inputMode="decimal"
              defaultValue={report.latitude ?? ''}
            />
          </div>
          <div className="col-sm-6">
            <label className="form-label" htmlFor="e-lng">
              Longitude
            </label>
            <input
              id="e-lng"
              name="longitude"
              className="form-control"
              inputMode="decimal"
              defaultValue={report.longitude ?? ''}
            />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="e-veh">
              Vehicles (one per line, e.g. &quot;2 Car&quot;)
            </label>
            <textarea
              id="e-veh"
              name="vehicles"
              rows={2}
              className="form-control"
              value={vehicles}
              onChange={(event) => setVehicles(event.target.value)}
            />
          </div>
          <div className="col-12">
            <label className="form-label" htmlFor="e-desc">
              What happened
            </label>
            <textarea
              id="e-desc"
              name="description"
              rows={4}
              className="form-control"
              defaultValue={report.description || ''}
            />
          </div>
        </div>
        <p className="small text-secondary mt-2 mb-0">
          The old and new values are saved in the audit trail.
        </p>
        <div className="d-flex justify-content-end gap-2 mt-3">
          <button type="button" className="btn btn-outline-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-guide" disabled={action.key === 'edit' && action.busy}>
            {action.key === 'edit' && action.busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** The photo bytes live inside the document as base64. */
const photoSrc = (photo) =>
  photo?.data ? `data:${photo.mime || 'image/jpeg'};base64,${photo.data}` : ''
