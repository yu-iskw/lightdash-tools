/** Returns true when the JSON-RPC body is an MCP initialize request. */
export function isInitializeMessage(body: unknown): boolean {
  if (body === undefined) return false;
  const msg = Array.isArray(body) ? body[0] : body;
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'method' in msg &&
    (msg as { method?: string }).method === 'initialize'
  );
}
