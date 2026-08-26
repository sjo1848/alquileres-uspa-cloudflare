# CF-AU-I00 — PostgreSQL/Prisma to D1/SQLite risk map

| Source feature | Risk | Truthful adaptation | Acceptance evidence |
|---|---|---|---|
| PostgreSQL enums | SQLite has no native enum type | `TEXT NOT NULL` plus explicit `CHECK` constraints; reject unknown values | insert/update negative tests |
| `Json` audit metadata / JSONB | type and indexing differ | store validated JSON text initially; define query needs before adding indexes | round-trip and malformed JSON tests |
| `cuid()` IDs | Prisma/client default is not a D1 default | generate IDs in application code with a tested collision-resistant implementation | uniqueness/property test |
| `DateTime` / `@updatedAt` | timezone and automatic-update behavior differ | UTC ISO text convention; set `updated_at` in every mutation or trigger deliberately | timestamp invariant test |
| FK actions | D1 requires foreign keys enabled and action behavior verified | enable `PRAGMA foreign_keys=ON` per connection/runtime contract; test cascade/restrict | local D1 proof + negative tests |
| `Int` | SQLite integer is 64-bit while source validation targets Int32 | retain source bounds in application/schema checks | boundary tests |
| nullable rental fields | legacy semantics are unknown | preserve legacy columns and null domain fields; never infer price/duration/occupancy | row-by-row reconciliation |
| unique image position | reorder can temporarily collide | use transaction-safe two-phase positions or a single SQL strategy | concurrent/reorder test |
| Prisma transactions | D1 transaction/batch behavior and limits differ | isolate mutation/audit unit; explicitly compensate R2 failures | failure-injection test |
| case-insensitive email uniqueness | PostgreSQL collation behavior may differ | normalize email at boundary only if source semantics prove it; otherwise preserve and test exact behavior | auth compatibility test |
| SQL query plans | D1 row-read billing and single-threaded DB | add source-derived indexes; measure `rows_read`; ban accidental full scans on hot routes | query evidence |
| migration history | PostgreSQL SQL cannot be replayed on D1 | create a new D1 migration chain with source-to-target mapping and checksums | deterministic migration/reconciliation report |

## Migration non-goals

No data import, production schema change, paid database, or semantic conversion of historical values is authorized by CF-AU-I00.
