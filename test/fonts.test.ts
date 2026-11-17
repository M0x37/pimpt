import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockExecFileSync = vi.fn();
const mockSpawnSync = vi.fn();

vi.mock('node:child_process', () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
  spawnSync: (...args: unknown[]) => mockSpawnSync(...args),
}));

const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  mockExecFileSync.mockReset();
  mockSpawnSync.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fonts', () => {
  it('canInstallFont returns true for known fonts', async () => {
    const { canInstallFont } = await import('../src/fonts');
    expect(canInstallFont('Cascadia Mono')).toBe(true);
    expect(canInstallFont('JetBrains Mono')).toBe(true);
    expect(canInstallFont('Unknown Font')).toBe(false);
  });

  it('isFontInstalled returns false on non-Windows', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    try {
      const { isFontInstalled } = await import('../src/fonts');
      expect(isFontInstalled('Cascadia Mono')).toBe(false);
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    }
  });

  it('installFont skips on non-Windows without throwing', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    try {
      const { installFont } = await import('../src/fonts');
      await expect(installFont('Cascadia Mono')).resolves.toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    }
  });

  it('installNerdFont skips on non-Windows without throwing', async () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    try {
      const { installNerdFont } = await import('../src/fonts');
      await expect(installNerdFont()).resolves.toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    }
  });
});
