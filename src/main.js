import './style.css.js?v=cburnett-v1';
import { caroKann } from './openings/caro-kann.js';
import { CoachingTrainerApp } from './coaching-trainer.js';

const root = document.querySelector('#app');
if (!root) throw new Error('Missing #app root');
new CoachingTrainerApp(root, caroKann).mount();
