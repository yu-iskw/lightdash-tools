import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ValidationClient } from './validation';
import type { HttpClient } from '../../http/http-client';

describe('ValidationClient', () => {
  let mockHttp: HttpClient;

  beforeEach(() => {
    mockHttp = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    } as unknown as HttpClient;
  });

  it('getValidationResults should call GET /projects/{projectUuid}/validate', async () => {
    const client = new ValidationClient(mockHttp);
    const mockResponse = { status: 'ok', results: [] };
    vi.mocked(mockHttp.get).mockResolvedValue(mockResponse);
    const result = await client.getValidationResults('p1', { jobId: 'j1' });
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/p1/validate', {
      params: { jobId: 'j1' },
    });
    expect(result).toEqual(mockResponse);
  });

  it('validateProject should call POST /projects/{projectUuid}/validate', async () => {
    const client = new ValidationClient(mockHttp);
    const mockResponse = { status: 'ok', results: { jobId: 'j1' } };
    vi.mocked(mockHttp.post).mockResolvedValue(mockResponse);
    const result = await client.validateProject('p1');
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/p1/validate', undefined);
    expect(result).toEqual(mockResponse);
  });
});
