import { describe, it, expect } from 'vitest';
import {
  SafetyMode,
  isAllowed,
  READ_ONLY_DEFAULT,
  WRITE_IDEMPOTENT,
  WRITE_DESTRUCTIVE,
} from './safety';

describe('Safety Logic', () => {
  describe('isAllowed', () => {
    it('should allow read-only operations in read-only mode', () => {
      expect(isAllowed(SafetyMode.READ_ONLY, READ_ONLY_DEFAULT)).toBe(true);
    });

    it('should forbid non-read-only operations in read-only mode', () => {
      expect(isAllowed(SafetyMode.READ_ONLY, WRITE_IDEMPOTENT)).toBe(false);
      expect(isAllowed(SafetyMode.READ_ONLY, WRITE_DESTRUCTIVE)).toBe(false);
    });

    it('should allow read-only and idempotent-write in write-idempotent mode', () => {
      expect(isAllowed(SafetyMode.WRITE_IDEMPOTENT, READ_ONLY_DEFAULT)).toBe(true);
      expect(isAllowed(SafetyMode.WRITE_IDEMPOTENT, WRITE_IDEMPOTENT)).toBe(true);
    });

    it('should forbid destructive operations in write-idempotent mode', () => {
      expect(isAllowed(SafetyMode.WRITE_IDEMPOTENT, WRITE_DESTRUCTIVE)).toBe(false);
    });

    it('should allow all operations in write-destructive mode', () => {
      expect(isAllowed(SafetyMode.WRITE_DESTRUCTIVE, READ_ONLY_DEFAULT)).toBe(true);
      expect(isAllowed(SafetyMode.WRITE_DESTRUCTIVE, WRITE_IDEMPOTENT)).toBe(true);
      expect(isAllowed(SafetyMode.WRITE_DESTRUCTIVE, WRITE_DESTRUCTIVE)).toBe(true);
    });
  });
});
