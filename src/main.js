import './style.css.js?v=response-learning-v2';
import { caroKann } from './openings/caro-kann.js';
import { caroKannResponses } from './openings/caro-kann-responses.js?v=response-learning-v2';
import { CoachingTrainerApp } from './coaching-trainer.js?v=practice-route-label-v1';

const root = document.querySelector('#app');
if (!root) throw new Error('Missing #app root');
const course = { ...caroKann, responses: caroKannResponses };
new CoachingTrainerApp(root, course).mount();
