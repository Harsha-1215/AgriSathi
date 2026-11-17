const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateEligibility, localizedScheme } = require('../src/services/governmentSchemeService');

test('eligibility checks expose missing answers without treating them as failures', () => {
  const result = evaluateEligibility([
    { field: 'state', operator: 'equals', value: 'Andhra Pradesh', label: 'State' },
    { field: 'landArea', operator: 'max', value: 5, label: 'Land area' },
  ], { state: 'Andhra Pradesh' });

  assert.equal(result.status, 'more_information_required');
  assert.deepEqual(result.matches, [{ field: 'state', label: 'State' }]);
  assert.deepEqual(result.missingInformation, [{ field: 'landArea', label: 'Land area' }]);
  assert.match(result.note, /does not guarantee/i);
});

test('eligibility reports mismatches and does not infer a likely qualification when criteria are absent', () => {
  const mismatch = evaluateEligibility([{ field: 'state', value: 'Telangana' }], { state: 'Andhra Pradesh' });
  assert.equal(mismatch.status, 'does_not_appear_to_qualify');

  const unconfigured = evaluateEligibility([], {}, {});
  assert.equal(unconfigured.status, 'eligibility_not_configured');
  assert.match(unconfigured.note, /official department/i);
});

test('scheme responses hide stale application status and do not invent missing translations', () => {
  const staleDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
  const scheme = {
    id: 'scheme-id',
    schemeName: 'Verified scheme name',
    shortDescription: 'Verified English description',
    fullDescription: 'Verified English details',
    applicationStatus: 'open',
    applicationStatusVerifiedAt: staleDate,
    statusSource: 'https://official.example.gov',
    source: 'https://official.example.gov',
    lastVerifiedAt: new Date(),
    informationVersion: 1,
  };
  const response = localizedScheme(scheme, 'te', null, null);
  assert.equal(response.schemeName, 'Verified scheme name');
  assert.equal(response.applicationStatus, 'unknown');
  assert.equal(response.statusSource, null);
  assert.equal(response.isTranslationAvailable, false);
});
