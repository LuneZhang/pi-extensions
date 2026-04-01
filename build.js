#!/usr/bin/env node
import * as esbuild from 'esbuild';
import { glob } from 'glob';
import { basename, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, cp, rm, stat } from 'node:fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, 'src');
const distDir = join(__dirname, 'dist');

// Build options for esbuild
const baseOptions = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  external: [
    '@mariozechner/pi-coding-agent',
    '@mariozechner/pi-tui',
    '@mariozechner/pi-ai',
    '@sinclair/typebox',
  ],
  minify: false,
  sourcemap: true,
};

async function build() {
  console.log('Building pi-extensions...');
  
  // Clean dist directory
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  // Find all extension entry points
  const extensions = [
    { entry: 'artifacts.ts', out: 'artifacts.js' },
    { entry: 'dashboard.ts', out: 'dashboard.js' },
    { entry: 'diff.ts', out: 'diff.js' },
    { entry: 'files.ts', out: 'files.js' },
    { entry: 'prompt-url-widget.ts', out: 'prompt-url-widget.js' },
    { entry: 'redraws.ts', out: 'redraws.js' },
    { entry: 'tps.ts', out: 'tps.js' },
    { entry: 'question/index.ts', out: 'question.js' },
    { entry: 'research-agent/src/index.ts', out: 'research-agent.js' },
  ];

  const isWatch = process.argv.includes('--watch');

  for (const ext of extensions) {
    const entryPoint = join(srcDir, ext.entry);
    const outfile = join(distDir, ext.out);
    
    try {
      await stat(entryPoint);
    } catch {
      console.log(`  Skipping ${ext.entry} (not found)`);
      continue;
    }

    console.log(`  ${ext.entry} -> dist/${ext.out}`);

    if (isWatch) {
      const ctx = await esbuild.context({
        ...baseOptions,
        entryPoints: [entryPoint],
        outfile,
      });
      await ctx.watch();
    } else {
      await esbuild.build({
        ...baseOptions,
        entryPoints: [entryPoint],
        outfile,
      });
    }
  }

  if (!isWatch) {
    console.log('Build complete!');
  } else {
    console.log('Watching for changes...');
  }
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});