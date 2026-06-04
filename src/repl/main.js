// import { VM } from './vm.js';
import readline from 'node:readline';
import { bootScreen } from './boot.js';

// let vm = new VM();

export async function repl() {
  await bootScreen();

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

    // VM.interpret(line);
  }

  rl.close();
}

//TODO
export function runFile(path) { };