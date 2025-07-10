// src/components/MainContent.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ChatInterface from './ChatInterface';
import FileTree from './FileTree';
import CodeEditor from './CodeEditor';
import Shell from './Shell';
import GitPanel from './GitPanel';
import { useApp } from '../contexts/AppContext';

function MainContent({ onMenuClick }) {
  const { selectedProject, activeTab } = useApp();
  const navigate = useNavigate();

  const [editingFile, setEditingFile] = useState(null);

  const handleFileOpen = (filePath, diffInfo = null) => {
    const file = {
      name: filePath.split('/').pop(),
      path: filePath,
      projectName: selectedProject?.name,
      diffInfo: diffInfo
    };
    setEditingFile(file);
  };

  const handleCloseEditor = () => {
    setEditingFile(null);
  };

  const handleNavigateToSession = (sessionId) => {
    navigate(`/session/${sessionId}`);
  };

  if (!selectedProject) {
    return (
      <div className="h-full flex flex-col">
        {onMenuClick && (
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 sm:p-4 flex-shrink-0">
            <button onClick={onMenuClick} className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500 dark:text-gray-400 max-w-md mx-auto px-6">
            <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" /></svg>
            </div>
            <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-white">Choose Your Project</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">Select a project from the sidebar to start coding with Claude.</p>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300">💡 <strong>Tip:</strong> Create a new project by clicking the folder icon in the sidebar</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 sm:p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
            {onMenuClick && (
              <button onClick={onMenuClick} onTouchStart={(e) => { e.preventDefault(); onMenuClick(); }} className="p-2.5 mr-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 touch-manipulation active:scale-95">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
            )}
        </div>
      </div>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className={`h-full ${activeTab === 'chat' ? 'block' : 'hidden'}`}><ChatInterface onFileOpen={handleFileOpen} onNavigateToSession={handleNavigateToSession} /></div>
        <div className={`h-full overflow-hidden ${activeTab === 'files' ? 'block' : 'hidden'}`}><FileTree /></div>
        <div className={`h-full overflow-hidden ${activeTab === 'shell' ? 'block' : 'hidden'}`}><Shell /></div>
        <div className={`h-full overflow-hidden ${activeTab === 'git' ? 'block' : 'hidden'}`}><GitPanel /></div>
      </div>
      {editingFile && <CodeEditor file={editingFile} onClose={handleCloseEditor} projectPath={selectedProject?.path} />}
    </div>
  );
}

export default React.memo(MainContent);
