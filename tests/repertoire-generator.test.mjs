import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { compileCaroKannSnapshot, generateCaroKannModule, CARO_KANN_GENERATED_PATH } from '../content-generator/generate-caro-kann.mjs';
import { caroKann } from '../src/openings/caro-kann.js';
import { caroKannResponses } from '../src/openings/caro-kann-responses.js';
import { caroKannMoveTheory, caroKannLessonDecisions } from '../src/openings/caro-kann-theory.js';
import { caroKannGeneratedMoveTheory, applyGeneratedLessonAlternatives } from '../src/openings/caro-kann-generated-theory.js';
import { caroKannGeneratedCurriculum } from '../src/openings/caro-kann-generated-curriculum.js';
import { caroKannGeneratedRepertoire } from '../src/openings/generated/caro-kann.generated.js';
import { buildCurriculumCourse } from '../src/curriculum.js';
import { RepertoireMoveIndex } from '../src/repertoire-moves.js';
import { MoveTheoryIndex } from '../src/move-theory.js';

function decision(id) {
  return caroKannGeneratedRepertoire.decisions.find(entry => entry.id === id);
}

test('Caro-Kann snapshot compiles deterministic 80/90/95 coverage checkpoints', () => {
  const compiled = compileCaroKannSnapshot();
  const root = compiled.decisions.find(entry => entry.id === 'caro-root-after-c6');
  assert.deepEqual(root.coverage['80'], ['d2d4', 'b1c3']);
  assert.deepEqual(root.coverage['90'], ['d2d4', 'b1c3', 'g1f3']);
  assert.deepEqual(root.coverage['95'], ['d2d4', 'b1c3', 'g1f3', 'c2c4']);
  assert.equal(root.moves.find(entry => entry.move === 'b1c3').tier, 'core');
  assert.equal(root.moves.find(entry => entry.move === 'g1f3').tier, 'important');
  assert.equal(root.moves.find(entry => entry.move === 'd2d3').tier, 'sideline');
});

test('major Caro-Kann decision points reach practical coverage using shipped content', () => {
  assert.deepEqual(decision('advance-c5-after-c5').coverage['95'], ['d4c5', 'g1f3', 'c2c3']);
  assert.deepEqual(decision('exchange-after-cxd5').coverage['95'], ['c2c4', 'f1d3', 'g1f3', 'c2c3']);
  assert.deepEqual(
    decision('two-knights-after-d5').coverage['95'],
    ['g1f3', 'd2d4', 'd1f3', 'e4d5', 'd2d3']
  );
  for (const entry of caroKannGeneratedRepertoire.decisions) {
    assert.match(entry.positionKey, / [wb] /);
    assert.ok(entry.coverage['95'].length > 0);
  }
});

test('generated artifact is byte-for-byte reproducible from dated source inputs', () => {
  assert.equal(fs.readFileSync(CARO_KANN_GENERATED_PATH, 'utf8'), generateCaroKannModule());
});

test('generated Two Knights responses use canonical position identity and validate in the runtime index', () => {
  const generatedIds = [
    'two-knights-d4-transposition',
    'two-knights-qf3',
    'two-knights-exchange',
    'two-knights-d3'
  ];
  for (const id of generatedIds) {
    assert.equal(caroKannResponses.find(response => response.id === id)?.source, 'generated');
  }

  const index = new RepertoireMoveIndex({ ...caroKann, responses: caroKannResponses });
  const position = decision('two-knights-after-d5').positionKey;
  assert.equal(index.responseAt(position, 'd2d4')?.id, 'two-knights-d4-transposition');
  assert.equal(index.responseAt(position, 'd1f3')?.id, 'two-knights-qf3');
  assert.equal(index.responseAt(position, 'e4d5')?.id, 'two-knights-exchange');
  assert.equal(index.responseAt(position, 'd2d3')?.id, 'two-knights-d3');
});

test('generated terminal alternatives make Hillbilly Bg4 an accepted completion move', () => {
  const lessonDecisions = applyGeneratedLessonAlternatives(caroKannLessonDecisions);
  const theory = new MoveTheoryIndex({
    ...caroKann,
    moveTheory: [...caroKannMoveTheory, ...caroKannGeneratedMoveTheory],
    lessonDecisions
  });
  const hillbilly = theory.decisionForLine('hillbilly', 11);
  assert.deepEqual(hillbilly.acceptedMoves, ['c8g4']);
  assert.equal(hillbilly.choices.find(choice => choice.move === 'c8g4')?.role, 'accepted');
  assert.match(hillbilly.choices.find(choice => choice.move === 'c8g4')?.theory.rationale ?? '', /same teaching objective/i);
});

test('generated curriculum projects coverage tiers without changing line identity', () => {
  const lessonDecisions = applyGeneratedLessonAlternatives(caroKannLessonDecisions);
  const course = buildCurriculumCourse({
    ...caroKann,
    responses: caroKannResponses,
    moveTheory: [...caroKannMoveTheory, ...caroKannGeneratedMoveTheory],
    lessonDecisions
  }, caroKannGeneratedCurriculum);

  assert.equal(course.lines.find(line => line.id === 'two-knights')?.id, 'two-knights');
  const twoKnights = course.curriculum.families.find(family => family.id === 'two-knights-coverage');
  const earlyNf3 = course.curriculum.families.find(family => family.id === 'early-nf3');
  const quiet = course.curriculum.families.find(family => family.id === 'quiet-d3');
  assert.equal(twoKnights.tier, 'core');
  assert.equal(earlyNf3.tier, 'important');
  assert.equal(quiet.tier, 'sideline');
  assert.deepEqual(twoKnights.responseIds, [
    'two-knights-d4-transposition',
    'two-knights-qf3',
    'two-knights-exchange',
    'two-knights-d3'
  ]);
});
