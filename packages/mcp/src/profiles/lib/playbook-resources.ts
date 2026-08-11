/**
 * Shared helpers for registering markdown playbook MCP resources and
 * embedding core + topic playbooks into prompt messages.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ProfileId } from '../types.js';
import type { McpServer } from '@modelcontextprotocol/server';

export const PLAYBOOK_MIME = 'text/markdown' as const;

/** Long TTL for static shipped playbooks (package deploy changes content). */
export const STATIC_PLAYBOOK_CACHE_TTL_MS = 86_400_000; // 24h

export type PlaybookResourceSpec = {
  /** MCP resource name (stable id for resources/list). */
  name: string;
  /** Canonical URI, e.g. lightdash://playbooks/content-developer/core */
  uri: string;
  title: string;
  description: string;
  getMarkdown: () => string;
  /** MCP resource priority annotation (0–1). */
  priority?: number;
};

const markdownCache = new Map<string, string>();

/**
 * Load a playbook markdown file from a directory adjacent to the compiled module.
 * `moduleDir` should be `__dirname` of the profile's `resources/` folder.
 */
function loadPlaybookMarkdown(moduleDir: string, relativePath: string): string {
  const key = `${moduleDir}::${relativePath}`;
  const cached = markdownCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- moduleDir + relativePath from profile constants
  const text = readFileSync(join(moduleDir, relativePath), 'utf8');
  markdownCache.set(key, text);
  return text;
}

function registerMarkdownPlaybooks(
  server: McpServer,
  specs: readonly PlaybookResourceSpec[],
): void {
  for (const spec of specs) {
    const markdown = spec.getMarkdown();
    const priority = spec.priority ?? 0.7;
    server.registerResource(
      spec.name,
      spec.uri,
      {
        title: spec.title,
        description: spec.description,
        mimeType: PLAYBOOK_MIME,
        annotations: {
          audience: ['assistant'],
          priority,
        },
        cacheHint: {
          cacheScope: 'public',
          ttlMs: STATIC_PLAYBOOK_CACHE_TTL_MS,
        },
      },
      async (uri) => ({
        contents: [
          {
            uri: typeof uri === 'string' ? uri : uri.href,
            mimeType: PLAYBOOK_MIME,
            text: markdown,
          },
        ],
      }),
    );
  }
}

export type EmbeddedPlaybook = {
  uri: string;
  mimeType?: string;
  /** Short description for manifests (core playbook). */
  description?: string;
  getMarkdown: () => string;
};

export type PromptTopicMeta = {
  description: string;
  useWhen?: string;
};

/** Canonical playbook topic URI (shared by registration and tool recovery hints). */
export function playbookTopicUri(profileId: ProfileId, topicId: string): string {
  return `lightdash://playbooks/${profileId}/${topicId}`;
}

export type ProfilePlaybookTopicDef<TopicId extends string = string> = {
  id: TopicId;
  title: string;
  description: string;
  /** Filename under `playbooks/`, e.g. `dashboards.md`. */
  file: string;
  /** MCP resource priority (default 0.7; recovery ~0.3; core ~0.9). */
  priority?: number;
  /** Short "use when" for prompt manifests. */
  useWhen?: string;
};

export type DefineProfilePlaybooksOptions<TopicId extends string> = {
  profileId: ProfileId;
  moduleDir: string;
  topics: readonly ProfilePlaybookTopicDef<TopicId>[];
  indexTitle?: string;
  indexDescription?: string;
  coreTitle?: string;
  coreDescription?: string;
};

/** Title-case the first segment only: `content-developer` → `Content-developer`. */
function titleCaseProfile(profileId: string): string {
  const [first = '', ...rest] = profileId.split('-');
  if (first.length === 0) {
    return profileId;
  }
  return [first[0].toUpperCase() + first.slice(1), ...rest].join('-');
}

/**
 * Factory for profile multi-playbook resources (index + core + topics).
 * Callers re-export the returned fields under profile-specific names.
 */
export function defineProfilePlaybooks<TopicId extends string>(
  options: DefineProfilePlaybooksOptions<TopicId>,
): {
  URIs: { index: string; core: string; topics: Readonly<Record<TopicId, string>> };
  getAllPlaybookMarkdown: () => string;
  CORE_PLAYBOOK: EmbeddedPlaybook;
  TOPIC_PLAYBOOKS: Readonly<Record<TopicId, EmbeddedPlaybook>>;
  TOPIC_META: Readonly<Record<TopicId, PromptTopicMeta>>;
  registerPlaybooks: (server: McpServer) => void;
} {
  const {
    profileId,
    moduleDir,
    topics,
    indexTitle = `${titleCaseProfile(profileId)} playbooks`,
    indexDescription = `Index of ${profileId} workflow playbooks (core + topics)`,
    coreTitle = `${titleCaseProfile(profileId)} core playbook`,
    coreDescription = 'Hard bans, tools, and operating rules',
  } = options;

  const indexUri = `lightdash://playbooks/${profileId}`;
  const coreUri = playbookTopicUri(profileId, 'core');
  const namePrefix = profileId.split('-').join('_');

  const load = (relativePath: string): string => loadPlaybookMarkdown(moduleDir, relativePath);
  const getIndexPlaybookMarkdown = (): string => load('playbooks/index.md');
  const getCorePlaybookMarkdown = (): string => load('playbooks/core.md');

  const topicUris = {} as Record<TopicId, string>;
  const topicPlaybooks = {} as Record<TopicId, EmbeddedPlaybook>;
  const topicMeta = {} as Record<TopicId, PromptTopicMeta>;
  const topicMarkdownGetters: Array<() => string> = [];

  for (const topic of topics) {
    const uri = playbookTopicUri(profileId, topic.id);
    topicUris[topic.id] = uri;
    const getMarkdown = (): string => load(`playbooks/${topic.file}`);
    topicMarkdownGetters.push(getMarkdown);
    topicPlaybooks[topic.id] = {
      uri,
      getMarkdown,
    };
    topicMeta[topic.id] = {
      description: topic.description,
      useWhen: topic.useWhen,
    };
  }

  const CORE_PLAYBOOK: EmbeddedPlaybook = {
    uri: coreUri,
    description: coreDescription,
    getMarkdown: getCorePlaybookMarkdown,
  };

  const getAllPlaybookMarkdown = (): string =>
    [
      getIndexPlaybookMarkdown(),
      getCorePlaybookMarkdown(),
      ...topicMarkdownGetters.map((g) => g()),
    ].join('\n');

  const resourceSpecs: PlaybookResourceSpec[] = [
    {
      name: `${namePrefix}_playbook_index`,
      uri: indexUri,
      title: indexTitle,
      description: indexDescription,
      getMarkdown: getIndexPlaybookMarkdown,
      priority: 0.85,
    },
    {
      name: `${namePrefix}_playbook_core`,
      uri: coreUri,
      title: coreTitle,
      description: coreDescription,
      getMarkdown: getCorePlaybookMarkdown,
      priority: 0.95,
    },
    ...topics.map((topic) => ({
      name: `${namePrefix}_playbook_${String(topic.id).split('/').join('_').split('-').join('_')}`,
      uri: topicUris[topic.id],
      title: topic.title,
      description: topic.description,
      getMarkdown: topicPlaybooks[topic.id].getMarkdown,
      priority: topic.priority ?? (String(topic.id).startsWith('recovery/') ? 0.35 : 0.7),
    })),
  ];

  const registerPlaybooks = (server: McpServer): void => {
    registerMarkdownPlaybooks(server, resourceSpecs);
  };

  return {
    URIs: { index: indexUri, core: coreUri, topics: topicUris },
    getAllPlaybookMarkdown,
    CORE_PLAYBOOK,
    TOPIC_PLAYBOOKS: topicPlaybooks,
    TOPIC_META: topicMeta,
    registerPlaybooks,
  };
}
