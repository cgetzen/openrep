import './style.css.js?v=response-learning-v2';
import { caroKann } from './openings/caro-kann.js';
import { caroKannResponses } from './openings/caro-kann-responses.js?v=response-learning-v2';
import { caroKannMoveTheory, caroKannLessonDecisions } from './openings/caro-kann-theory.js?v=decision-cues-v1';
import { OpenRepTrainerApp } from './practice-trainer.js?v=advice-only-v1';

const root = document.querySelector('#app');
if (!root) throw new Error('Missing #app root');
const course = {
  ...caroKann,
  responses: caroKannResponses,
  moveTheory: caroKannMoveTheory,
  lessonDecisions: caroKannLessonDecisions
};
new OpenRepTrainerApp(root, course).mount();
