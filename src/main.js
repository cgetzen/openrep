import './style.css.js?v=hint-target-v2';
import { caroKann } from './openings/caro-kann.js';
import { CoachingTrainerApp } from './coaching-trainer.js';

const root = document.querySelector('#app');
if (!root) throw new Error('Missing #app root');
new CoachingTrainerApp(root, caroKann).mount();
