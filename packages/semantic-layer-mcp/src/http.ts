/**
 * Semantic-layer MCP server entrypoint (Streamable HTTP + Lightdash OAuth).
 */

import { startStreamableHttpServer } from './transports/streamable-http.js';

startStreamableHttpServer();
