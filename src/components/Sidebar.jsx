// src/components/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { FolderOpen, Folder, Plus, MessageSquare, Clock, ChevronDown, ChevronRight, Edit3, Check, X, Trash2, Settings, FolderPlus, RefreshCw, Sparkles, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useApp } from '../contexts/AppContext';

const formatTimeAgo = (dateString, currentTime) => {
  const date = new Date(dateString);
  const now = currentTime;
  if (isNaN(date.getTime())) return 'Unknown';
  const diffInSeconds = Math.floor((now - date) / 1000);
  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} min${diffInMinutes > 1 ? 's' : ''} ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
};

function Sidebar({ 
  onProjectSelect, 
  onSessionSelect, 
  onNewSession,
  onSessionDelete,
  onProjectDelete,
}) {
  const {
    projects,
    selectedProject,
    selectedSession,
    isLoadingProjects,
    fetchProjects,
    setShowToolsSettings
  } = useApp();
  
  const [expandedProjects, setExpandedProjects] = useState(new Set());
  const [editingProject, setEditingProject] = useState(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [newProjectPath, setNewProjectPath] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState({});
  const [additionalSessions, setAdditionalSessions] = useState({});
  const [initialSessionsLoaded, setInitialSessionsLoaded] = useState(new Set());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setAdditionalSessions({});
    setInitialSessionsLoaded(new Set());
  }, [projects]);

  useEffect(() => {
    if (selectedSession && selectedProject) {
      setExpandedProjects(prev => new Set(prev).add(selectedProject.name));
    }
  }, [selectedSession, selectedProject]);

  useEffect(() => {
    if (projects.length > 0 && !isLoadingProjects) {
      const newLoaded = new Set();
      projects.forEach(project => {
        if (project.sessions && project.sessions.length >= 0) newLoaded.add(project.name);
      });
      setInitialSessionsLoaded(newLoaded);
    }
  }, [projects, isLoadingProjects]);

  // ... All other logic and handlers remain the same ...

  return (
    <div className="h-full flex flex-col bg-card md:select-none">
      {/* ... The extensive JSX for the Sidebar remains the same ... */}
    </div>
  );
}

export default Sidebar;
