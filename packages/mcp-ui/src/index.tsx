import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@modelcontextprotocol/ext-apps';

const ConnectionTester: React.FC = () => {
  const [app, setApp] = useState<App | null>(null);
  const [toolResult, setToolResult] = useState<unknown>(null);
  const [lastMessage, setLastMessage] = useState<string>('Initializing...');

  useEffect(() => {
    const mcpApp = new App({
      name: 'lightdash-connection-tester',
      version: '0.1.0',
    });

    mcpApp.ontoolresult = (result) => {
      console.log('Received tool result:', result);
      setToolResult(result);
      setLastMessage('Received data from host!');
    };

    mcpApp.onerror = (error) => {
      console.error('MCP App error:', error);
      setLastMessage(`Error: ${error.message}`);
    };

    const init = async () => {
      try {
        await mcpApp.connect();
        setApp(mcpApp);
        setLastMessage('Connected to host. Waiting for data...');
      } catch (err) {
        setLastMessage(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    void init();

    return () => {
      // Clean up if needed (though App doesn't currently expose a disconnect)
    };
  }, []);

  const handleTestCall = async () => {
    if (!app) return;
    setLastMessage('Calling server tool...');
    try {
      // We'll call a simple tool to test bidirectional flow
      const result = await app.callServerTool({
        name: 'ldt__minimal_app', // This should match what we register on the server
        arguments: { test: true },
      });
      console.log('Proactive tool call result:', result);
      setToolResult(result);
      setLastMessage('Bidirectional call successful!');
    } catch (err) {
      setLastMessage(`Call failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>Lightdash MCP Connection Tester</h1>
      <div
        style={{
          marginBottom: '20px',
          padding: '10px',
          backgroundColor: '#f0f0f0',
          borderRadius: '4px',
        }}
      >
        <strong>Status:</strong> {lastMessage}
      </div>

      {toolResult && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Latest Tool Result:</h3>
          <pre
            style={{
              backgroundColor: '#1e1e1e',
              color: '#fff',
              padding: '10px',
              borderRadius: '4px',
              overflow: 'auto',
            }}
          >
            {JSON.stringify(toolResult, null, 2)}
          </pre>
        </div>
      )}

      <button
        onClick={() => {
          void handleTestCall();
        }}
        style={{
          padding: '10px 20px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        Test Bidirectional Tool Call
      </button>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<ConnectionTester />);
}
