// src/components/Sidebar.jsx
import React, { useState, useEffect } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { FolderOpen, Folder, Plus, MessageSquare, Clock, ChevronDown, ChevronRight, Edit3, Check, X, Trash2, Settings, FolderPlus, RefreshCw, Edit2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useApp } from '../contexts/AppContext';

const formatTimeAgo = (dateString, currentTime) => {
  const date = new Date(dateString);
  const now = currentTime;
  if (isNaN(date.getTime())) {
    return 'Unknown';
  }
  
  const diffInMs = now - date;
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInMinutes === 1) return '1 min ago';
  if (diffInMinutes < 60) return `${diffInMinutes} mins ago`;
  if (diffInHours === 1) return '1 hour ago';
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  if (diffInDays === 1) return '1 day ago';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  return date.toLocaleDateString();
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
  const [editingSession, setEditingSession] = useState(null);
  const [editingSessionName, setEditingSessionName] = useState('');

  const handleTouchClick = (callback) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    callback();
  };

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
      const newLoaded = new Set(projects.filter(p => p.sessions?.length >= 0).map(p => p.name));
      setInitialSessionsLoaded(newLoaded);
    }
  }, [projects, isLoadingProjects]);

  const toggleProject = (projectName) => {
    setExpandedProjects(prev => {
      const newExpanded = new Set(prev);
      newExpanded.has(projectName) ? newExpanded.delete(projectName) : newExpanded.add(projectName);
      return newExpanded;
    });
  };

  const startEditing = (project) => {
    setEditingProject(project.name);
    setEditingName(project.displayName);
  };

  const cancelEditing = () => {
    setEditingProject(null);
    setEditingName('');
  };

  const saveProjectName = async (projectName) => {
    try {
      await fetch(`/api/projects/${projectName}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: editingName }),
      });
      fetchProjects();
    } catch (error) {
      console.error('Error renaming project:', error);
    }
    setEditingProject(null);
    setEditingName('');
  };

  const deleteSessionHandler = async (projectName, sessionId) => {
    if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) return;
    try {
      const response = await fetch(`/api/projects/${projectName}/sessions/${sessionId}`, { method: 'DELETE' });
      if (response.ok) {
        onSessionDelete(sessionId);
      } else {
        alert('Failed to delete session. Please try again.');
      }
    } catch (error) {
      alert('Error deleting session. Please try again.');
    }
  };

  const deleteProjectHandler = async (projectName) => {
    if (!confirm('Are you sure you want to delete this empty project? This action cannot be undone.')) return;
    try {
      const response = await fetch(`/api/projects/${projectName}`, { method: 'DELETE' });
      if (response.ok) {
        onProjectDelete(projectName);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete project. Please try again.');
      }
    } catch (error) {
      alert('Error deleting project. Please try again.');
    }
  };

  const createNewProject = async () => {
    if (!newProjectPath.trim()) {
      alert('Please enter a project path');
      return;
    }
    setCreatingProject(true);
    try {
      const response = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: newProjectPath.trim() }),
      });
      if (response.ok) {
        setShowNewProject(false);
        setNewProjectPath('');
        fetchProjects();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create project. Please try again.');
      }
    } catch (error) {
      alert('Error creating project.');
    } finally {
      setCreatingProject(false);
    }
  };

  const cancelNewProject = () => {
    setShowNewProject(false);
    setNewProjectPath('');
  };

  const loadMoreSessions = async (project) => {
    if (project.sessionMeta?.hasMore === false || loadingSessions[project.name]) return;
    setLoadingSessions(prev => ({ ...prev, [project.name]: true }));
    try {
      const currentCount = (project.sessions?.length || 0) + (additionalSessions[project.name]?.length || 0);
      const response = await fetch(`/api/projects/${project.name}/sessions?limit=5&offset=${currentCount}`);
      if (response.ok) {
        const result = await response.json();
        setAdditionalSessions(prev => ({
          ...prev,
          [project.name]: [...(prev[project.name] || []), ...result.sessions]
        }));
        if (result.hasMore === false && project.sessionMeta) {
          project.sessionMeta.hasMore = false;
        }
      }
    } catch (error) {
      console.error('Error loading more sessions:', error);
    } finally {
      setLoadingSessions(prev => ({ ...prev, [project.name]: false }));
    }
  };
  
  const getAllSessions = (project) => [...(project.sessions || []), ...(additionalSessions[project.name] || [])];

  return (
    <div className="h-full flex flex-col bg-card md:select-none">
      <div className="md:p-4 md:border-b md:border-border">
        <div className="hidden md:flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-sm"><MessageSquare className="w-4 h-4 text-primary-foreground" /></div>
            <div><h1 className="text-lg font-bold text-foreground">Claude Code UI</h1><p className="text-sm text-muted-foreground">AI coding assistant interface</p></div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="h-9 w-9 px-0" onClick={async () => { setIsRefreshing(true); try { await fetchProjects(); } finally { setIsRefreshing(false); } }} disabled={isRefreshing} title="Refresh projects"><RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /></Button>
            <Button variant="default" size="sm" className="h-9 w-9 px-0" onClick={() => setShowNewProject(true)} title="Create new project"><FolderPlus className="w-4 h-4" /></Button>
          </div>
        </div>
        <div className="md:hidden p-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3"><div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center"><MessageSquare className="w-4 h-4 text-primary-foreground" /></div><div><h1 className="text-lg font-semibold">Claude Code UI</h1><p className="text-sm text-muted-foreground">Projects</p></div></div>
            <div className="flex gap-2">
              <button className="w-8 h-8 rounded-md bg-background border flex items-center justify-center" onClick={async () => { setIsRefreshing(true); try { await fetchProjects(); } finally { setIsRefreshing(false); } }} disabled={isRefreshing}><RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /></button>
              <button className="w-8 h-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center" onClick={() => setShowNewProject(true)}><FolderPlus className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      </div>
      
      {showNewProject && (
        <div className="md:p-3 md:border-b md:border-border">
          <div className="hidden md:block space-y-2">
            <Input value={newProjectPath} onChange={(e) => setNewProjectPath(e.target.value)} placeholder="/path/to/project or ~/project" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') createNewProject(); if (e.key === 'Escape') cancelNewProject(); }} />
            <div className="flex gap-2">
              <Button size="sm" onClick={createNewProject} disabled={!newProjectPath.trim() || creatingProject} className="flex-1">{creatingProject ? 'Creating...' : 'Create'}</Button>
              <Button size="sm" variant="outline" onClick={cancelNewProject} disabled={creatingProject}>Cancel</Button>
            </div>
          </div>
          <div className="md:hidden fixed inset-0 z-50 bg-black/50"><div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-lg p-4 space-y-4"><h2 className="text-base font-semibold">New Project</h2><Input value={newProjectPath} onChange={(e) => setNewProjectPath(e.target.value)} placeholder="/path/to/project" autoFocus /><div className="flex gap-2"><Button onClick={cancelNewProject} variant="outline" className="flex-1">Cancel</Button><Button onClick={createNewProject} disabled={!newProjectPath.trim() || creatingProject} className="flex-1">{creatingProject ? 'Creating...' : 'Create'}</Button></div></div></div>
        </div>
      )}
      
      <ScrollArea className="flex-1 md:px-2 md:py-3">
        <div className="md:space-y-1">
          {isLoadingProjects ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Loading projects...</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">No projects found.</div>
          ) : (
            projects.map((project) => (
              <div key={project.name} className="md:space-y-1">
                <Button variant="ghost" className={cn("w-full justify-between p-2 h-auto font-normal text-left", selectedProject?.name === project.name && "bg-accent text-accent-foreground")} onClick={() => onProjectSelect(project)}>
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {expandedProjects.has(project.name) ? <FolderOpen className="w-4 h-4 text-primary flex-shrink-0" /> : <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      {editingProject === project.name ? (
                        <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} onKeyDown={(e) => { if(e.key === 'Enter') saveProjectName(project.name); if(e.key==='Escape') cancelEditing()}} autoFocus onClick={(e) => e.stopPropagation()} />
                      ) : (
                        <div className="text-sm font-semibold truncate">{project.displayName}</div>
                      )}
                      <div className="text-xs text-muted-foreground truncate" title={project.fullPath}>{project.fullPath}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                     <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {e.stopPropagation(); startEditing(project)}}><Edit3 className="h-3 w-3" /></Button>
                     {expandedProjects.has(project.name) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </Button>
                {expandedProjects.has(project.name) && (
                  <div className="ml-4 pl-3 border-l border-border space-y-1 py-1">
                    {getAllSessions(project).map((session) => (
                      <div key={session.id} className="group flex items-center">
                        <Button variant="ghost" className={cn("w-full justify-start p-2 h-auto font-normal text-left", selectedSession?.id === session.id && "bg-accent")} onClick={() => onSessionSelect(session)}>
                          <MessageSquare className="w-3 h-3 mr-2 flex-shrink-0" />
                          <span className="truncate text-xs">{session.summary || 'New Session'}</span>
                          <Badge variant="secondary" className="ml-auto text-xs">{session.messageCount}</Badge>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteSessionHandler(project.name, session.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                      </div>
                    ))}
                    {project.sessionMeta?.hasMore && <Button variant="link" size="sm" className="w-full" onClick={() => loadMoreSessions(project)} disabled={loadingSessions[project.name]}>{loadingSessions[project.name] ? 'Loading...' : 'Show more'}</Button>}
                    <Button variant="outline" size="sm" className="w-full" onClick={() => onNewSession(project)}><Plus className="w-4 h-4 mr-2" />New Session</Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      
      <div className="md:p-2 md:border-t flex-shrink-0">
        <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => setShowToolsSettings(true)}>
          <Settings className="w-4 h-4" /> Tools Settings
        </Button>
      </div>
    </div>
  );
}

export default Sidebar;
