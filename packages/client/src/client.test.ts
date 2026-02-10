import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LightdashClient } from './client';

describe('LightdashClient', () => {
  const config = {
    baseUrl: 'https://app.lightdash.cloud',
    personalAccessToken: 'test-token',
  };

  beforeEach(() => {
    vi.resetModules();
  });

  describe('V1 namespace', () => {
    it('should expose v1 namespace with all API clients', () => {
      const client = new LightdashClient(config);
      expect(client.v1).toBeDefined();
      expect(client.v1.projects).toBeDefined();
      expect(client.v1.organizations).toBeDefined();
      expect(client.v1.charts).toBeDefined();
      expect(client.v1.dashboards).toBeDefined();
      expect(client.v1.spaces).toBeDefined();
      expect(client.v1.query).toBeDefined();
    });

    it('v1.projects.getProject should be a function', () => {
      const client = new LightdashClient(config);
      expect(typeof client.v1.projects.getProject).toBe('function');
    });

    it('v1.organizations.getCurrentOrganization should be a function', () => {
      const client = new LightdashClient(config);
      expect(typeof client.v1.organizations.getCurrentOrganization).toBe('function');
    });
  });

  describe('V2 namespace', () => {
    it('should expose v2 namespace', () => {
      const client = new LightdashClient(config);
      expect(client.v2).toBeDefined();
      expect(client.v2.query).toBeDefined();
    });

    it('v2.query.runMetricQuery should be a function', () => {
      const client = new LightdashClient(config);
      expect(typeof client.v2.query.runMetricQuery).toBe('function');
    });

    it('v2.query.runSqlQuery should be a function', () => {
      const client = new LightdashClient(config);
      expect(typeof client.v2.query.runSqlQuery).toBe('function');
    });
  });

  describe('Backward compatibility (deprecated aliases)', () => {
    it('should expose deprecated top-level aliases that delegate to v1', () => {
      const client = new LightdashClient(config);
      expect(client.projects).toBeDefined();
      expect(client.organizations).toBeDefined();
      expect(client.charts).toBeDefined();
      expect(client.dashboards).toBeDefined();
      expect(client.spaces).toBeDefined();
      expect(client.query).toBeDefined();
    });

    it('deprecated aliases should reference v1 clients', () => {
      const client = new LightdashClient(config);
      expect(client.projects).toBe(client.v1.projects);
      expect(client.organizations).toBe(client.v1.organizations);
      expect(client.charts).toBe(client.v1.charts);
      expect(client.dashboards).toBe(client.v1.dashboards);
      expect(client.spaces).toBe(client.v1.spaces);
      expect(client.query).toBe(client.v1.query);
    });

    it('deprecated projects.getProject should work', () => {
      const client = new LightdashClient(config);
      expect(typeof client.projects.getProject).toBe('function');
    });
  });

  describe('HTTP clients', () => {
    it('should provide separate HTTP clients for v1 and v2', () => {
      const client = new LightdashClient(config);
      const httpV1 = client.getHttpClientV1();
      const httpV2 = client.getHttpClientV2();
      expect(httpV1).toBeDefined();
      expect(httpV2).toBeDefined();
      expect(httpV1).not.toBe(httpV2);
    });

    it('getHttpClient should return v1 client (deprecated)', () => {
      const client = new LightdashClient(config);
      const http = client.getHttpClient();
      const httpV1 = client.getHttpClientV1();
      expect(http).toBe(httpV1);
    });
  });
});
