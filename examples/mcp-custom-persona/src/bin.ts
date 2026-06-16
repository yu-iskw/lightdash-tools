import { runPersonaStdioBin } from '@lightdash-tools/mcp';

import { createFinanceViewerServer } from './index.js';

runPersonaStdioBin('acme-lightdash-finance-viewer', (contextProvider) =>
  createFinanceViewerServer({ contextProvider }),
);
