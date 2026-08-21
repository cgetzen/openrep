import './style.css.js?v=coverage-curriculum-v1';
import { caroKann } from './openings/caro-kann.js';
import { caroKannResponses } from './openings/caro-kann-responses.js?v=coverage-curriculum-v1';
import { caroKannMoveTheory, caroKannLessonDecisions } from './openings/caro-kann-theory.js?v=decision-cues-v1';
import { caroKannBranchTeaching } from './openings/caro-kann-branch-teaching.js?v=teaching-copy-v1';
import { buildCaroKannCurriculumCourse, caroKannCurriculum } from './openings/caro-kann-curriculum.js?v=coverage-curriculum-v1';
import { CurriculumTrainerApp } from './curriculum-trainer.js?v=coverage-curriculum-v1';

const root = document.querySelector('#app');
if (!root) throw new Error('Missing #app root');
const course = buildCaroKannCurriculumCourse({
  ...caroKann,
  responses: caroKannResponses,
  moveTheory: caroKannMoveTheory,
  lessonDecisions: caroKannLessonDecisions,
  branchTeaching: caroKannBranchTeaching
}, caroKannCurriculum);
new CurriculumTrainerApp(root, course).mount();
