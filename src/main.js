import './style.css.js?v=opponent-deviations-v1';
import { caroKann } from './openings/caro-kann.js';
import { caroKannDeviations } from './openings/caro-kann-deviations.js?v=opponent-deviations-v1';
import { CoachingTrainerApp } from './coaching-trainer.js?v=opponent-deviations-v1';

const root = document.querySelector('#app');
if (!root) throw new Error('Missing #app root');
const course = { ...caroKann, deviations: caroKannDeviations };
new CoachingTrainerApp(root, course).mount();
