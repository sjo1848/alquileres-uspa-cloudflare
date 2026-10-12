import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const calculator = fileURLToPath(new URL("./calculate-i01-cost.mjs", import.meta.url));
const result = JSON.parse(execFileSync(process.execPath, [calculator], { encoding: "utf8" }));
const requiredRoutes = ["register", "publicImageGet", "adminImageGet", "imageDelete", "imageReorder"];

assert.match(result.routeSourceMap.register, /POST \/auth\/register/);
assert.match(result.routeSourceMap.publicImageGet, /public\/listings.*GetObject Class B/);
assert.match(result.routeSourceMap.adminImageGet, /GET \/admin\/listings.*AuthGuard user revalidation.*owner-role lookup.*GetObject Class B/);
assert.match(result.routeSourceMap.imageDelete, /DELETE \/listings.*AuthGuard user revalidation.*GetObject.*DeleteObject.*compaction/);
assert.match(result.routeSourceMap.imageReorder, /PATCH \/listings.*AuthGuard user revalidation.*position updates/);

function validateScenario(scenario) {
  const routes = scenario.routeDrivers;
  const { d1RowsReadPerRoute: readsPerRoute } = scenario.assumptions;
  for (const route of requiredRoutes) {
    assert.ok(Number.isFinite(routes[route]) && routes[route] > 0, `${scenario.name}: missing nonzero ${route} driver`);
    assert.ok(Number.isFinite(readsPerRoute[route]) && readsPerRoute[route] >= 0, `${scenario.name}: missing ${route} D1 read factor`);
  }
  assert.equal(readsPerRoute.register, 0, `${scenario.name}: register has no source-level read query; keep engine uniqueness work unresolved`);
  assert.ok(readsPerRoute.adminImageGet > readsPerRoute.publicImageGet, `${scenario.name}: admin image role lookup needs its distinct D1 read factor`);
  assert.equal(scenario.assumptions.imageDeletes, routes.imageDelete, `${scenario.name}: delete D1/R2 driver diverges from route count`);
  assert.equal(scenario.assumptions.imageReorders, routes.imageReorder, `${scenario.name}: reorder D1 driver diverges from route count`);
  assert.match(scenario.assumptions.ownerAdminRouteDriverScope, /excludes ADMIN image GET and image DELETE\/PATCH reorder/);
  assert.equal(readsPerRoute.publicImageGet, 2, `${scenario.name}: public image read should count image + listing rows`);
  assert.equal(readsPerRoute.adminImageGet, 4, `${scenario.name}: ADMIN image read should include AuthGuard and owner-role lookups`);
  assert.equal(readsPerRoute.imageDelete, scenario.assumptions.imageDeleteAssumptions.shiftedImageRowsAveragePerDelete + 3,
    `${scenario.name}: delete read factor must include auth user, owned listing, image and position shift scan`);
  assert.equal(scenario.assumptions.imageDeleteAssumptions.d1RowsWrittenPerOperation,
    5 + 3 * scenario.assumptions.imageDeleteAssumptions.shiftedImageRowsAveragePerDelete,
    `${scenario.name}: delete writes must include deleted row/indexes and shifted row/indexes`);
  assert.equal(readsPerRoute.imageReorder, scenario.assumptions.avgImagesPerReorder * 4 + 2,
    `${scenario.name}: reorder read factor must include auth/owner, image scans, updateMany and final load`);
  assert.equal(scenario.assumptions.imageReorderAssumptions.d1RowsWrittenPerOperation,
    scenario.assumptions.avgImagesPerReorder * 6,
    `${scenario.name}: reorder writes must include both position-update passes and indexes`);

  const expectedRequests = Object.values(routes).reduce((sum, count) => sum + count, 0);
  const expectedReads = Object.entries(routes).reduce((sum, [route, count]) => sum + count * readsPerRoute[route], 0);
  const expectedWrites = scenario.assumptions.listingEdits * 3
    + scenario.assumptions.imageUploads * 3
    + scenario.assumptions.contacts
    + routes.register * scenario.assumptions.registrationD1RowsWrittenPerOperation
    + scenario.assumptions.imageDeletes * scenario.assumptions.imageDeleteAssumptions.d1RowsWrittenPerOperation
    + scenario.assumptions.imageReorders * scenario.assumptions.imageReorderAssumptions.d1RowsWrittenPerOperation;

  for (const point of scenario.cpuSensitivity) {
    const expectedCpuMs = (expectedRequests - routes.login - routes.register) * scenario.assumptions.nonAuthCpuMsPerRequest
      + (routes.login + routes.register) * point.assumedCpuMsPerAuthOperation;
    assert.equal(point.workerRequests, expectedRequests, `${scenario.name}: omitted route from request total`);
    assert.equal(point.workersCpuMs, expectedCpuMs, `${scenario.name}: login/registration CPU driver omitted`);
    assert.equal(point.d1RowsRead, expectedReads, `${scenario.name}: route D1 reads omitted`);
    assert.equal(point.d1RowsWritten, expectedWrites, `${scenario.name}: registration or lifecycle D1 writes omitted`);
    assert.equal(point.r2ClassBIncludingDeletePrefetchReads, routes.publicImageGet + routes.adminImageGet + scenario.assumptions.imageDeleteObjectReads,
      `${scenario.name}: image deletion read-before-delete omitted from R2 Class B`);
  }
}

for (const scenario of result.scenarios) validateScenario(scenario);

// Mutation checks: the guards must reject the exact classes of omission found in A2.
const registrationMutation = structuredClone(result.scenarios[0]);
registrationMutation.routeDrivers.register = 0;
assert.throws(() => validateScenario(registrationMutation), /nonzero register driver/);
const deleteMutation = structuredClone(result.scenarios[0]);
deleteMutation.assumptions.imageDeleteObjectReads = 0;
deleteMutation.cpuSensitivity.forEach(point => { point.r2ClassBIncludingDeletePrefetchReads = 0; });
assert.throws(() => validateScenario(deleteMutation), /read-before-delete omitted/);
const reorderMutation = structuredClone(result.scenarios[0]);
reorderMutation.assumptions.imageReorders = 0;
assert.throws(() => validateScenario(reorderMutation), /reorder D1 driver diverges/);
const adminImageReadMutation = structuredClone(result.scenarios[0]);
adminImageReadMutation.assumptions.d1RowsReadPerRoute.adminImageGet = adminImageReadMutation.assumptions.d1RowsReadPerRoute.publicImageGet;
assert.throws(() => validateScenario(adminImageReadMutation), /admin image role lookup needs its distinct/);

console.log(`Cost model validation PASS: ${result.scenarios.length} scenarios × 3 CPU sensitivities; 4 omission mutations rejected.`);
