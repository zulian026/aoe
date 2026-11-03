#!/usr/bin/env node
import { runCli } from './program.js';

void runCli(process.argv).then((exitCode) => {
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
});
