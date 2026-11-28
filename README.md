# Company House mobile

The Company House iOS and Android app (Expo, bare workflow). One app for business owners and agents; platform staff use the web. See `../companyhouseops/specs/0011-mobile-app.md`.

## Setup

- Node 22.18.0 (`.nvmrc`), Xcode (iOS 16+ simulator) or Android Studio (API 26+ emulator), CocoaPods.
- `npm install`, then `cd ios && pod install` for iOS.
- Optional: copy `.env.example` to a local env file and set `EXPO_PUBLIC_API_URL` (the default is `http://localhost:8080`; use `http://10.0.2.2:8080` on the Android emulator). Never commit real values.

## Run

- `npm start`: Metro dev server.
- `npm run ios`: build and run a debug build on the iOS simulator.
- `npm run android`: build and run a debug build on an Android emulator.

## Check

- `npm run check`: typecheck, lint and tests (must pass before work is done).
- `npm run check:fixtures`: confirm `src/lib/questionnaire.fixtures.json` matches `../companyhousebe`.
- `npm run e2e`: Maestro flows in `e2e/` against a running debug build (install the Maestro CLI separately).

## Notes

- `ios/` and `android/` are generated once and committed; never run `expo prebuild` again. Native changes are made in those projects.
- Sentry is off unless `EXPO_PUBLIC_SENTRY_DSN` is set.
- The app is an independent API client: it never imports from the web or the API (spec 0011 R8).
