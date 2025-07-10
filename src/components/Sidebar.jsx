// src/components/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { FolderOpen, Folder, Plus, MessageSquare, Clock, ChevronDown, ChevronRight, Edit3, Check, X, Trash2, Settings, FolderPlus, RefreshCw } from 'lucide-react';
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
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (selectedSession && selectedProject) {
      setExpandedProjects(prev => new Set(prev).add(selectedProject.name));
    }
  }, [selectedSession, selectedProject]);

  const toggleProject = (projectName) => {
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      newSet.has(projectName) ? newSet.delete(projectName) : newSet.add(projectName);
      return newSet;
    });
  };

  const saveProjectName = async (projectName) => {
    // ... logic remains the same, uses fetchProjects from context
  };
  
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchProjects();
    setIsRefreshing(false);
  };
  
  // ... other handlers like deleteSession, deleteProject, createNewProject remain the same
  // as they call props passed from App.jsx or use fetchProjects from context.

  return (
    <div className="h-full flex flex-col bg-card md:select-none">
      <div className="md:p-4 md:border-b md:border-border">
          {/* Header JSX */}
      </div>
      {/* New Project Form JSX */}
      <ScrollArea className="flex-1 md:px-2 md:py-3">
        {isLoadingProjects ? (
          <div>Loading...</div>
        ) : projects.length === 0 ? (
          <div>No projects found</div>
        ) : (
          projects.map((project) => {
            // ... mapping logic remains the same
          })
        )}
      </ScrollArea>
      <div className="md:p-2 md:border-t md:border-border flex-shrink-0">
        <Button
          variant="ghost"
          className="hidden md:flex w-full justify-start gap-2 p-2 h-auto"
          onClick={() => setShowToolsSettings(true)}
        >
          <Settings className="w-3 h-3" />
          <span className="text-xs">Tools Settings</span>
        </Button>
      </div>
    </div>
  );
}

export default Sidebar;
