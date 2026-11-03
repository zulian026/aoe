import { describe, it, expect } from 'vitest';
import { ProgressUpdatedPayloadSchema, calculateProgressPercentage } from '../index.js';

describe('Progress Integrity & Calculations', () => {
  it('accepts valid deterministic progress', () => {
    const payload = {
      completedWork: 5,
      totalWork: 10,
      isEstimate: false,
      verifiedWork: 5,
      unit: 'tests',
    };
    const parsed = ProgressUpdatedPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    expect(calculateProgressPercentage(payload)).toBe(50);
  });

  it('rejects completedWork exceeding totalWork when isEstimate is false', () => {
    const payload = {
      completedWork: 12,
      totalWork: 10,
      isEstimate: false,
    };
    const parsed = ProgressUpdatedPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it('allows completedWork to exceed estimated totalWork if isEstimate is true', () => {
    const payload = {
      completedWork: 12,
      totalWork: 10,
      isEstimate: true,
    };
    const parsed = ProgressUpdatedPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it('rejects verifiedWork exceeding completedWork', () => {
    const payload = {
      completedWork: 4,
      totalWork: 10,
      isEstimate: false,
      verifiedWork: 6, // Cannot verify more than has been completed!
    };
    const parsed = ProgressUpdatedPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(false);
  });

  it('calculates null progress percentage when totalWork is omitted and not an estimate', () => {
    const payload = {
      completedWork: 4,
      isEstimate: false,
    };
    const parsed = ProgressUpdatedPayloadSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
    expect(calculateProgressPercentage(payload)).toBeNull();
  });

  it('rounds percentage to one decimal place accurately', () => {
    const payload = {
      completedWork: 1,
      totalWork: 3,
      isEstimate: false,
    };
    expect(calculateProgressPercentage(payload)).toBe(33.3);
  });
});
