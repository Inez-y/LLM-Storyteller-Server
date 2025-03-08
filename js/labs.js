import { Lab3 } from './lab3.js';
import { Lab5 } from './lab5.js';

const lab3Instance = new Lab3();
const lab5Instance = await Lab5.create();

export { lab3Instance, lab5Instance };
