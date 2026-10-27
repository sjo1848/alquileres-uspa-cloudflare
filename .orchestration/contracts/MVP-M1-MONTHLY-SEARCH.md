# MVP M1 — búsqueda orientada a alquileres mensuales

- **Issue:** [#56](https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/56)
- **Roadmap:** [#55](https://github.com/sjo1848/alquileres-uspa-cloudflare/issues/55)
- **Authorized base:** `main@d5a26a0c6f1ad68dd77a13459ade1c15573a15cf`
- **Scope:** orient public home, existing catalog filters and listing detail toward monthly rentals. Reuse the current Vue/Worker API, `pricePeriod=MONTH`, rental-duration fields and query preservation.
- **Acceptance:** primary monthly search sends `pricePeriod=MONTH`; weekly listings remain available through an explicit all-listings route and the existing weekly filter; card/detail show price frequency separately from rental duration; availability freshness stays truthful; inquiry remains a non-reserving contact; filters and pagination survive detail/back navigation; responsive behavior at 1440/390/320, keyboard/focus and real synthetic-D1 public E2E pass.
- **Out of scope:** M2/M3, backend/API/model/database/auth changes, new providers, simulated offers, Preview/Access/CD/production changes, paid services, real data, and source repository writes.
- **Delivery boundary:** functional PR with focused tests/evidence, exact-head CI and review, consistency validator, protected merge. The Issue remains open after merge until a separately authorized Preview publication and human acceptance.
- **Human authorization:** implementation authorized in the current instruction; Preview publication is explicitly not authorized by this increment.
