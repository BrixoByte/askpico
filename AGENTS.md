# Pico repo — agent rules

## Feature flag: VITE_AGENT_ACTIONS

- `apps/web/dist` must always be left built with the flag OFF (default). If a local flag-ON build was needed for device testing, rebuild the default build afterward so `dist` is not left flag-ON.
- When redeploying or building a release, verify `VITE_AGENT_ACTIONS` is unset or `false`. A flag-ON `dist` or release would ship the in-development agent/Focus features to users.
- Device tests that need the feature use a local staging/debug APK built from a flag-ON `dist` (`VITE_AGENT_ACTIONS=true npx vite build`, then `assembleStaging`). The shipped build keeps the flag OFF.

## Secrets and test credentials

- Never write passwords, passcodes, recovery codes, tokens or keys into files, logs, reports, screenshots or test output. Use placeholders such as "the test passcode". Test credentials come only from owner-set environment variables (`TEST_EMAIL`, `TEST_PASSWORD`, `TEST_PASSCODE`) or values the owner pastes for one-off use; do not read `.env` for them.
