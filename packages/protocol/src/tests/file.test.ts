import { describe, it, expect } from 'vitest';
import { FileChangedPayloadSchema } from '../index.js';

describe('File Change Schemas', () => {
  it('validates a CREATED file change with evidence', () => {
    const payload = {
      action: 'CREATED',
      path: 'src/index.ts',
      evidence: {
        verifiedOnDisk: true,
        sizeBytes: 1024,
      },
      lineDelta: { added: 45, removed: 0 },
    };
    const parsed = FileChangedPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it('validates a MODIFIED file change with line delta', () => {
    const payload = {
      action: 'MODIFIED',
      path: 'package.json',
      evidence: { verifiedOnDisk: true },
      lineDelta: { added: 2, removed: 1 },
      description: 'Added zod dependency',
    };
    const parsed = FileChangedPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it('validates a RENAMED file change with oldPath', () => {
    const payload = {
      action: 'RENAMED',
      path: 'src/new-name.ts',
      oldPath: 'src/old-name.ts',
      evidence: { verifiedOnDisk: true },
    };
    const parsed = FileChangedPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it('rejects a RENAMED file change missing oldPath', () => {
    const payload = {
      action: 'RENAMED',
      path: 'src/new-name.ts',
      evidence: { verifiedOnDisk: true },
    };
    const parsed = FileChangedPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it('rejects negative line deltas', () => {
    const payload = {
      action: 'MODIFIED',
      path: 'src/file.ts',
      evidence: { verifiedOnDisk: true },
      lineDelta: { added: -5, removed: 0 },
    };
    const parsed = FileChangedPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });
});
