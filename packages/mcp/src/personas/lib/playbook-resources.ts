/**
 * Shared helpers for registering markdown playbook MCP resources and
 * embedding core + topic playbooks into prompt messages.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { McpServer } from '@modelcontextprotocol/server';

export const PLAYBOOK_MIME = 'text/markdown' as const;

export type PlaybookResourceSpec = {
  /** MCP resource name (stable id for resources/list). */
  name: string;
  /** Canonical URI, e.g. lightdash://playbooks/content-developer/core */
  uri: string;
  title: string;
  description: string;
  getMarkdown: () => string;
};

const markdownCache = new Map<string, string>();

/**
 * Load a playbook markdown file from a directory adjacent to the compiled module.
 * `moduleDir` should be `__dirname` of the persona's `resources/` folder.
 */
function loadPlaybookMarkdown(moduleDir: string, relativePath: string): string {
  const key = `${moduleDir}::${relativePath}`;
  const cached = markdownCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- moduleDir + relativePath from persona constants
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
    server.registerResource(
      spec.name,
      spec.uri,
      {
        title: spec.title,
        description: spec.description,
        mimeType: PLAYBOOK_MIME,
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
  getMarkdown: () => string;
};

function embedResource(playbook: EmbeddedPlaybook) {
  return {
    type: 'resource' as const,
    resource: {
      uri: playbook.uri,
      mimeType: playbook.mimeType ?? PLAYBOOK_MIME,
      text: playbook.getMarkdown(),
    },
  };
}

type PromptUserMessage = {
  role: 'user';
  content: ReturnType<typeof embedResource> | { type: 'text'; text: string };
};

/**
 * Build prompt message helpers that embed core, and optionally one topic playbook,
 * after the user text message. When `topicId` is omitted, only core is embedded.
 */
export function createPromptPlaybookEmbedder<TopicId extends string>(options: {
  core: EmbeddedPlaybook;
  topics: Readonly<Record<TopicId, EmbeddedPlaybook>>;
}): (text: string, topicId?: TopicId) => { messages: PromptUserMessage[] } {
  const { core, topics } = options;
  return (text: string, topicId?: TopicId) => {
    const messages: PromptUserMessage[] = [
      {
        role: 'user' as const,
        content: { type: 'text' as const, text },
      },
      {
        role: 'user' as const,
        content: embedResource(core),
      },
    ];
    if (topicId === undefined) {
      return { messages };
    }
    // eslint-disable-next-line security/detect-object-injection -- topicId from persona PROMPT_TOPICS constants
    const topic = topics[topicId];
    if (!topic) {
      throw new Error(`Unknown playbook topic '${topicId}'`);
    }
    messages.push({
      role: 'user' as const,
      content: embedResource(topic),
    });
    return { messages };
  };
}

export type PersonaPlaybookTopicDef<TopicId extends string = string> = {
  id: TopicId;
  title: string;
  description: string;
  /** Filename under `playbooks/`, e.g. `dashboards.md`. */
  file: string;
};

export type DefinePersonaPlaybooksOptions<TopicId extends string> = {
  personaId: string;
  moduleDir: string;
  hardBans: string;
  topics: readonly PersonaPlaybookTopicDef<TopicId>[];
  indexTitle?: string;
  indexDescription?: string;
  coreTitle?: string;
  coreDescription?: string;
};

/** Title-case the first segment only: `content-developer` → `Content-developer`. */
function titleCasePersona(personaId: string): string {
  const [first = '', ...rest] = personaId.split('-');
  if (first.length === 0) {
    return personaId;
  }
  return [first[0].toUpperCase() + first.slice(1), ...rest].join('-');
}

/**
 * Factory for persona multi-playbook resources (index + core + topics).
 * Callers re-export the returned fields under persona-specific names.
 */
export function definePersonaPlaybooks<TopicId extends string>(
  options: DefinePersonaPlaybooksOptions<TopicId>,
): {
  URIs: { index: string; core: string; topics: Readonly<Record<TopicId, string>> };
  HARD_BANS: string;
  getAllPlaybookMarkdown: () => string;
  CORE_PLAYBOOK: EmbeddedPlaybook;
  TOPIC_PLAYBOOKS: Readonly<Record<TopicId, EmbeddedPlaybook>>;
  registerPlaybooks: (server: McpServer) => void;
} {
  const {
    personaId,
    moduleDir,
    hardBans,
    topics,
    indexTitle = `${titleCasePersona(personaId)} playbooks`,
    indexDescription = `Index of ${personaId} workflow playbooks (core + topics)`,
    coreTitle = `${titleCasePersona(personaId)} core playbook`,
    coreDescription = 'Hard bans, tools, and operating rules',
  } = options;

  const indexUri = `lightdash://playbooks/${personaId}`;
  const coreUri = `lightdash://playbooks/${personaId}/core`;
  const namePrefix = personaId.split('-').join('_');

  const load = (relativePath: string): string => loadPlaybookMarkdown(moduleDir, relativePath);
  const getIndexPlaybookMarkdown = (): string => load('playbooks/index.md');
  const getCorePlaybookMarkdown = (): string => load('playbooks/core.md');

  const topicUris = {} as Record<TopicId, string>;
  const topicPlaybooks = {} as Record<TopicId, EmbeddedPlaybook>;
  const topicMarkdownGetters: Array<() => string> = [];

  for (const topic of topics) {
    const uri = `lightdash://playbooks/${personaId}/${topic.id}`;
    topicUris[topic.id] = uri;
    const getMarkdown = (): string => load(`playbooks/${topic.file}`);
    topicMarkdownGetters.push(getMarkdown);
    topicPlaybooks[topic.id] = {
      uri,
      getMarkdown,
    };
  }

  const CORE_PLAYBOOK: EmbeddedPlaybook = {
    uri: coreUri,
    getMarkdown: getCorePlaybookMarkdown,
  };

  const getAllPlaybookMarkdown = (): string =>
    [
      getIndexPlaybookMarkdown(),
      getCorePlaybookMarkdown(),
      ...topicMarkdownGetters.map((g) => g()),
    ].join('\n');

  const registerPlaybooks = (server: McpServer): void => {
    registerMarkdownPlaybooks(server, [
      {
        name: `${namePrefix}_playbook_index`,
        uri: indexUri,
        title: indexTitle,
        description: indexDescription,
        getMarkdown: getIndexPlaybookMarkdown,
      },
      {
        name: `${namePrefix}_playbook_core`,
        uri: coreUri,
        title: coreTitle,
        description: coreDescription,
        getMarkdown: getCorePlaybookMarkdown,
      },
      ...topics.map((topic) => ({
        name: `${namePrefix}_playbook_${String(topic.id).split('-').join('_')}`,
        uri: topicUris[topic.id],
        title: topic.title,
        description: topic.description,
        getMarkdown: topicPlaybooks[topic.id].getMarkdown,
      })),
    ]);
  };

  return {
    URIs: { index: indexUri, core: coreUri, topics: topicUris },
    HARD_BANS: hardBans,
    getAllPlaybookMarkdown,
    CORE_PLAYBOOK,
    TOPIC_PLAYBOOKS: topicPlaybooks,
    registerPlaybooks,
  };
}
