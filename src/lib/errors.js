/**
 * Human-readable messages for Firebase / Firestore errors.
 *
 * The PHP API returned { success, message, errors }. The Firebase SDK throws
 * errors with a `code` instead, so this maps those codes onto the same style of
 * message the admin already saw.
 */

const AUTH_MESSAGES = {
  'auth/invalid-email': 'That email address is not valid.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'No account matches that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-login-credentials': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed': 'Network problem. Check your connection and try again.',
  'auth/email-already-in-use': 'That email is already registered.',
  'auth/weak-password': 'Choose a password with at least 8 characters.',
  'auth/requires-recent-login': 'Log in again before changing this.',
  'auth/operation-not-allowed':
    'Email/password sign-in is not enabled for this Firebase project.',
}

const FIRESTORE_MESSAGES = {
  'permission-denied': 'You do not have permission to do that.',
  'not-found': 'That record no longer exists.',
  'already-exists': 'A record with that ID already exists.',
  'resource-exhausted': 'Too many requests. Try again shortly.',
  'failed-precondition': 'That change conflicts with the current records.',
  unavailable: 'Cannot reach the server. Check your connection.',
  unauthenticated: 'Your session expired. Log in again.',
  'deadline-exceeded': 'The request took too long. Try again.',
  'invalid-argument': 'Some of the values submitted are not valid.',
}

/** Turn any thrown value into a message safe to show the user. */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback
  const code = error.code || ''
  if (AUTH_MESSAGES[code]) return AUTH_MESSAGES[code]
  if (FIRESTORE_MESSAGES[code]) return FIRESTORE_MESSAGES[code]
  if (error.message && typeof error.message === 'string') return error.message
  return fallback
}

/**
 * A field-level validation error, shaped like the PHP API's `errors` object.
 * Used by forms so they can highlight the offending inputs.
 */
export class ValidationError extends Error {
  constructor(errors) {
    super('Please correct the highlighted fields.')
    this.name = 'ValidationError'
    this.errors = errors || {}
  }
}

const notFound = 'not-found'

export const isNotFound = (error) => error?.code === notFound
export const isPermissionDenied = (error) => error?.code === 'permission-denied'
