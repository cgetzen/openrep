import './style.css.js?v=eval-bar-v3';
import { caroKann } from './openings/caro-kann.js';
import { CoachingTrainerApp } from './coaching-trainer.js?v=eval-bar-v3';

const root = document.querySelector('#app');
if (!root) throw new Error('Missing #app root');
new CoachingTrainerApp(root, caroKann).mount();
