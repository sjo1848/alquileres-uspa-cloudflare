import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SAVED_LISTINGS, SELECTION_STORAGE_KEY, normalizeSelection, parseSelection, serializeSelection, toggleSelection } from '../src/selection-store.ts';

describe('local monthly selection storage', () => {
  it('stores only unique IDs in their selected order and rehydrates after reload', () => {
    const ids = normalizeSelection(['listing-b', 'listing-a', 'listing-b']);
    assert.equal(serializeSelection(ids), '["listing-b","listing-a"]');
    assert.deepEqual(parseSelection(serializeSelection(ids)), ['listing-b', 'listing-a']);
    assert.equal(SELECTION_STORAGE_KEY, 'uspa-monthly-selection-v1');
  });

  it('rejects malformed data and filters invalid IDs without retaining snapshots', () => {
    assert.deepEqual(parseSelection('{'), []);
    assert.deepEqual(parseSelection('{"id":"x","title":"private snapshot"}'), []);
    assert.deepEqual(parseSelection('[null,42,"ok",{"id":"snapshot"},""]'), ['ok']);
  });

  it('caps both loaded and newly saved selection at four IDs', () => {
    const ids = normalizeSelection(['a', 'b', 'c', 'd', 'e']);
    assert.equal(ids.length, MAX_SAVED_LISTINGS);
    assert.deepEqual(ids, ['a', 'b', 'c', 'd']);
    assert.deepEqual(toggleSelection(ids, 'e'), { ids, saved: false, limitReached: true });
  });

  it('removes an ID without disturbing the order of the remaining selection', () => {
    assert.deepEqual(toggleSelection(['a', 'b', 'c'], 'b'), { ids: ['a', 'c'], saved: false, limitReached: false });
  });
});
