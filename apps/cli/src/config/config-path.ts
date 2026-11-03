import os from 'node:os';
import path from 'node:path';

/**
 * Resolves the configuration directory for the current platform.
 */
export function getConfigDir(): string {
  if (process.env.AOE_CONFIG_PATH) {
    return path.dirname(path.resolve(process.env.AOE_CONFIG_PATH));
  }

  const platform = process.platform;
  const home = os.homedir();

  if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
    return path.join(appData, 'aoe');
  }

  if (platform === 'darwin') {
    return path.join(home, 'Library', 'Application Support', 'aoe');
  }

  // Linux / POSIX default follows XDG Base Directory
  const xdgConfigHome = process.env.XDG_CONFIG_HOME;
  if (xdgConfigHome && xdgConfigHome.trim().length > 0) {
    return path.join(xdgConfigHome, 'aoe');
  }

  return path.join(home, '.config', 'aoe');
}

/**
 * Resolves the absolute path to the configuration file (`config.json`).
 */
export function getConfigFilePath(): string {
  if (process.env.AOE_CONFIG_PATH) {
    return path.resolve(process.env.AOE_CONFIG_PATH);
  }

  return path.join(getConfigDir(), 'config.json');
}
