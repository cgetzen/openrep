import './style.css.js';
import { caroKann } from './openings/caro-kann.js';
import { TrainerApp } from './trainer.js';

const root = document.querySelector('#app');
if (!root) throw new Error('Missing #app root');
new TrainerApp(root, caroKann).mount();
