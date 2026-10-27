import { spawn } from 'node:child_process';

export function runNode(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit' });
    child.once('error', (error) => {
      console.error(error);
      resolve(false);
    });
    child.once('exit', (code) => resolve(code === 0));
  });
}

// Independent suites keep separate processes/databases. A free worker takes the
// next suite immediately; a long simulation cannot block the next entire batch.
export async function runQueue(
  commands,
  { concurrency = 4, run = runNode, report = console.error } = {},
) {
  if (!Number.isInteger(concurrency) || concurrency < 1)
    throw new RangeError('Invalid concurrency');
  let cursor = 0,
    passed = true;
  async function worker() {
    while (cursor < commands.length) {
      const command = commands[cursor++];
      try {
        if (!(await run(command))) passed = false;
      } catch (error) {
        passed = false;
        report(error);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, commands.length) }, worker));
  return passed;
}
