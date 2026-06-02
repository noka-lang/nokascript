#!/usr/bin/env node
import { repl, runFile } from '../src/repl/main.js';

const args = process.argv.slice(2);

if (args.length === 0) {
  await repl();
} else if (args.length === 1) {
  runFile(args[0]);
} else {
  console.error('Usage: noka [path]');
  process.exit(64);
}