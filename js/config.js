// Site configuration. Analytics is off while PLAUSIBLE_DOMAIN is empty: no script, no request.
// To enable it later, see "Enabling analytics later" in README.md (the CSP in _headers must change too).
export const PLAUSIBLE_DOMAIN = '';
// Use the plain script.js (self-hosted or proxied copies of it are fine). Variants such as
// script.outbound-links.js or script.tagged-events.js add their own click handling and
// would double-count the events analytics.js already sends.
export const PLAUSIBLE_SRC = 'https://plausible.io/js/script.js';
