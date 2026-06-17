import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = join(__dirname, '..', 'core', 'vm.wasm');

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class VM {
  exports = null;

  static async create() {
    let bytes;
    try {
      bytes = await readFile(WASM_PATH);
    } catch {
      throw new Error(
        `Could not find vm.wasm at ${WASM_PATH}.`
      );
    }

    const vm = new VM();
    const { instance } = await WebAssembly.instantiate(bytes, {
      env: {
        host_print: (ptr, len) => {
          const view = new Uint8Array(vm.exports.memory.buffer, ptr, len);
          process.stdout.write(decoder.decode(view));
        },
      },
    });

    vm.exports = instance.exports;
    vm.exports.init();
    return vm;
  }

  interpret(source) {
    const { exports } = this;
    const bytes = encoder.encode(source);

    const cap = exports.scratch_cap();
    if (bytes.length > cap) {
      throw new Error(`source too large: ${bytes.length} bytes > scratch ${cap}`);
    }

    const ptr = exports.scratch_ptr();
    new Uint8Array(exports.memory.buffer, ptr, bytes.length).set(bytes);
    return exports.interpret(bytes.length);
  }
}
