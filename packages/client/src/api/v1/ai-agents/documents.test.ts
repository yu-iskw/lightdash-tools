import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AiAgentsDocumentsClient } from './documents';

import type { HttpClient } from '../../../http/http-client';

describe('AiAgentsDocumentsClient', () => {
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

  it('listDocuments should call GET …/documents', async () => {
    const client = new AiAgentsDocumentsClient(mockHttp);
    const summaries = [{ uuid: 'd1', name: 'Glossary' }];
    vi.mocked(mockHttp.get).mockResolvedValue(summaries);
    const result = await client.listDocuments('proj1', 'a1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/documents');
    expect(result).toEqual(summaries);
  });

  it('getDocumentContent should call GET …/documents/{uuid}/content', async () => {
    const client = new AiAgentsDocumentsClient(mockHttp);
    const content = { uuid: 'd1', name: 'Glossary', mimeType: 'text/markdown', content: '# Hi' };
    vi.mocked(mockHttp.get).mockResolvedValue(content);
    const result = await client.getDocumentContent('proj1', 'a1', 'd1');
    expect(mockHttp.get).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/documents/d1/content');
    expect(result).toEqual(content);
  });

  it('createDocument should call POST …/documents', async () => {
    const client = new AiAgentsDocumentsClient(mockHttp);
    const body = {
      name: 'Glossary',
      content: '# Terms',
      mimeType: 'text/markdown',
      originalFilename: 'Glossary.md',
    };
    const created = { uuid: 'd1', ...body };
    vi.mocked(mockHttp.post).mockResolvedValue(created);
    const result = await client.createDocument('proj1', 'a1', body);
    expect(mockHttp.post).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/documents', body);
    expect(result).toEqual(created);
  });

  it('updateDocumentContent should call PATCH …/content', async () => {
    const client = new AiAgentsDocumentsClient(mockHttp);
    const body = { name: 'Glossary v2', content: '# Updated' };
    const updated = { uuid: 'd1', ...body };
    vi.mocked(mockHttp.patch).mockResolvedValue(updated);
    const result = await client.updateDocumentContent('proj1', 'a1', 'd1', body);
    expect(mockHttp.patch).toHaveBeenCalledWith(
      '/projects/proj1/aiAgents/a1/documents/d1/content',
      body,
    );
    expect(result).toEqual(updated);
  });

  it('updateDocumentSettings should call PATCH …/documents/{uuid}', async () => {
    const client = new AiAgentsDocumentsClient(mockHttp);
    vi.mocked(mockHttp.patch).mockResolvedValue(undefined);
    await client.updateDocumentSettings('proj1', 'a1', 'd1', { alwaysIncludeInContext: true });
    expect(mockHttp.patch).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/documents/d1', {
      alwaysIncludeInContext: true,
    });
  });

  it('deleteDocument should call DELETE …/documents/{uuid}', async () => {
    const client = new AiAgentsDocumentsClient(mockHttp);
    vi.mocked(mockHttp.delete).mockResolvedValue(undefined);
    await client.deleteDocument('proj1', 'a1', 'd1');
    expect(mockHttp.delete).toHaveBeenCalledWith('/projects/proj1/aiAgents/a1/documents/d1');
  });
});
