import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { P } from './src/model.js';
const rd = f => readFileSync(new URL(f, import.meta.url), 'utf8');
const copy = JSON.parse(rd('./src/copy.en.json'));
for (const k in P) copy['param.' + k] = P[k].src;                         // parameter notes join the editable text
let fonts = rd('../../ai-gigafactory/fonts/fonts.css').replace(/url\(([^)]+\.woff2)\)/g, (m, f) => 'url(data:font/woff2;base64,' + readFileSync(new URL('../../ai-gigafactory/fonts/' + f, import.meta.url)).toString('base64') + ')');
const res = await build({ entryPoints: ['src/app.js'], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', legalComments: 'none' });
const app = res.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const safe = s => s.replace(/</g, '\\u003c');
let html = rd('./src/template.html').replace('/*FONTS*/', () => fonts).replace('/*GEO*/', () => safe(rd('./src/geo.json'))).replace('/*COPY*/', () => safe(JSON.stringify({ en: copy }))).replace('/*APP*/', () => app);
mkdirSync(new URL('./dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('./dist/index.html', import.meta.url), html);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB', '| text keys', Object.keys(copy).length);
