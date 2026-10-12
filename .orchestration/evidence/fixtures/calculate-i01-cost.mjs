const free = {
  workersRequests: 10_000_000,
  workersCpuMs: 30_000_000,
  d1RowsRead: 25_000_000_000,
  d1RowsWritten: 50_000_000,
  d1StorageGb: 5,
  r2StorageGb: 10,
  r2ClassA: 1_000_000,
  r2ClassB: 10_000_000,
};

const rates = {
  workersMonthlyMinimum: 5,
  workersRequestPerMillion: 0.3,
  workersCpuPerMillionMs: 0.02,
  d1ReadPerMillion: 0.001,
  d1WritePerMillion: 1,
  d1StoragePerGbMonth: 0.75,
  r2StoragePerGbMonth: 0.015,
  r2ClassAPerMillion: 4.5,
  r2ClassBPerMillion: 0.36,
};

const scenarios = [
  {
    name: "low",
    workers: { catalog: 40_000, detail: 20_000, register: 100, login: 5_000, ownerAdmin: 20_000, contact: 1_000, publicImageGet: 13_300, adminImageGet: 700, imageDelete: 300, imageReorder: 500 },
    d1RowsReadPerRoute: { catalog: 30, detail: 8, register: 0, login: 1, ownerAdmin: 20, contact: 1, publicImageGet: 2, adminImageGet: 4, imageDelete: 5, imageReorder: 18 },
    listingEdits: 3_000,
    contacts: 1_000,
    imageUploads: 2_000,
    imageDeleteObjectReads: 300,
    imageReorders: 500,
    avgImagesPerReorder: 4,
    d1RowsWrittenPerRegistration: 3,
    d1RowsWrittenPerImageDelete: 11,
    d1RowsWrittenPerImageReorder: 24,
    d1StorageGb: 0.2,
    r2StorageGb: 3,
    nonAuthCpuMs: 5,
  },
  {
    name: "base",
    workers: { catalog: 500_000, detail: 300_000, register: 1_500, login: 20_000, ownerAdmin: 300_000, contact: 30_000, publicImageGet: 1_757_500, adminImageGet: 92_500, imageDelete: 3_000, imageReorder: 5_000 },
    d1RowsReadPerRoute: { catalog: 500, detail: 25, register: 0, login: 1, ownerAdmin: 20, contact: 1, publicImageGet: 2, adminImageGet: 4, imageDelete: 7, imageReorder: 26 },
    listingEdits: 30_000,
    contacts: 30_000,
    imageUploads: 30_000,
    imageDeleteObjectReads: 3_000,
    imageReorders: 5_000,
    avgImagesPerReorder: 6,
    d1RowsWrittenPerRegistration: 3,
    d1RowsWrittenPerImageDelete: 17,
    d1RowsWrittenPerImageReorder: 36,
    d1StorageGb: 1.5,
    r2StorageGb: 8,
    nonAuthCpuMs: 5,
  },
  {
    name: "high_unindexed_growth_and_auth_abuse_sensitivity",
    workers: { catalog: 2_000_000, detail: 1_000_000, register: 50_000, login: 2_000_000, ownerAdmin: 3_000_000, contact: 500_000, publicImageGet: 10_925_000, adminImageGet: 575_000, imageDelete: 150_000, imageReorder: 100_000 },
    d1RowsReadPerRoute: { catalog: 15_000, detail: 50, register: 0, login: 1, ownerAdmin: 100, contact: 1, publicImageGet: 2, adminImageGet: 4, imageDelete: 11, imageReorder: 34 },
    listingEdits: 1_000_000,
    contacts: 500_000,
    imageUploads: 1_500_000,
    imageDeleteObjectReads: 150_000,
    imageReorders: 100_000,
    avgImagesPerReorder: 8,
    d1RowsWrittenPerRegistration: 3,
    d1RowsWrittenPerImageDelete: 29,
    d1RowsWrittenPerImageReorder: 48,
    d1StorageGb: 7,
    r2StorageGb: 25,
    nonAuthCpuMs: 8,
  },
];

const cpuPerAuthOperationSensitivityMs = [10, 100, 600];
const ceilToMillion = n => Math.ceil(n / 1_000_000) * 1_000_000;
const sum = values => Object.values(values).reduce((a, b) => a + b, 0);

function calculate(scenario, cpuPerLoginMs) {
  const workerRequests = sum(scenario.workers);
  const d1RowsRead = Object.entries(scenario.workers).reduce((total, [route, requests]) => total + requests * scenario.d1RowsReadPerRoute[route], 0);
  // Planning proxy: each edit writes listing+audit plus one average indexed-row write;
  // each image upload writes metadata plus two average index rows. Contacts write one row.
  const d1RowsWritten = scenario.listingEdits * 3 + scenario.imageUploads * 3 + scenario.contacts
    + scenario.workers.register * scenario.d1RowsWrittenPerRegistration
    + scenario.workers.imageDelete * scenario.d1RowsWrittenPerImageDelete
    + scenario.imageReorders * scenario.d1RowsWrittenPerImageReorder;
  const d1StorageBillableGb = Math.max(0, scenario.d1StorageGb - free.d1StorageGb);
  const r2StorageRoundedGb = Math.ceil(scenario.r2StorageGb);
  const r2Arounded = ceilToMillion(scenario.imageUploads);
  const imageGetOperations = scenario.workers.publicImageGet + scenario.workers.adminImageGet;
  const r2BOperations = imageGetOperations + scenario.imageDeleteObjectReads;
  const r2Brounded = ceilToMillion(r2BOperations);
  const nonAuthRequests = workerRequests - scenario.workers.login - scenario.workers.register;
  const workersCpuMs = nonAuthRequests * scenario.nonAuthCpuMs
    + scenario.workers.login * cpuPerLoginMs
    + scenario.workers.register * cpuPerLoginMs;
  const workersRequestCost = Math.max(0, workerRequests - free.workersRequests) / 1_000_000 * rates.workersRequestPerMillion;
  const workersCpuCost = Math.max(0, workersCpuMs - free.workersCpuMs) / 1_000_000 * rates.workersCpuPerMillionMs;
  const d1ReadCost = Math.max(0, d1RowsRead - free.d1RowsRead) / 1_000_000 * rates.d1ReadPerMillion;
  const d1WriteCost = Math.max(0, d1RowsWritten - free.d1RowsWritten) / 1_000_000 * rates.d1WritePerMillion;
  const d1StorageCost = d1StorageBillableGb * rates.d1StoragePerGbMonth;
  const r2StorageCost = Math.max(0, r2StorageRoundedGb - free.r2StorageGb) * rates.r2StoragePerGbMonth;
  const r2ACost = Math.max(0, r2Arounded - free.r2ClassA) / 1_000_000 * rates.r2ClassAPerMillion;
  const r2BCost = Math.max(0, r2Brounded - free.r2ClassB) / 1_000_000 * rates.r2ClassBPerMillion;
  const total = rates.workersMonthlyMinimum + workersRequestCost + workersCpuCost + d1ReadCost + d1WriteCost + d1StorageCost + r2StorageCost + r2ACost + r2BCost;
  return {
    workerRequests,
    workersCpuMs,
    d1RowsRead,
    d1RowsWritten,
    d1StorageGb: scenario.d1StorageGb,
    r2StorageGb: scenario.r2StorageGb,
    r2ClassA: scenario.imageUploads,
    r2ClassARoundedForBilling: r2Arounded,
    r2ClassB: imageGetOperations,
    r2ClassBIncludingDeletePrefetchReads: r2BOperations,
    r2ClassBRoundedForBilling: r2Brounded,
    monthlyCostUsd: Number(total.toFixed(4)),
    lineItemsUsd: {
      workersMinimum: rates.workersMonthlyMinimum,
      workersRequests: Number(workersRequestCost.toFixed(4)),
      workersCpu: Number(workersCpuCost.toFixed(4)),
      d1RowsRead: Number(d1ReadCost.toFixed(4)),
      d1RowsWritten: Number(d1WriteCost.toFixed(4)),
      d1Storage: Number(d1StorageCost.toFixed(4)),
      r2Storage: Number(r2StorageCost.toFixed(4)),
      r2ClassA: Number(r2ACost.toFixed(4)),
      r2ClassB: Number(r2BCost.toFixed(4)),
    },
  };
}

const result = {
  task: "CF-AU-I01-P0P1",
  observedAt: "2026-10-12",
  currency: "USD",
  pricingBasis: "Cloudflare Workers Paid Standard account minimum plus included usage and listed overage rates; D1 and R2 independently metered",
  sensitivityOnly: "Per-login and per-registration provider CPU are unmeasured. 10ms and 100ms are illustrative; 600ms is a conservative sensitivity near but not equal to local bcryptjs Workerd elapsed samples, and is NOT billed CPU evidence.",
  routeSourceMap: {
    register: "POST /auth/register -> auth.controller.ts -> AuthService.registerOwner (bcryptjs cost 12 + User.create)",
    login: "POST /auth/login -> AuthService.validateCredentials (existing-account bcrypt compare; unknown email exits early)",
    publicImageGet: "GET /public/listings/:id/images/:imageId -> ListingsService.getPublicImage (image/listing lookup + R2 GetObject Class B)",
    adminImageGet: "GET /admin/listings/:id/images/:imageId -> AuthGuard user revalidation + ListingsService.getAdminImage (image/listing/owner-role lookup + R2 GetObject Class B)",
    imageDelete: "DELETE /listings/:id/images/:imageId -> AuthGuard user revalidation + ListingsService.removeImage (owner listing + image lookup, R2 GetObject before free DeleteObject, D1 delete + dense-position compaction)",
    imageReorder: "PATCH /listings/:id/images/:imageId -> AuthGuard user revalidation + ListingsService.reorderImage (owner listing, ordered D1 load, bulk position reset, per-image position updates, ordered result read)",
  },
  scenarios: scenarios.map(scenario => ({
    name: scenario.name,
    routeDrivers: scenario.workers,
    assumptions: {
      d1RowsReadPerRoute: scenario.d1RowsReadPerRoute,
      listingEdits: scenario.listingEdits,
      contacts: scenario.contacts,
      imageUploads: scenario.imageUploads,
      registrations: scenario.workers.register,
      registrationD1RowsWrittenPerOperation: scenario.d1RowsWrittenPerRegistration,
      imageGetTrafficSplit: "Assumed 95% public / 5% ADMIN image GETs in every scenario; counts sum to total modeled API-mediated image GETs.",
      imageDeletes: scenario.workers.imageDelete,
      imageDeleteObjectReads: scenario.imageDeleteObjectReads,
      imageDeleteAssumptions: {
        d1RowsReadPerOperation: scenario.d1RowsReadPerRoute.imageDelete,
        d1RowsWrittenPerOperation: scenario.d1RowsWrittenPerImageDelete,
        r2ClassBGetObjectBeforeFreeDeletePerOperation: 1,
        shiftedImageRowsAveragePerDelete: (scenario.d1RowsWrittenPerImageDelete - 5) / 3,
      },
      imageReorders: scenario.imageReorders,
      avgImagesPerReorder: scenario.avgImagesPerReorder,
      imageReorderAssumptions: {
        d1RowsReadPerOperation: scenario.d1RowsReadPerRoute.imageReorder,
        d1RowsWrittenPerOperation: scenario.d1RowsWrittenPerImageReorder,
        rowWriteMeterFactorPerImage: 6,
        readMeterFactorPerImagePlusFixedAuthAndOwnerRows: 4,
      },
      authOperationCpuSensitivityMs: cpuPerAuthOperationSensitivityMs,
      d1StorageGb: scenario.d1StorageGb,
      r2StorageGb: scenario.r2StorageGb,
      nonAuthCpuMsPerRequest: scenario.nonAuthCpuMs,
      loginCpuModel: "Each modeled login is conservatively assumed to reach the bcrypt compare path (existing account with wrong password or equivalent costly verification); unknown-account paths observed in source skip bcrypt and would cost less.",
      registrationCpuModel: "Each registration is assumed to execute one bcryptjs cost-12 password hash. The same 10/100/600 assumed provider CPU ms sensitivities are applied; local elapsed hash time is not billed CPU evidence. Source performs no explicit user lookup; D1 read factor is zero, while engine-level unique-index work is unmeasured.",
      attackSensitivity: "Monthly request-volume sensitivity only. Burst concurrency, provider throttling, source IP reputation, anti-abuse controls, and account-wide shared traffic are not quantified.",
      ownerAdminRouteDriverScope: "Other OWNER/ADMIN calls including edit/upload subdrivers; excludes ADMIN image GET and image DELETE/PATCH reorder, which have separate explicit route drivers.",
    },
    cpuSensitivity: cpuPerAuthOperationSensitivityMs.map(perAuthOperationMs => ({
      assumedCpuMsPerAuthOperation: perAuthOperationMs,
      label: perAuthOperationMs === 600 ? "elapsed-proxy sensitivity only; not metered CPU" : "illustrative provider-CPU assumption; not measured",
      ...calculate(scenario, perAuthOperationMs),
    })),
  })),
  optionalDurableObjects: {
    status: "UNRESOLVED_NOT_INCLUDED_IN_SCENARIO_TOTALS",
    pricingObservedAt: "2026-10-12",
    storageBackend: "SQLite-backed",
    meters: {
      requests: { includedPerMonth: 1_000_000, usdPerAdditionalMillion: 0.15 },
      activeDuration: { includedGbSecondsPerMonth: 400_000, usdPerAdditionalMillionGbSeconds: 12.5, allocatedMemoryMb: 128 },
      rowsRead: { includedPerMonth: 25_000_000_000, usdPerAdditionalMillion: 0.001 },
      rowsWritten: { includedPerMonth: 50_000_000, usdPerAdditionalMillion: 1.0 },
      storedData: { includedGbMonth: 5, usdPerAdditionalGbMonth: 0.2 },
    },
    unresolvedBecause: "No DO actor/lock topology or monthly request count, active GB-s, SQLite rows-read/written, or storage volume is established. If introduced, these charges are additive to Workers and D1/R2 scenario use; no DO cost is assumed to be zero.",
    billingNotes: ["Inactive objects do not incur duration until active; idle objects not eligible for hibernation remain billable.", "Billable excess for each dimension rounds up to the provider billing unit.", "Deletes count as SQLite rows written; key-value-style operations use hidden SQLite rows."],
    source: "https://developers.cloudflare.com/durable-objects/platform/pricing/",
  },
  caveats: [
    "Not a quote, forecast, or authorization to buy/enable billing; traffic and data counts are hypothetical.",
    "Workers Static Assets are excluded from Worker request count; all modeled dynamic route drivers include POST /auth/register, login, and API-mediated image GET, image DELETE and image PATCH reorder operations.",
    "D1 rows-read factors are route-level scan assumptions; only local/production meta.rows_read and query plans can validate them.",
    "D1 write factors are simplified planning proxies: edits = listing+audit+one average index row; image upload = metadata+two average index rows; contact = one row; registration = one user row plus primary-key and unique-email index rows; deletion = one deleted image row plus shifted rows and one average index-mutation factor; reorder = two position updates per image with table plus index row mutations. Actual D1 metadata counters may differ.",
    "High case deliberately models a large unindexed catalog scan (15,000 rows/query) and abuse-sensitive login volume to expose cost and availability risk.",
    "R2 operation billing rounds total operations up to whole million-operation units before included units are subtracted; storage is rounded to whole GB-month in this model.",
    "R2 object deletion itself is treated as free on Standard, but each modeled image delete includes one source-parity read-before-delete GetObject Class B operation; failure compensation re-Put, retries, object listing, metadata HEAD, multipart and account-shared usage are omitted.",
    "No account hard spend ceiling or automatic hard cap is assumed. Workers per-invocation CPU limits are not monthly bill caps.",
    "Durable Objects are excluded from scenario totals and explicitly unresolved: their request, active duration, SQLite row-read/write and storage meters are listed separately; no DO workload or necessity/proof exists in this task.",
  ],
};

console.log(JSON.stringify(result, null, 2));
