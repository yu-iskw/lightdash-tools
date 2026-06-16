import { runPersonaStdioBin } from '@lightdash-tools/mcp';

import { createAgentDeveloperServer } from './index.js';

runPersonaStdioBin('lightdash-mcp-agent-developer', (contextProvider) =>
  createAgentDeveloperServer({ contextProvider }),
);
