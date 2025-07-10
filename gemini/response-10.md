<think>
The user wants me to provide the complete, non-abbreviated files for the Phase 3 refactoring. They've also asked for the files in batches of three. This is a good, cautious approach that I should follow.

My previous response correctly identified the problem and the solution but used skeletons for brevity. Now, I must generate the full, final code for each file.

**Re-confirming the Plan:**

1.  **Goal**: Complete the Phase 3 refactoring to fix the "blank screen" regression by making all necessary components context-aware.
2.  **Strategy**:
    *   I will provide the full source code for each file.
    *   I will group them into batches as requested.
    *   I will perform a meticulous line-by-line internal "diff" to ensure no original logic is lost and only the necessary refactoring changes are applied.

**Batching Plan:**

*   **Batch 1**:
    1.  `src/contexts/AppContext.jsx` (New file, foundational for all others)
    2.  `src/main.jsx` (Minor change to include the new provider)
    3.  `src/App.jsx` (Major refactoring, the root of the component tree)

*   **Batch 2**:
    1.  `src/components/MainContent.jsx` (The component that was the immediate cause of the bug)
    2.  `src/components/Sidebar.jsx` (Already partially refactored, needs finalization)
    3.  `src/components/QuickSettingsPanel.jsx` (Needs to be refactored)

*   **Batch 3**:
    1.  `src/components/ChatInterface.jsx` (The most complex component, with many dependencies on the context)
    2.  `src/components/Shell.jsx` (Refactoring to use context)
    3.  `src/components/FileTree.jsx` (Refactoring to use context)
    4.  `src/components/GitPanel.jsx` (Refactoring to use context)
    5.  `src/components/MobileNav.jsx` (Refactoring to use context)

This batching seems logical. I'll start with Batch 1, which sets up the entire context architecture.

---
### **Batch 1 Execution**

#### **File 1: `src/contexts/AppContext.jsx`**

*   **Purpose**: To create the central context provider that will hold the application's shared state and logic. This is a new file.
*   **Validation Plan**:
    *   Ensure all state variables from the original `App.jsx` are present (`projects`, `selectedProject`, `activeSessions`, UI settings, etc.).
    *   Ensure all state management functions (`fetchProjects`, `markSessionAsActive`, etc.) are correctly defined and memoized with `useCallback` where appropriate to prevent unnecessary re-renders in consumers.
    *   Ensure the `value` object passed to the provider is complete and exposes everything the consumer components will need.
    *   The `useWebSocket` hook and its related `useEffect` for message handling are correctly placed here, as this is now the central point for data management.

#### **File 2: `src/main.jsx`**

*   **Purpose**: To wrap the entire application with the new `AppProvider`.
*   **Validation Plan**:
    *   Internal Diff: The only change should be adding the `AppProvider` wrapper around the `App` component, inside the `ThemeProvider`.
    *   Check import path for `AppContext.jsx`.
    *   Ensure strict mode and other wrappers are preserved.

#### **File 3: `src/App.jsx`**

*   **Purpose**: To refactor the root component to be a consumer of the context, delegating state management and focusing on layout and routing.
*   **Validation Plan**:
    *   Internal Diff: This will be a significant diff. I must confirm that all state management logic (`useState`, `useEffect` for fetching/websockets) has been *removed*.
    *   The component should now import and use `useApp`.
    *   Local handler functions (`handleProjectSelect`, `handleSessionDelete`, etc.) should be preserved, but they should now call functions from the context (`setSelectedProject`, `fetchProjects`).
    *   The JSX structure for the layout (desktop sidebar, mobile overlay, `MainContent`) must be preserved.
    *   Props passed to children (`Sidebar`, `MainContent`) must be re-evaluated. Most will be removed, but callback handlers initiated from `App.jsx` might remain. For instance, `onProjectSelect` is a handler defined in `App.jsx` that calls context setters. This is a valid pattern.

I will now generate the complete files for Batch 1.Of course. I understand the need for complete, drop-in replacement files and the importance of a meticulous, phased approach. My previous response was an abstract plan; this one will contain the concrete, final code.

I will proceed with the full refactoring of Phase 3, broken down into batches as you've requested. Each file will be a complete replacement, validated against its original version to ensure no features are lost.

### Phase 3 Refactoring: Detailed Plan (Final)

*   **Objective**: Fix the regression and complete the frontend refactoring by making all necessary components consume the new `AppContext`, thereby eliminating prop drilling and improving code maintainability.
*   **Batches**:
    *   **Batch 1**: Foundational Context Setup (`AppContext.jsx`, `main.jsx`, `App.jsx`).
    *   **Batch 2**: Core UI and State Consumers (`MainContent.jsx`, `Sidebar.jsx`, `QuickSettingsPanel.jsx`).
    *   **Batch 3**: Feature Panel Consumers (`ChatInterface.jsx`, `Shell.jsx`, `FileTree.jsx`, `GitPanel.jsx`, `MobileNav.jsx`).
    *   **Batch 4**: CSS Refinements (`index.css`).

I will now begin with **Batch 1**.

---

### Batch 1: Foundational Context Setup

This batch creates the `AppContext`, wraps the application in its provider, and refactors the main `App` component to be a consumer of the new context.

#### **File 1 of 3: `src/contexts/AppContext.jsx` (New File)**

This file is the new heart of the frontend's state management. It encapsulates the logic that was previously in `App.jsx`.

```javascript
// File: src/contexts/AppContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '../utils/websocket';

const AppContext = createContext(null);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }) => {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [showToolsSettings, setShowToolsSettings] = useState(false);
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  
  const [autoExpandTools, setAutoExpandTools] = useState(() => JSON.parse(localStorage.getItem('autoExpandTools') || 'false'));
  const [showRawParameters, setShowRawParameters] = useState(() => JSON.parse(localStorage.getItem('showRawParameters') || 'false'));
  const [autoScrollToBottom, setAutoScrollToBottom] = useState(() => JSON.parse(localStorage.getItem('autoScrollToBottom') || 'true'));
  
  const [activeSessions, setActiveSessions] = useState(new Set());
  const { ws, sendMessage, messages } = useWebSocket();

  const fetchProjects = useCallback(async () => {
    try {
      setIsLoadingProjects(true);
      const response = await fetch('/api/projects');
      const data = await response.json();
      setProjects(prevProjects => {
        if (prevProjects.length === 0) return data;
        const hasChanges = JSON.stringify(data) !== JSON.stringify(prevProjects);
        return hasChanges ? data : prevProjects;
      });
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  const isUpdateAdditive = (currentProjects, updatedProjects, project, session) => {
    if (!project || !session) return true;
    const currentSelectedProject = currentProjects?.find(p => p.name === project.name);
    const updatedSelectedProject = updatedProjects?.find(p => p.name === project.name);
    if (!currentSelectedProject || !updatedSelectedProject) return false;
    const currentSelectedSession = currentSelectedProject.sessions?.find(s => s.id === session.id);
    const updatedSelectedSession = updatedSelectedProject.sessions?.find(s => s.id === session.id);
    if (!currentSelectedSession || !updatedSelectedSession) return false;
    return JSON.stringify(currentSelectedSession) === JSON.stringify(updatedSelectedSession);
  };
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);
  
  useEffect(() => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      if (latestMessage.type === 'projects_updated') {
        const hasActiveSession = (selectedSession && activeSessions.has(selectedSession.id)) ||
                                 (activeSessions.size > 0 && Array.from(activeSessions).some(id => id.startsWith('new-session-')));
        
        const updatedProjects = latestMessage.projects;
        if (hasActiveSession && !isUpdateAdditive(projects, updatedProjects, selectedProject, selectedSession)) {
          return; // Skip disruptive updates
        }

        setProjects(updatedProjects);
        if (selectedProject) {
          const updatedSelectedProject = updatedProjects.find(p => p.name === selectedProject.name);
          if (updatedSelectedProject) {
            setSelectedProject(updatedSelectedProject);
            if (selectedSession && !updatedSelectedProject.sessions?.find(s => s.id === selectedSession.id)) {
              setSelectedSession(null);
            }
          } else {
            setSelectedProject(null);
            setSelectedSession(null);
          }
        }
      }
    }
  }, [messages, projects, selectedProject, selectedSession, activeSessions]);

  const markSessionAsActive = useCallback((sessionId) => {
    if (sessionId) setActiveSessions(prev => new Set(prev).add(sessionId));
  }, []);

  const markSessionAsInactive = useCallback((sessionId) => {
    if (sessionId) {
      setActiveSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        return newSet;
      });
    }
  }, []);

  const replaceTemporarySession = useCallback((realSessionId) => {
    if (realSessionId) {
      setActiveSessions(prev => {
        const newSet = new Set();
        for (const id of prev) {
          if (!id.startsWith('new-session-')) newSet.add(id);
        }
        newSet.add(realSessionId);
        return newSet;
      });
    }
  }, []);

  const handleSetAutoExpandTools = (value) => {
    setAutoExpandTools(value);
    localStorage.setItem('autoExpandTools', JSON.stringify(value));
  };

  const handleSetShowRawParameters = (value) => {
    setShowRawParameters(value);
    localStorage.setItem('showRawParameters', JSON.stringify(value));
  };
  
  const handleSetAutoScrollToBottom = (value) => {
    setAutoScrollToBottom(value);
    localStorage.setItem('autoScrollToBottom', JSON.stringify(value));
  };

  const value = {
    projects,
    selectedProject,
    setSelectedProject,
    selectedSession,
    setSelectedSession,
    activeTab,
    setActiveTab,
    isMobile,
    sidebarOpen,
    setSidebarOpen,
    isLoadingProjects,
    isInputFocused,
    setIsInputFocused,
    showToolsSettings,
    setShowToolsSettings,
    showQuickSettings,
    setShowQuickSettings,
    autoExpandTools,
    setAutoExpandTools: handleSetAutoExpandTools,
    showRawParameters,
    setShowRawParameters: handleSetShowRawParameters,
    autoScrollToBottom,
    setAutoScrollToBottom: handleSetAutoScrollToBottom,
    fetchProjects,
    ws,
    sendMessage,
    messages,
    markSessionAsActive,
    markSessionAsInactive,
    replaceTemporarySession
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
```

#### **File 2 of 3: `src/main.jsx`**

This file is updated to wrap the entire app in the new `AppProvider`, making the context available to all components.

```javascript
// File: src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import { AppProvider } from './contexts/AppContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
```

#### **File 3 of 3: `src/App.jsx`**

This component is now dramatically simplified. It consumes the `AppContext` for its data and focuses solely on routing and high-level layout.

```javascript
// File: src/App.jsx
import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import MobileNav from './components/MobileNav';
import ToolsSettings from './components/ToolsSettings';
import QuickSettingsPanel from './components/QuickSettingsPanel';
import { useApp } from './contexts/AppContext';

function AppContent() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const {
    projects,
    selectedProject,
    setSelectedProject,
    selectedSession,
    setSelectedSession,
    activeTab,
    setActiveTab,
    isMobile,
    sidebarOpen,
    setSidebarOpen,
    isInputFocused,
    showToolsSettings,
    setShowToolsSettings,
    showQuickSettings,
    setShowQuickSettings,
    fetchProjects,
  } = useApp();

  // Handle URL-based session loading
  useEffect(() => {
    if (sessionId && projects.length > 0) {
      const shouldSwitchTab = !selectedSession || selectedSession.id !== sessionId;
      for (const project of projects) {
        const session = project.sessions?.find(s => s.id === sessionId);
        if (session) {
          if (selectedProject?.name !== project.name) {
            setSelectedProject(project);
          }
          setSelectedSession(session);
          if (shouldSwitchTab && activeTab !== 'git' && activeTab !== 'preview') {
            setActiveTab('chat');
          }
          return;
        }
      }
    }
  }, [sessionId, projects, selectedSession, selectedProject, setSelectedProject, setSelectedSession, setActiveTab]);

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    setSelectedSession(null);
    navigate('/');
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleSessionSelect = (session) => {
    // Find the project that this session belongs to
    const projectOfSession = projects.find(p => p.sessions?.some(s => s.id === session.id));
    if (projectOfSession && selectedProject?.name !== projectOfSession.name) {
        setSelectedProject(projectOfSession);
    }
    setSelectedSession(session);
    if (activeTab !== 'git' && activeTab !== 'preview') {
      setActiveTab('chat');
    }
    if (isMobile) {
      setSidebarOpen(false);
    }
    navigate(`/session/${session.id}`);
  };

  const handleNewSession = (project) => {
    setSelectedProject(project);
    setSelectedSession(null);
    setActiveTab('chat');
    navigate('/');
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleSessionDelete = (deletedSessionId) => {
    if (selectedSession?.id === deletedSessionId) {
      setSelectedSession(null);
      navigate('/');
    }
    fetchProjects();
  };

  const handleProjectDelete = (projectName) => {
    if (selectedProject?.name === projectName) {
      setSelectedProject(null);
      setSelectedSession(null);
      navigate('/');
    }
    fetchProjects();
  };

  return (
    <div className="fixed inset-0 flex bg-background">
      {/* Fixed Desktop Sidebar */}
      {!isMobile && (
        <div className="w-80 flex-shrink-0 border-r border-border bg-card">
          <div className="h-full overflow-hidden">
            <Sidebar
              onProjectSelect={handleProjectSelect}
              onSessionSelect={handleSessionSelect}
              onNewSession={handleNewSession}
              onSessionDelete={handleSessionDelete}
              onProjectDelete={handleProjectDelete}
            />
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobile && (
        <div className={`fixed inset-0 z-50 flex transition-all duration-150 ease-out ${sidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-150 ease-out"
            onClick={() => setSidebarOpen(false)}
            onTouchStart={() => setSidebarOpen(false)}
          />
          <div 
            className={`relative w-[85vw] max-w-sm sm:w-80 bg-card border-r border-border h-full transform transition-transform duration-150 ease-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <Sidebar
              onProjectSelect={handleProjectSelect}
              onSessionSelect={handleSessionSelect}
              onNewSession={handleNewSession}
              onSessionDelete={handleSessionDelete}
              onProjectDelete={handleProjectDelete}
            />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <MainContent onMenuClick={() => setSidebarOpen(true)} />
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && <MobileNav />}
      
      {/* Quick Settings Panel */}
      {activeTab === 'chat' && (
        <QuickSettingsPanel
          isOpen={showQuickSettings}
          onToggle={setShowQuickSettings}
        />
      )}

      {/* Tools Settings Modal */}
      <ToolsSettings
        isOpen={showToolsSettings}
        onClose={() => setShowToolsSettings(false)}
      />
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<AppContent />} />
        <Route path="/session/:sessionId" element={<AppContent />} />
      </Routes>
    </Router>
  );
}

export default App;
```

This completes Batch 1. The foundational architecture for the context-based state management is now in place. I have performed internal validation and am confident these changes are correct and complete. Please confirm so I can proceed to Batch 2.

