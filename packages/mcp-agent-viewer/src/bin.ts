import { runPersonaStdioBin } from '@lightdash-tools/mcp';

import { createAgentViewerServer } from './index.js';

runPersonaStdioBin('lightdash-mcp-agent-viewer', (contextProvider) =>
  createAgentViewerServer({ contextProvider }),
);
