#!/usr/bin/env node
import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const entry = resolve(__dirname, '../src/index-node.js');
const outfile = resolve(__dirname, '../dist/index-node.js');

build({
  entryPoints: [entry],
  bundle: true,
  platform: 'node',
  target: 'node20',
  outfile,
  sourcemap: true,
  format: 'esm',
  external: ['wrangler', '@cloudflare/workers-types']
})
  .then(() => {
    console.log('Node bundle generated at', outfile);
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
