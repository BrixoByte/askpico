# Incident Response

**Status:** Planning
**Owner:** Pico engineering
**Parent:** [Security plan](README.md)

## 1. Reporting a Vulnerability

- Security issues are reported privately. Use a private security advisory on GitHub. Do not open a public issue.
- The report should include the affected area, steps to reproduce, and the expected impact.
- The team acknowledges each report within 3 business days.

## 2. Severity

| Level | Meaning | Example |
|---|---|---|
| Critical | Keys exposed, or user data accessible to other users | A provider key in a public commit, or one user reads another user's chats |
| High | Auth or quota can be bypassed | A client change unlocks the `advanced` tier |
| Medium | Limited data exposure or abuse | Rate limit missing on one route |
| Low | Hardening issue with no direct impact | Missing security header |

## 3. Response Steps

1. **Contain.** Disable the affected route or feature flag. Revoke exposed keys and sessions.
2. **Assess.** Identify what data or accounts were affected, and from when.
3. **Fix.** Make the smallest change that removes the cause. Add a regression test.
4. **Verify.** Run the backend and web tests, and confirm the fix on the affected route.
5. **Notify.** Inform affected users and the relevant providers when personal data was exposed. Follow applicable law.
6. **Review.** Record the cause and the fix in the [Threat model](threat-model.md), and update controls if needed.

## 4. Key Rotation

- Rotate the provider key in the provider dashboard, then update the backend environment.
- Restart the backend after the change. Confirm the old key no longer works.
- Check the commit history for any copy of the old key.

## 5. Communication

- Users are notified only after the fix is deployed, unless the issue is still active.
- Notices state what happened, what data was involved, and what the user should do.
- Notices do not include technical details that help an attacker.
