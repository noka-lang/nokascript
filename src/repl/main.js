import { readFile } from 'node:fs/promises';
import readline from 'node:readline';

import { bootScreen } from './boot.js';
import { VM } from './vm.js';


export async function repl() {
  await bootScreen();
  const vm = await VM.create();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  for (; ;) {
    let line = await new Promise(resolve => {
      rl.once('close', () => resolve(null));
      rl.question('> ', resolve);
    });

    if (line === null) {
      process.stdout.write('\n');
      break;
    }

    try {
      vm.interpret(line);
    } catch (err) {
      console.error(err.message);
    }
  }

  rl.close();
}

export async function runFile(path) {
  const source = await readFile(path, 'utf8');
  const vm = await VM.create();

  vm.interpret(source);
};
