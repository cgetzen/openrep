import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCurriculumCourse, curriculumTeachingUnits } from '../src/curriculum.js';
import { caroKann } from '../src/openings/caro-kann.js';
import { caroKannResponses } from '../src/openings/caro-kann-responses.js';
import { caroKannCurriculum } from '../src/openings/caro-kann-curriculum.js';

function buildCourse() {
  return buildCurriculumCourse({
    ...caroKann,
    responses: caroKannResponses
  }, caroKannCurriculum);
}

test('curriculum sequence contains first-class line and response teaching units', () => {
  const course = buildCourse();
  const units = curriculumTeachingUnits(course, caroKannCurriculum);
  const acceleratedIndex = units.findIndex(unit => unit.kind === 'line' && unit.id === 'accelerated-panov');

  assert.ok(acceleratedIndex > 0);
  assert.deepEqual(units[acceleratedIndex], {
    teachingUnitId: 'line:accelerated-panov',
    kind: 'line',
    id: 'accelerated-panov',
    familyId: 'accelerated-panov'
  });
  assert.deepEqual(units[acceleratedIndex + 1], {
    teachingUnitId: 'line:quiet-d3',
    kind: 'line',
    id: 'quiet-d3',
    familyId: 'quiet-d3'
  });
});

test('curriculum teaching-unit identity is unique across the ordered Learn sequence', () => {
  const course = buildCourse();
  const units = curriculumTeachingUnits(course, caroKannCurriculum);
  const ids = units.map(unit => unit.teachingUnitId);
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(ids.includes('line:advance-early-c5'));
  assert.ok(ids.includes('line:accelerated-panov'));
  assert.ok(ids.includes('response:classical-nd2-transposition'));
});
