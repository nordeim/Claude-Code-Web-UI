// src/contexts/AppContext.jsx
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
  // Core Application State
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // UI State
  const [activeTab, setActiveTab] = useState('chat');
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  
  // Modal & Panel State
  const [showToolsSettings, setShowToolsSettings] = useState(false);
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  
  // Persisted UI Settings
  const [autoExpandTools, setAutoExpandTools] = useState(() => 
    JSON.parse(localStorage.getItem('autoExpandTools') || 'false')
  );
  const [showRawParameters, setShowRawParameters] = useState(() => 
    JSON.parse(localStorage.getItem('showRawParameters') || 'false')
  );
  const [autoScrollToBottom, setAutoScrollToBottom] = useState(() => 
    JSON.parse(localStorage.getItem('autoScrollToBottom') || 'true')
  );

  // Session Protection State
  const [activeSessions, setActiveSessions] = useState(new Set());
  
  // WebSocket Integration
  const { ws, sendMessage, messages } = useWebSocket();

  // --- Side Effects and Logic ---

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch initial project data
  const fetchProjects = useCallback(async () => {
    try {
      setIsLoadingProjects(true);
      const response = await fetch('/api/projects');
      const data = await response.json();
      setProjects(prevProjects => {
        // Simple JSON diff to prevent re-renders if data is identical
        if (JSON.stringify(prevProjects) === JSON.stringify(data)) {
          return prevProjects;
        }
        return data;
      });
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setIsLoadingProjects(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Helper function for session protection
  const isUpdateDisruptive = (currentProjects, updatedProjects, project, session) => {
    if (!project || !session) return false; // Not disruptive if no active session is selected
    const currentSelectedProject = currentProjects?.find(p => p.name === project.name);
    const updatedSelectedProject = updatedProjects?.find(p => p.name === project.name);
    if (!currentSelectedProject || !updatedSelectedProject) return true; // Disruptive if project is gone
    const currentSelectedSession = currentSelectedProject.sessions?.find(s => s.id === session.id);
    const updatedSelectedSession = updatedSelectedProject.sessions?.find(s => s.id === session.id);
    if (!currentSelectedSession || !updatedSelectedSession) return true; // Disruptive if session is gone
    // Not disruptive if the session itself is identical
    return JSON.stringify(currentSelectedSession) !== JSON.stringify(updatedSelectedSession);
  };

  // Handle incoming WebSocket messages for real-time updates
  useEffect(() => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      if (latestMessage.type === 'projects_updated') {
        const hasActiveSession = (selectedSession && activeSessions.has(selectedSession.id)) ||
                                 (activeSessions.size > 0 && Array.from(activeSessions).some(id => id.startsWith('new-session-')));
        
        const updatedProjects = latestMessage.projects;
        if (hasActiveSession && isUpdateDisruptive(projects, updatedProjects, selectedProject, selectedSession)) {
          console.log("Skipping disruptive project update due to active session.");
          return; // Skip disruptive updates
        }

        setProjects(updatedProjects);

        // Maintain selection after update
        if (selectedProject) {
          const updatedSelectedProject = updatedProjects.find(p => p.name === selectedProject.name);
          if (updatedSelectedProject) {
            setSelectedProject(updatedSelectedProject);
            // If the selected session was deleted in the update, deselect it
            if (selectedSession && !updatedSelectedProject.sessions?.find(s => s.id === selectedSession.id)) {
              setSelectedSession(null);
            }
          } else {
            // If the whole project was deleted, deselect everything
            setSelectedProject(null);
            setSelectedSession(null);
          }
        }
      }
    }
  }, [messages, projects, selectedProject, selectedSession, activeSessions]);


  // --- Session Protection Handlers ---
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


  // --- Persisted UI Setting Handlers ---
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

  // --- Final Context Value ---
  const value = {
    // State
    projects,
    selectedProject,
    selectedSession,
    activeTab,
    isMobile,
    sidebarOpen,
    isLoadingProjects,
    isInputFocused,
    showToolsSettings,
    showQuickSettings,
    autoExpandTools,
    showRawParameters,
    autoScrollToBottom,
    messages,

    // Setters & Handlers
    setProjects,
    setSelectedProject,
    setSelectedSession,
    setActiveTab,
    setSidebarOpen,
    setIsInputFocused,
    setShowToolsSettings,
    setShowQuickSettings,
    setAutoExpandTools: handleSetAutoExpandTools,
    setShowRawParameters: handleSetShowRawParameters,
    setAutoScrollToBottom: handleSetAutoScrollToBottom,
    fetchProjects,
    sendMessage,
    markSessionAsActive,
    markSessionAsInactive,
    replaceTemporarySession
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
