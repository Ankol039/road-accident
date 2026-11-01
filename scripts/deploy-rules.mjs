/**
 * Deploys firestore.rules to the live project.
 *
 * The firebase CLI needs a user login (and a serviceusage permission the
 * service account does not have), so we talk to the Firebase Rules REST API
 * directly with the service-account credentials instead:
 *
 *   1. POST /v1/projects/{p}/rulesets   -> creates an immutable ruleset
 *   2. POST /v1/projects/{p}/releases   -> points "cloud.firestore" at it
 *
 * USAGE
 *   node scripts/deploy-rules.mjs
 *   node scripts/deploy-rules.mjs --dry-run
 */
import { readServiceAccount } from './service-account.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GoogleAuth } from 'google-auth-library'

const here = dirname(fileURLToPath(import.meta.url))
const candidates = [
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  resolve(here, '../../private/firebase-service-account.json'),
  resolve(here, '../firebase-service-account.json'),
].filter(Boolean)

const keyPath = candidates.find((p) => existsSync(p))
if (!keyPath) {
  console.error('Could not find a service-account key. Looked in:\n  ' + candidates.join('\n  '))
  process.exit(1)
}

const key = readServiceAccount(keyPath)
const projectId = key.project_id
const rulesPath = resolve(here, '../firestore.rules')
const source = readFileSync(rulesPath, 'utf8')
const dryRun = process.argv.includes('--dry-run')

const auth = new GoogleAuth({
  credentials: key,
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
})
const client = await auth.getClient()
// google-auth-library v9 returns { token, res } here, not a bare string.
const { token } = await client.getAccessToken()

const api = async (path, body, method = 'POST') => {
  const res = await fetch(`https://firebaserules.googleapis.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text }
  }
  if (!res.ok) {
    const err = new Error(json?.error?.message || text || `HTTP ${res.status}`)
    err.status = res.status
    err.payload = json
    throw err
  }
  return json
}

try {
  if (dryRun) {
    console.log(`Would deploy ${rulesPath} (${source.split('\n').length} lines) to ${projectId}`)
    process.exit(0)
  }

  console.log(`Creating ruleset for ${projectId}…`)
  const ruleset = await api(`/projects/${projectId}/rulesets`, {
    name: 'firestore.rules',
    source: { files: [{ name: 'firestore.rules', content: source }] },
  })
  console.log(`  ruleset: ${ruleset.name}`)

  console.log('Pointing the cloud.firestore release at it…')
  // UpdateRelease takes the release as a nested "release" object.
  const release = await api(`/projects/${projectId}/releases/cloud.firestore`, {
    release: {
      name: `projects/${projectId}/releases/cloud.firestore`,
      rulesetName: ruleset.name,
    },
  }, 'PATCH')
  console.log(`  release: ${release.name} -> ${release.rulesetName}`)

  const verify = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${projectId}/releases/cloud.firestore`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const verifyJson = await verify.json()
  console.log(`  verified: ${verifyJson.name} -> ${verifyJson.rulesetName} (${verifyJson.createTime})`)
  console.log('Rules deployed.')
  process.exit(0)
} catch (error) {
  console.error('Rules deploy failed:', error.message)
  if (error.payload) console.error(JSON.stringify(error.payload, null, 2))
  process.exit(1)
}
