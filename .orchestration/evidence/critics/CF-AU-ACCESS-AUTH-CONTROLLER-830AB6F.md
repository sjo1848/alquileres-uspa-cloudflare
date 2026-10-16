# Access Preview auth final code review

Exact830ab6f39c941d140e92f0889053187da6544d11, separate codex exec gpt-6-luna/high/read-only/ephemeral/ignore-user-config, flags accepted, exit0. BackendidentityUNVERIFIED, no mutation/network/tests/secrets byreviewer. RawJSONL adjacent.

**PASS — exact HEAD `830ab6f39c941d140e92f0889053187da6544d11`.**

The repair closes the reported password fallback: Preview hostnames are gated before `/auth/*` and `/listings` handlers, and invalid or missing `ACCESS_PREVIEW` configuration returns 503 before password login or auth config can proceed. The gate covers the canonical hostname, prefix-based immutable aliases, and the disabled hostname; the fixed-origin validator still allows Preview auth only on the canonical origin.

The bounded auth flow also checks the Access JWT signature, algorithm, issuer, audience, required claims, time limits, and fixed operator identity. It ignores raw identity headers, maps the verified identity only to the fixed synthetic OWNER, caps session expiry at the Access token expiry, and checks Origin on session exchange and cookie-backed mutations. I found no bypass in the reviewed candidate.

I reviewed the prior auth/session flow and current repair without running tests or builds. The supplied post-repair test/build results are not independently rerun here. Requested model and sandbox flags are caller-configured; backend identity remains **UNVERIFIED**. This local code PASS does not establish remote operator access or product PASS.
