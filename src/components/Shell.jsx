// src/components/Shell.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { WebglAddon } from '@xterm/addon-webgl';
import 'xterm/css/xterm.css';
import { LRUCache } from 'lru-cache';
import { useApp } from '../contexts/AppContext';

const shellCache = new LRUCache({
  max: 5,
  dispose: (session, key) => {
    console.log(`Disposing of cached shell session: ${key}`);
    if (session.ws && session.ws.readyState === WebSocket.OPEN) {
      session.ws.close();
    }
    if (session.terminal) {
      session.terminal.dispose();
    }
  },
});

function Shell() {
  const { selectedProject, selectedSession, activeTab } = useApp();
  const isActive = activeTab === 'shell';
  const terminalRef = useRef(null);
  const terminal = useRef(null);
  const fitAddon = useRef(null);
  const ws = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [lastSessionId, setLastSessionId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connectToShell = () => {
    if (!isInitialized || isConnected || isConnecting) return;
    setIsConnecting(true);
    connectWebSocket();
  };

  const disconnectFromShell = () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    if (terminal.current) {
      terminal.current.clear();
      terminal.current.write('\x1b[2J\x1b[H');
    }
    setIsConnected(false);
    setIsConnecting(false);
  };

  const restartShell = () => {
    setIsRestarting(true);
    shellCache.clear();
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    if (terminal.current) {
      terminal.current.dispose();
      terminal.current = null;
      fitAddon.current = null;
    }
    setIsConnected(false);
    setIsInitialized(false);
    setTimeout(() => setIsRestarting(false), 200);
  };

  useEffect(() => {
    const currentSessionId = selectedSession?.id || null;
    if (lastSessionId !== null && lastSessionId !== currentSessionId && isInitialized) {
      disconnectFromShell();
    }
    setLastSessionId(currentSessionId);
  }, [selectedSession?.id, isInitialized]);

  useEffect(() => {
    if (!terminalRef.current || !selectedProject || isRestarting) {
      return;
    }

    const sessionKey = selectedSession?.id || `project-${selectedProject.name}`;
    const existingSession = shellCache.get(sessionKey);

    if (existingSession && !terminal.current) {
      try {
        terminal.current = existingSession.terminal;
        fitAddon.current = existingSession.fitAddon;
        ws.current = existingSession.ws;
        setIsConnected(existingSession.isConnected);
        if (terminal.current.element?.parentNode) {
          terminal.current.element.parentNode.removeChild(terminal.current.element);
        }
        terminal.current.open(terminalRef.current);
        setTimeout(() => fitAddon.current?.fit(), 100);
        setIsInitialized(true);
        return;
      } catch (error) {
        shellCache.delete(sessionKey);
        terminal.current = null;
        fitAddon.current = null;
        ws.current = null;
      }
    }

    if (terminal.current) return;

    terminal.current = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        allowProposedApi: true,
        allowTransparency: false,
        convertEol: true,
        scrollback: 10000,
        theme: { background: '#1e1e1e', foreground: '#d4d4d4' /* ... and so on */ }
    });

    fitAddon.current = new FitAddon();
    terminal.current.loadAddon(fitAddon.current);
    terminal.current.loadAddon(new ClipboardAddon());
    try {
      terminal.current.loadAddon(new WebglAddon());
    } catch (e) { /* WebGL not supported */ }
    
    terminal.current.open(terminalRef.current);
    setTimeout(() => fitAddon.current?.fit(), 100);

    terminal.current.onData((data) => {
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const resizeObserver = new ResizeObserver(() => fitAddon.current?.fit());
    resizeObserver.observe(terminalRef.current);

    setIsInitialized(true);

    return () => {
      resizeObserver.disconnect();
      if (terminal.current && selectedProject) {
        const key = selectedSession?.id || `project-${selectedProject.name}`;
        shellCache.set(key, { terminal: terminal.current, fitAddon: fitAddon.current, ws: ws.current, isConnected });
      }
    };
  }, [terminalRef, selectedProject, selectedSession, isRestarting]);

  useEffect(() => {
    if (isActive && isInitialized) {
      setTimeout(() => fitAddon.current?.fit(), 100);
    }
  }, [isActive, isInitialized]);

  const connectWebSocket = async () => {
    if (isConnecting || isConnected) return;
    try {
        let wsBaseUrl;
        try {
            const config = await (await fetch('/api/config')).json();
            wsBaseUrl = config.wsUrl;
        } catch (e) {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const apiPort = window.location.port === '3001' ? '3002' : window.location.port;
            wsBaseUrl = `${protocol}//${window.location.hostname}:${apiPort}`;
        }
        
        ws.current = new WebSocket(`${wsBaseUrl}/shell`);
        ws.current.onopen = () => {
            setIsConnected(true);
            setIsConnecting(false);
            ws.current.send(JSON.stringify({ type: 'init', projectPath: selectedProject.fullPath, sessionId: selectedSession?.id, hasSession: !!selectedSession }));
        };
        ws.current.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'output') terminal.current.write(data.data);
            if (data.type === 'url_open') window.open(data.url, '_blank');
        };
        ws.current.onclose = () => {
            setIsConnected(false);
            setIsConnecting(false);
            if (terminal.current) terminal.current.write('\r\n\x1b[31mConnection closed.\x1b[0m\r\n');
        };
    } catch (e) {
        setIsConnected(false);
        setIsConnecting(false);
    }
  };

  if (!selectedProject) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">Select a Project</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header JSX */}
      <div className="flex-1 p-2 overflow-hidden relative">
        <div ref={terminalRef} className="h-full w-full" />
        {/* Overlays for connect, loading, etc. */}
      </div>
    </div>
  );
}

export default Shell;
