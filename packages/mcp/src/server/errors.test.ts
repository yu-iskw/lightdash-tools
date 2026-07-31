import { LightdashApiError, RateLimitError, NetworkError } from '@lightdash-tools/client';
import { describe, it, expect } from 'vitest';

import { toMcpErrorMessage } from './errors.js';

const mockRequest = { method: 'GET', url: '/api/v1/test' };

describe('toMcpErrorMessage', () => {
  describe('RateLimitError', () => {
    it('should include status code and retry-after when present', () => {
      const err = new RateLimitError(
        429,
        { name: 'TooManyRequests', statusCode: 429 },
        mockRequest,
        undefined,
        60,
      );
      expect(toMcpErrorMessage(err)).toBe('Rate limited (429). Retry after 60s.');
    });

    it('should omit retry-after when not present', () => {
      const err = new RateLimitError(
        429,
        { name: 'TooManyRequests', statusCode: 429 },
        mockRequest,
      );
      expect(toMcpErrorMessage(err)).toBe('Rate limited (429).');
    });
  });

  describe('LightdashApiError', () => {
    it('should include API error message when present', () => {
      const err = new LightdashApiError(
        400,
        { name: 'BadRequest', statusCode: 400, message: 'Invalid input' },
        mockRequest,
      );
      expect(toMcpErrorMessage(err)).toBe('Lightdash API error: Invalid input');
    });

    it('should fall back to HTTP status when message is missing', () => {
      const err = new LightdashApiError(
        500,
        { name: 'InternalError', statusCode: 500 },
        mockRequest,
      );
      expect(toMcpErrorMessage(err)).toBe('Lightdash API error: HTTP 500');
    });
  });

  describe('NetworkError', () => {
    it('should prefix network error message', () => {
      const err = new NetworkError('Connection refused', new Error('ECONNREFUSED'));
      expect(toMcpErrorMessage(err)).toBe('Network error: Connection refused');
    });
  });

  describe('generic Error', () => {
    it('should return error message', () => {
      expect(toMcpErrorMessage(new Error('something went wrong'))).toBe('something went wrong');
    });

    it('should return "Unknown error" when message is empty', () => {
      expect(toMcpErrorMessage(new Error(''))).toBe('Unknown error');
    });
  });

  describe('non-Error values', () => {
    it('should stringify string values', () => {
      expect(toMcpErrorMessage('plain string')).toBe('plain string');
    });

    it('should stringify number values', () => {
      expect(toMcpErrorMessage(42)).toBe('42');
    });

    it('should stringify null', () => {
      expect(toMcpErrorMessage(null)).toBe('null');
    });
  });
});
