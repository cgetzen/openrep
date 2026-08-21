import test from 'node:test';
import assert from 'node:assert/strict';

import { BranchTeachingIndex, firstRepertoireDecisionPly } from '../src/branch-teaching.js';
import { caroKann } from '../src/openings/caro-kann.js';
import { caroKannBranchTeaching } from '../src/openings/caro-kann-branch-teaching.js';

function courseWithBranchTeaching(overrides = {}) {
  return {
    ...caroKann,
    branchTeaching: caroKannBranchTeaching,
    ...overrides
  };
}

test('every Caro-Kann line has complete, distinct branch teaching', () => {
  const index = new BranchTeachingIndex(courseWithBranchTeaching());
  const briefings = caroKann.lines.map(line => {
    const teaching = index.teachingForLine(line.id);
    assert.ok(teaching, `${line.id} is missing branch teaching`);
    assert.equal(teaching.source, 'curated');
    assert.ok(teaching.position.length > 0);
    assert.ok(teaching.plan.length > 0);
    assert.ok(teaching.opponentPlan.length > 0);
    assert.ok(teaching.memoryHook.length > 0);

    const briefing = index.briefingForLine(line.id);
    assert.match(briefing, /Key idea:/);
    assert.ok(briefing.length > line.summary.length);
    return briefing;
  });

  assert.equal(briefings.length, caroKann.lines.length);
  assert.equal(new Set(briefings).size, caroKann.lines.length);
});

test('branch teaching owns only the first repertoire decision', () => {
  const index = new BranchTeachingIndex(courseWithBranchTeaching());
  const firstDecision = firstRepertoireDecisionPly(caroKann.side);

  assert.equal(firstDecision, 1);
  assert.match(index.briefingForDecision('advance-main', firstDecision), /Advance center/);
  assert.equal(index.briefingForDecision('advance-main', firstDecision + 2), null);
});

test('different branches can teach different ideas at the same first chess position', () => {
  const index = new BranchTeachingIndex(courseWithBranchTeaching());
  const firstDecision = firstRepertoireDecisionPly(caroKann.side);

  const exchange = index.briefingForDecision('exchange-main', firstDecision);
  const panov = index.briefingForDecision('panov-main', firstDecision);
  assert.notEqual(exchange, panov);
  assert.match(exchange, /symmetrical structure/);
  assert.match(panov, /isolated-queen-pawn/);
});

test('branch teaching fails fast on missing or duplicate line metadata', () => {
  assert.throws(
    () => new BranchTeachingIndex(courseWithBranchTeaching({
      branchTeaching: caroKannBranchTeaching.filter(entry => entry.lineId !== 'two-knights')
    })),
    /Missing branch teaching for line two-knights/
  );

  assert.throws(
    () => new BranchTeachingIndex(courseWithBranchTeaching({
      branchTeaching: [...caroKannBranchTeaching, caroKannBranchTeaching[0]]
    })),
    /Duplicate branch teaching for line advance-main/
  );
});
