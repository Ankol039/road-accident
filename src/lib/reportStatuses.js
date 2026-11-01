/** Shared report vocabulary and workflow. Stored codes remain compatible with old reports. */
export const REPORT_STATUS_DEFINITIONS = {
  submitted: {
    label: 'Awaiting review', definition: 'The report is queued for administrator review, including reports restored from Duplicate.',
    color: '#6c757d', stage: 'Received', next: ['under_review', 'assigned', 'rejected', 'duplicate'],
    action: 'Restore to review queue', open: true, dispatchable: true,
  },
  under_review: {
    label: 'In review', definition: 'An administrator has started reviewing the report.',
    color: '#1f4f8a', stage: 'Review', next: ['info_required', 'assigned', 'rejected', 'duplicate'],
    action: 'Start review', open: true, dispatchable: true,
  },
  info_required: {
    label: 'Awaiting reporter', definition: 'Review is paused pending specified information from the reporter.',
    color: '#b38600', stage: 'Review', next: ['under_review', 'rejected'],
    action: 'Request reporter information', open: true, noteLabel: 'What information is missing? (the reporter can read this)',
  },
  assigned: {
    label: 'Dispatched', definition: 'An officer is assigned and instructed to attend; an accepted arrival submission is still pending.',
    color: '#43378c', stage: 'Response', next: ['on_scene', 'rejected'],
    action: 'Dispatch officer', panel: 'dispatch', open: true, officerActive: true, reassignable: true,
  },
  on_scene: {
    label: 'Arrival reported', definition: 'The officer submitted arrival details that await administrator approval.',
    color: '#0b6e8a', stage: 'Response', next: ['verified', 'assigned', 'rejected'],
    action: 'Record arrival', panel: 'arrivalSubmission', open: true, officerActive: true, reassignmentLocked: true,
  },
  verified: {
    label: 'Clearance approved', definition: 'An administrator approved the arrival and evidence and authorized clearing the site.',
    color: '#0b5039', stage: 'Response', next: ['in_progress', 'resolved'],
    action: 'Approve clearance', panel: 'arrivalApproval', open: true, officerActive: true, official: true, reassignmentLocked: true,
  },
  in_progress: {
    label: 'Clearing site', definition: 'Site-clearing work has been recorded as started.',
    color: '#c4610f', stage: 'Response', next: ['resolved'],
    action: 'Start clearing', open: true, officerActive: true, official: true, reassignmentLocked: true,
  },
  resolved: {
    label: 'Site cleared', definition: 'Site clearing has been recorded as complete.',
    color: '#0f6b4c', stage: 'Done', next: [], action: 'Mark site cleared', official: true,
    noteLabel: 'Site-clearing note (optional)',
  },
  rejected: {
    label: 'Rejected', definition: 'An administrator declined further handling of the report and recorded why.',
    color: '#c8322b', stage: 'Excluded', next: [], action: 'Reject report',
    noteLabel: 'Reason for rejection (the reporter can read this)',
  },
  duplicate: {
    label: 'Duplicate', definition: 'An administrator confirmed that this report describes the same incident as a linked original; a link and explanation are required.',
    color: '#a0a5aa', stage: 'Excluded', next: ['submitted'], action: 'Confirm duplicate',
    noteLabel: 'Explain why both reports describe the same incident (link the original using Flag first)',
  },
}
for (const [code, definition] of Object.entries(REPORT_STATUS_DEFINITIONS)) {
  definition.code = code
  definition.badgeClass = `status-${code}`
  Object.freeze(definition.next)
  Object.freeze(definition)
}
Object.freeze(REPORT_STATUS_DEFINITIONS)

export const REPORT_STATUSES = Object.freeze(Object.keys(REPORT_STATUS_DEFINITIONS))
const project = (key) => Object.freeze(Object.fromEntries(REPORT_STATUSES.map((code) => [code, REPORT_STATUS_DEFINITIONS[code][key]])))
export const STATUS_LABELS = project('label')
export const STATUS_HELP = project('definition')
export const STATUS_COLORS = project('color')
export const STATUS_TRANSITIONS = project('next')
const matching = (key) => Object.freeze(REPORT_STATUSES.filter((code) => REPORT_STATUS_DEFINITIONS[code][key]))
export const OFFICIAL_STATUSES = matching('official')
export const OPEN_STATUSES = matching('open')
export const OFFICER_ACTIVE_STATUSES = matching('officerActive')
export const STATUS_FORM_HIDDEN = matching('panel')
export const SPECIAL_ENDPOINT_STATUSES = Object.freeze(Object.fromEntries(
  REPORT_STATUSES.filter((code) => ['dispatch', 'arrivalSubmission'].includes(REPORT_STATUS_DEFINITIONS[code].panel))
    .map((code) => [code, REPORT_STATUS_DEFINITIONS[code].action]),
))
export const OFFICIAL_RECORDS_LABEL = 'Official records'
export const OFFICIAL_RECORDS_HELP = `${OFFICIAL_RECORDS_LABEL}: includes ${OFFICIAL_STATUSES.map((code) => STATUS_LABELS[code]).join(', ').replace(/, ([^,]*)$/, ' and $1')}`
export const FLAGGED_HELP = 'Marked for administrator attention; does not change report status'
export const REASSIGNMENT_HELP = 'Changing officers is disabled after arrival or clearance approval because the recorded arrival and approval belong to the current officer.'
export const statusDefinition = (code) => REPORT_STATUS_DEFINITIONS[code]
export const statusLabel = (code) => STATUS_LABELS[code] || code || 'Unknown status'
export const statusAction = (code, from) => from === 'on_scene' && code === 'assigned'
  ? 'Request arrival again' : REPORT_STATUS_DEFINITIONS[code]?.action || statusLabel(code)

/** Translate structured report status values only; never search/replace historical prose. */
export function structuredStatusText(details) {
  if (!details || typeof details !== 'object') return ''
  const pairs = details.changed?.status
  if (pairs && typeof pairs === 'object' && 'to' in pairs) {
    return `${statusLabel(pairs.from)} → ${statusLabel(pairs.to)}`
  }
  const to = details.to_status ?? details.to ?? details.status
  const from = details.from_status ?? details.from
  return typeof to === 'string' ? `${from ? `${statusLabel(from)} → ` : ''}${statusLabel(to)}` : ''
}
