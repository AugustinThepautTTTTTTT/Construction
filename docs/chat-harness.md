# Archicova chat harness

The server classifies each current request with a strict structured semantic response, across languages. A bounded legacy fallback preserves known English/French requests during provider outages. Negations, brief consent, subscription questions, materials synonyms and actionable image feedback are evaluated separately. Ambiguous requests require clarification before deliverable tools are enabled.

Each turn receives only its authorized tools. Paid-plan and ownership checks remain in the tool executor. Plan advice and complaints without deliverables do not consume chat credits; authenticated chat requests are limited to 60/hour. Mixed requests retain normal message/image/search costs. Tool retries cannot create duplicate successful deliverables or product comparisons in the same turn.

Image revisions use the latest successful concept associated with the currently shared original photo. The image edit receives the prior concept first and original photo second, preserving prior design choices while locking physical room geometry. Missing, pending, cross-owner or different-photo concepts cannot silently reset a revision. Explicit restart uses the original photo.

BOM cards show quantity/cost previews, totals and expandable rows. Work cards show progress, numbered steps and visible professional requirements, with detailed instructions behind individual expanders. Quantities, sources, assumptions, safety checks and exports remain available.

Explicit dissatisfaction and failed streamed replies create idempotent, owner-bound records in roomwise.support_cases. The assistant acknowledges the saved reference and says the Archicova team will investigate, without inventing deadlines or claiming a notification was sent. Records require a team review process; this change does not send emails or assign a human reviewer. Actual subscription facts are supplied on every turn; the assistant recommends Free, Basic or Pro according to usage and never changes a subscription itself.

Verification: npm test, npm run typecheck and npm run build. The opt-in prebuild semantic evaluation exercises 15 synthetic cases against the configured model, only when ARCHICOVA_HARNESS_EVAL=1 and VERCEL_ENV=preview. Leave the flag disabled after evaluation. Tests cannot guarantee every language or every possible request; authenticated image revisions still warrant real-photo acceptance testing.
