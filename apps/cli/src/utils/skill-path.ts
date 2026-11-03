import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Resolves the absolute path to the canonical `skills/aoe/SKILL.md` file.
 */
export function resolveSkillPath(): string | undefined {
  // 1. Explicit environment override
  if (process.env.AOE_SKILL_PATH && fs.existsSync(process.env.AOE_SKILL_PATH)) {
    return path.resolve(process.env.AOE_SKILL_PATH);
  }

  // 2. Relative to current working directory
  const cwdCandidate = path.resolve(process.cwd(), 'skills/aoe/SKILL.md');
  if (fs.existsSync(cwdCandidate)) {
    return cwdCandidate;
  }

  // 3. Walk upwards from current module location
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    let dir = currentDir;
    for (let i = 0; i < 6; i++) {
      const candidate = path.join(dir, 'skills/aoe/SKILL.md');
      if (fs.existsSync(candidate)) {
        return path.resolve(candidate);
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  } catch {
    // Ignore URL resolution errors in unusual environments
  }

  return undefined;
}
