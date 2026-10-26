# Archicova email activation — Brevo SMTP

## Sender identities
- **no-reply@archicova.com**: transactional From address for signup confirmation, magic-link login, password recovery and billing notifications. Display name: Archicova.
- **contact@archicova.com**: real receiving inbox for support and individually relevant outreach. Public footer contact link. Default transactional Reply-To.

## Existing application flows
- Signup/password: `app/api/auth/credentials/route.ts` calls `requestConfirmation`; 24-hour one-use token, stored hashed, confirmation link.
- Magic sign-in: `app/api/auth/email/route.ts`; one-use 15-minute link, rate limited.
- Password recovery: `app/api/auth/reset/route.ts`; 15-minute token, enumeration-safe response.
- Billing notifications use `lib/mail.ts` outbox.
- Mail sending now produces branded HTML plus accessible plain text. Transactional auth is never delegated to a marketing campaign.

## Required external activation (not possible through the Brevo connector)
1. **Receiving email:** provision a mailbox or forwarding service for `contact@archicova.com`. A Brevo SMTP account **does not provide a receiving inbox**. Test receipt and replying. Decide whether a separate true no-reply inbox is required (it is usually unnecessary).
2. **Brevo:** under Senders, Domains & IPs, add and authenticate `archicova.com` and the `no-reply@archicova.com` sender. Follow Brevo's live DNS instructions for DKIM and DMARC. Do not replace existing MX or SPF records blindly; preserve the receiving provider's MX and combine SPF mechanisms only if required.
3. **Brevo:** create a transactional SMTP credential (distinct from login password); never paste it into Git or a chat.
4. **Vercel production environment** (encrypted/sensitive values):
   - `EMAIL_FROM=Archicova <no-reply@archicova.com>`
   - `EMAIL_REPLY_TO=contact@archicova.com`
   - `SMTP_URL=smtp://<BREVO_SMTP_LOGIN>:<BREVO_SMTP_KEY>@smtp-relay.brevo.com:587`
   - `NEXT_PUBLIC_APP_URL=https://archicova.com` (already configured)
   Use URL-encoding on SMTP username/password, including @ and special symbols. Set different authorized sender and credentials for dev if testing there.
5. Redeploy after environment changes; test email signup confirmation, password recovery and magic link end-to-end with a dedicated test account. Inspect received mail, SPF/DKIM/DMARC and safe expirations.
6. Only after end-to-end checks say sending is live.

## Security and compliance
- These messages are account-security/transactional, not cold outreach. Do not use Brevo marketing lists to deliver sign-in links.
- Never log, expose or store raw verification tokens outside their intended secure URLs.
- Brevo/SMTP sender verification may require domain ownership DNS records and manual approval.
