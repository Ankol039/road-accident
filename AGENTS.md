# RoadReport admin portal - rules for every task

Read this file and HANDOFF.md before you start any task.

## Where you are working
- You are working directly in the user's real project folder, not in a copy and not in a hosted repository. Whenever a task says "the repo", it means this folder (the one containing package.json).
- There may be no git safety net. Treat every edit as live.
- Before you edit or delete a file for the first time in a task, copy the original to `.codex-backup/<short-task-name>/` keeping its relative path (for example `.codex-backup/summaries-downloads/src/pages/Summaries.jsx`). Back up only files you change. Never edit or delete anything inside `.codex-backup/`.
- If a `.git` folder exists, you may run read-only commands (`git status`, `git diff`, `git log`). Do NOT run `git commit`, `checkout`, `reset`, `stash`, `clean`, `rebase`, `push` or anything else that changes state or contacts a remote.
- Never run destructive commands (`rm -rf`, `del /s`, mass moves or renames, formatting the whole project). Do not touch `node_modules/` or `dist/` by hand.
- Check which operating system and shell you are on before running commands, and use matching syntax. Prefer `node` and `npm` scripts over shell-specific tools.
- If `npm install` or another command fails because there is no network, say so and give me the exact manual steps. Do not work around it by hand-editing lockfiles or vendoring packages.

## Secrets
- Never open, print, quote or copy the contents of `.env*`, `firebase-service-account*.json`, `private/` or any file that looks like a key, token or password. Refer to their names only.
- Never write secrets into code, docs, tests, logs or your replies. Never commit or upload them.
- Do not add the service-account key to `.env` or to any file that ships to the browser.

## Scope
- This is the WEBSITE / ADMIN side only. A teammate builds the native mobile app separately. Do not create, edit or plan any mobile (Expo / React Native) code.
- "Narrow screen" always means the website at a narrow browser width.

## Stack
- React 18 + Vite 5 + react-router-dom 6 (BrowserRouter), Bootstrap 5.3, Chart.js. The project root IS the app: `src/pages`, `src/services`, `src/hooks`, `src/components`, `src/lib`, `src/styles`.
- There is NO API server and NO PHP in the live app. The browser talks to Firebase directly (Auth + Cloud Firestore, free Spark plan: no Cloud Functions, no Storage). `firestore.rules` is the real backend.
- Firebase project: `roadreport-402a6` (see `.firebaserc`). Hosting target "primary". The scripts reject service-account keys from any other project.
- `legacy/` is the old PHP app. READ-ONLY reference. Never edit, move or delete anything in it.
- `html-mockups/` holds standalone HTML mockups of every screen (read `html-mockups/README.md`). Tooling: `npm run mock:export` (regenerates mockups FROM the running app and overwrites them), `mock:convert`, `mock:verify`.

## Firestore rules
- `firestore.rules` is deliberately strict. Read its header comment. Never loosen it to make something work.
- If a query or write is denied, fix the code. If you believe a rule is wrong, describe the problem and propose the exact change, but do not apply it unless the task says to.
- Keep the status list in the rules in sync with `REPORT_STATUSES` in `src/lib/constants.js`.

## Working rules
- Explore before editing. Make the smallest change that fixes the root cause. No unrelated refactors, renames, reformatting or dependency upgrades.
- Only add a dependency when the task allows it, and say which one and why.
- There is no lint or test script. Verify with `npm run build`, and for UI behaviour run the app (`npm run dev`) or write a short puppeteer check modelled on `scripts/check-*.mjs`.
- The `check:*` and seed scripts talk to the LIVE Firebase project. The check scripts create and clean up their own fixtures, but still prefer the Firebase emulator (`VITE_USE_EMULATORS=true`). Never run `seed --reset`. Never create, change or delete real data to test something. If you cannot verify safely, say so and give me manual steps.
- Never deploy. If rules or indexes change, give me the exact commands:
  - `firebase deploy --only firestore:rules,firestore:indexes --project roadreport-402a6`
  - or, rules only: `node scripts/deploy-rules.mjs --dry-run`, then `node scripts/deploy-rules.mjs`
- Stop and ask me before: deleting any file, changing `package.json` scripts, changing `firebase.json` or `.firebaserc`, or touching anything outside this folder.

## When you finish, reply with
1. Root cause (one or two sentences).
2. Files changed, and the path of every backup you made.
3. How you verified it, and what you could not verify.
4. Anything I must do myself (for example console steps or deploy commands).
