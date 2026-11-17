const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAnalysis } = require('../src/services/huggingFaceCropService');

test('hosted crop model labels are only matched to exact published crop guidance', () => {
  const analysis = buildAnalysis({
    labels: [{ label: 'Tomato___Late_blight', score: 0.99 }],
    cropName: 'Tomato',
    model: 'surgeonwz/plant-village',
    verifiedDiseaseKnowledge: [{
      cropName: 'Tomato',
      name: 'Late blight',
      description: 'Published reference description.',
      prevention: ['Use source-verified field hygiene guidance.'],
      source: 'Agricultural extension reference',
    }],
  });

  assert.equal(analysis.analysisStatus, 'possible_issue');
  assert.equal(analysis.possibleDisease, 'Late blight');
  assert.equal(analysis.recommendations[0], 'Use source-verified field hygiene guidance.');
  assert.equal('confidenceScore' in analysis, false);
});

test('hosted crop model does not surface a disease when crop or verified label does not match', () => {
  const analysis = buildAnalysis({
    labels: [{ label: 'Tomato___Late_blight', score: 0.99 }],
    cropName: 'Potato',
    model: 'surgeonwz/plant-village',
    verifiedDiseaseKnowledge: [{
      cropName: 'Tomato',
      name: 'Late blight',
      source: 'Agricultural extension reference',
    }],
  });

  assert.equal(analysis.analysisStatus, 'no_reliable_match');
  assert.equal(analysis.possibleDisease, null);
  assert.equal(analysis.recommendations.length, 1);
});
