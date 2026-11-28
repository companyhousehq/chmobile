# companyhousemobile

Company House mobile app: one Expo (bare workflow) iOS and Android app for business owners and agents, with full parity with the web (spec 0011).

Product context, domain rules, agents and skills live in the hub, imported here:

@../companyhouseops/CLAUDE.md

Agents and skills are symlinked from the hub (`.claude/agents`, `.claude/skills`). Mobile conventions: `../companyhouseops/.claude/skills/expo-mobile/SKILL.md` (planned; not yet in the hub). Read `../companyhouseops/specs/0011-mobile-app.md` and its `.design.md` first, then the feature's spec ("Mobile" acceptance criteria).

## Commands

| npm script                        | make target                 | Does                                                                                 |
| --------------------------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| `npm start`                       | `make start`                | Metro dev server                                                                     |
| `npm run ios` / `npm run android` | `make ios` / `make android` | Local debug build and run (Xcode / Gradle, no EAS)                                   |
| `npm run typecheck`               | `make typecheck`            | `tsc --noEmit`                                                                       |
| `npm run lint`                    | `make lint`                 | ESLint and Prettier check                                                            |
| `npm test`                        | `make test`                 | Jest                                                                                 |
| `npm run check:fixtures`          | `make check-fixtures`       | Compare the questionnaire fixtures copy with `../companyhousebe` (skipped if absent) |
| `npm run e2e`                     | `make e2e`                  | `maestro test e2e/` against a running debug build and a local API                    |
| `npm run check`                   | `make check`                | typecheck, lint, test (must pass before work is done)                                |

Local API: `EXPO_PUBLIC_API_URL` (`http://localhost:8080` on the iOS simulator, `http://10.0.2.2:8080` on the Android emulator); see `.env.example`. Cleartext HTTP is allowed only in debug builds.

E2E flows run against the main local dev database (`make dev-up migrate seed` in `../companyhousebe`), never a separate test database. Flows use only seeded accounts and reach screens through the tab bar, never hard-coded IDs, which differ per database. On iOS, reset the Keychain before each flow (`xcrun simctl keychain <udid> reset`): `clearState` keeps it.

## Rules

- Bare workflow: `ios/` and `android/` are committed and owned. Never run `expo prebuild`; edit the native projects directly.
- The app is an independent API client. It owns its API types, problem messages, role labels, validation and questionnaire evaluator in `src/lib`. Never import from `companyhousefe` or `companyhousebe` (ADR 0022 rejected). The questionnaire evaluator must pass `src/lib/questionnaire.fixtures.json`, a copy of the backend's `db/content/business_activity/fixtures.json`.
- Never log, persist (outside the secure store) or send to Sentry the session token, invitation or email tokens, or response bodies. The token lives in `expo-secure-store` and memory only. Cached data is wiped on sign-out and on any 401 (`src/lib/session/wipe.ts`).
- Never trust the client for authorization: the UI may hide actions, the API decides.
- Every screen with company data uses `useQuery` with a user-namespaced key (`['u', userId, ...]`). Writes apply only after the server confirms.
- Styles only from `src/theme` tokens; no hex colours in components. Strings only from `src/strings`. Accessible by default: labels, Dynamic Type, contrast, reading order.
- Copy never implies Company House is CAC or a government agency, or that a filing is complete without evidence (rule 8).
- OTA updates and EAS builds (ADR 0029) are deferred: no `eas.json`, no `expo-updates`.
- Stay on the current branch; never create or switch branches.

## Commits and PRs

Follow `../companyhouseops/.claude/skills/commit-and-pr/SKILL.md`. All commits and PRs are authored by the user; never add Claude or AI attribution (no `Co-Authored-By: Claude`, no "Generated with Claude Code").

## Patched dependencies

- `patches/` holds `patch-package` patches applied on `npm install` (`postinstall`). `expo-modules-jsi+58.0.24.patch` fixes a Swift 6.2 data-race error that stops Xcode 26.3 from compiling `JavaScriptObject.swift`. Drop it when Expo ships a fixed release, and regenerate it with `--include 'apple/Sources/.*\.swift$'` if it needs changing (otherwise build output gets captured).
- `pod install` needs a UTF-8 locale: `LANG=en_US.UTF-8`.
