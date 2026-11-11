# Organisation invitations

## Recipient experience

An organisation administrator chooses the recipient's name, email, organisation, role, membership type and eligible teams under **Admin → People & access → Invite a person**. Rescue Hub creates a pending, organisation-scoped account and emails a single-use invitation link.

Clicking the link opens `/activate` and displays the invited person's **name**, **email** and **organisation**, read directly from the pending user profile. The recipient enters **only a new password** (10–256 characters). There is no six-digit code, email re-entry or additional verification form. On successful activation the server starts an authenticated session and redirects the user to the organisation rescue workspace (`/`).

Public reporter sign-up remains a separate flow and still requires its own six-digit email verification.

## Security

- 32 random bytes per invitation, encoded as a 43-character base64url secret. The URL is `/activate?invite=<userUUID>.<secret>`.
- A SHA-256 hash of the secret is stored under `USER#<userId> / INVITATION`; the plaintext secret is **never** stored in DynamoDB, printed in logs, or returned to an administrator.
- Links expire after **7 days** and are usable **once**. DynamoDB conditions validate the hash and expiry and atomically delete the invitation while writing the password and activating the user and membership. Two simultaneous acceptance attempts cannot succeed.
- The initial GET validates the link but does not consume it (safe from ordinary mail-link previews). It stores the credential in a short-lived, `HttpOnly`, `Secure`, `SameSite=Lax`, path-scoped browser cookie and redirects to a token-free `/activate` URL. The POST form contains only the new password.
- The activation page uses `no-store`, `no-referrer` and `noindex` headers. Passwords are salted and hashed with scrypt, as for other accounts.
- Administrators can **Resend invitation email** for enabled, pending users they are allowed to manage. Resending invalidates the old link, with a 60-second throttle. Expired or already-used links show a clear message requesting a new invitation.
- An invited user receives no authenticated organisation access until acceptance. No change to the existing organisation and team permission model.
- If SES fails after creating a pending account, the account remains unactivated. The authorised administrator can resend the invitation after resolving delivery.

## Server setup

The `demo` SST stage sets `RESCUE_HUB_PUBLIC_ORIGIN=https://rescue.michaelcuneo.com.au` by default. Other stages must explicitly configure a trusted HTTPS origin (localhost HTTP is permitted only for development). Do **not** derive invitation origins from arbitrary request Host headers. SES sending requires the existing linked `RescueHubMailFrom` resource and deployed SES permissions.

## End-to-end checks

1. From a deployed administrator session, invite a new email under the intended organisation, role and teams.
2. Confirm SES delivers a single URL with no six-digit code.
3. Open the URL; confirm the page shows **Welcome, [name]**, the invited email and the correct organisation. Only the password is requested.
4. Set a valid password, confirm automatic sign-in and the organisation workspace. Check the original role/team/membership is unchanged.
5. Reuse the link. It must fail. Also test incorrect or expired tokens, concurrent submissions, a disabled pending user, and login after activation.
6. Invite another account and resend before using the first link. The older link must be invalid and the latest link valid.
7. Confirm mobile `/api/auth/activate` accepts the invite credential and password, not the old code/email pair.
8. Confirm failed SES delivery leaves a pending account that an authorised admin can resend.

CI validates link parsing and expiry rules, TypeScript, Svelte and build output. It does **not** verify live SES, DynamoDB transactions or browser cookies; test those after AWS deployment.
