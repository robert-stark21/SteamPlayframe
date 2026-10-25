// Runs the API (with reload) and the Vite dev server together.
import { spawn } from 'node:child_process';

const procs = [
  spawn('npm', ['run', 'dev:api'], { stdio: 'inherit', shell: true }),
  spawn('npm', ['run', 'dev:web'], { stdio: 'inherit', shell: true }),
];
const stop = () => procs.forEach((p) => p.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
procs.forEach((p) => p.on('exit', (code) => { if (code) { stop(); process.exit(code); } }));
