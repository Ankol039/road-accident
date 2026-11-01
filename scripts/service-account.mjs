import { readFileSync } from 'node:fs'

/** Reject credentials for another project before any Admin SDK or REST calls. */
export function readServiceAccount(keyPath) {
  const { projects } = JSON.parse(
    readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8'),
  )
  const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'))
  if (!projects?.default || serviceAccount.project_id !== projects.default) {
    throw new Error(
      `Service-account project does not match ${projects?.default || 'the configured project'}. ` +
        'Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON for that project.',
    )
  }
  return serviceAccount
}
