const scenarios = [
  { name: 'lab-demo', catalog: 50, detail: 30, ownerAdmin: 20, login: 5, contacts: 2, edits: 1, imagePuts: 1, inventoryImages: 100 },
  { name: 'early-adoption', catalog: 2000, detail: 1000, ownerAdmin: 500, login: 100, contacts: 50, edits: 30, imagePuts: 30, inventoryImages: 2000 },
  { name: 'growth-crossover', catalog: 25000, detail: 15000, ownerAdmin: 10000, login: 2000, contacts: 500, edits: 375, imagePuts: 375, inventoryImages: 8000 },
];

const limits = { workerRequestsPerDay: 100000, workerCpuMsPerRequest: 10, d1ReadsPerDay: 5000000, d1WritesPerDay: 100000, d1DbMb: 500, d1AccountGb: 5, r2ClassAPerMonth: 1000000, r2ClassBPerMonth: 10000000, r2StorageGbMonth: 10 };
const rows = scenarios.map((s) => {
  const apiWorkerRequestsPerDay = s.catalog + s.detail + s.ownerAdmin + s.login + s.contacts;
  const imageWorkerRequestsPerDay = s.catalog + 3 * s.detail;
  const workerRequestsPerDay = apiWorkerRequestsPerDay + imageWorkerRequestsPerDay;
  const d1ReadsPerDay = 30 * s.catalog + 8 * s.detail + 20 * s.ownerAdmin + s.login + s.contacts + 2 * imageWorkerRequestsPerDay;
  const d1WritesPerDay = 2 * s.edits + s.contacts + 2 * s.imagePuts;
  const r2ClassAPerMonth = Math.ceil(30 * s.imagePuts * 1.01);
  const r2ClassBPerMonth = 30 * imageWorkerRequestsPerDay;
  const r2StorageGbMonth = s.inventoryImages * 0.4 / 1000;
  return {
    name: s.name,
    driversPerDay: s,
    apiWorkerRequestsPerDay,
    mediatedPublicImageWorkerRequestsPerDay: imageWorkerRequestsPerDay,
    totalWorkerRequestsPerDay: workerRequestsPerDay,
    workerRequestHeadroomPct: (1 - workerRequestsPerDay / limits.workerRequestsPerDay) * 100,
    d1ReadsPerDay,
    d1ReadHeadroomPct: (1 - d1ReadsPerDay / limits.d1ReadsPerDay) * 100,
    d1WritesPerDay,
    d1WriteHeadroomPct: (1 - d1WritesPerDay / limits.d1WritesPerDay) * 100,
    r2ClassAPerMonth,
    r2ClassAHeadroomPct: (1 - r2ClassAPerMonth / limits.r2ClassAPerMonth) * 100,
    r2ClassBPerMonth,
    r2ClassBHeadroomPct: (1 - r2ClassBPerMonth / limits.r2ClassBPerMonth) * 100,
    r2StorageGbMonth,
    r2StorageHeadroomPct: (1 - r2StorageGbMonth / limits.r2StorageGbMonth) * 100,
  };
});

const databaseSizing = {
  assumedRecords: { listings: 1000, contacts: 50000, adminAuditLogs: 50000, users: 100, listingImages: 3000 },
  assumedRawMb: (1000 * 8 + 50000 * 2 + 50000 * 1 + 100 * 1 + 3000 * 0.5) / 1000,
  planningFactor: 2,
  plannedMb: ((1000 * 8 + 50000 * 2 + 50000 * 1 + 100 * 1 + 3000 * 0.5) / 1000) * 2,
  headroomMbPerDatabase: limits.d1DbMb - ((1000 * 8 + 50000 * 2 + 50000 * 1 + 100 * 1 + 3000 * 0.5) / 1000) * 2,
};

const output = {
  observedAt: '2026-10-12',
  formulas: {
    totalWorkerRequestsPerDay: 'catalog + detail + owner/admin + login + contacts + catalog image GETs + detail image GETs',
    imageGetsPerDay: 'catalog * 1 + detail * 3; all image bytes are served through Worker to preserve source API-mediated delivery',
    d1ReadsPerDay: 'catalog * 30 + detail * 8 + owner/admin * 20 + login * 1 + contacts * 1 + image GETs * 2 (image metadata row + joined listing visibility row; minimum model)',
    d1WritesPerDay: 'listing edits * 2 (listing + audit) + contact submissions * 1 + image puts * 2 (metadata + position index); excludes unmeasured additional index amplification',
    r2ClassAPerMonth: 'ceil(image puts/day * 30 * 1.01) (one put/upload and 1% replacement puts; no multipart because source cap is 5 MiB)',
    r2ClassBPerMonth: 'image GETs/day * 30',
    r2StorageGbMonth: 'inventory image count * 0.4 MB / 1000; decimal GB',
  },
  limits,
  scenarios: rows,
  databaseSizing,
  falsification: {
    workerGrowthCrossoverExceeded: rows[2].totalWorkerRequestsPerDay > limits.workerRequestsPerDay,
    workerGrowthExcessPerDay: rows[2].totalWorkerRequestsPerDay - limits.workerRequestsPerDay,
    d1FreeDailyLimitBehavior: 'exceeding daily read/write quotas rejects D1 queries until daily reset; no automatic paid overage',
  },
};

if (rows[0].totalWorkerRequestsPerDay !== 247 || rows[1].totalWorkerRequestsPerDay !== 8650 || rows[2].totalWorkerRequestsPerDay !== 122500) throw new Error('Worker route arithmetic changed unexpectedly');
if (rows[0].r2ClassBPerMonth !== 4200 || rows[1].r2ClassBPerMonth !== 150000 || rows[2].r2ClassBPerMonth !== 2100000) throw new Error('R2 Class B arithmetic changed unexpectedly');
console.log(JSON.stringify(output, null, 2));
