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
