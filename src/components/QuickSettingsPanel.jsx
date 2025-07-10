// src/components/QuickSettingsPanel.jsx
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Eye, Settings2, Moon, Sun, ArrowDown, Mic, Sparkles, FileText } from 'lucide-react';
import DarkModeToggle from './DarkModeToggle';
import { useTheme } from '../contexts/ThemeContext';
import { useApp } from '../contexts/AppContext';

const QuickSettingsPanel = ({ isOpen, onToggle }) => {
  const {
    isMobile,
    autoExpandTools,
    setAutoExpandTools,
    showRawParameters,
    setShowRawParameters,
    autoScrollToBottom,
    setAutoScrollToBottom
  } = useApp();
  const { isDarkMode } = useTheme();

  const [whisperMode, setWhisperMode] = useState(() => localStorage.getItem('whisperMode') || 'default');

  return (
    <>
      <div className={`fixed ${isMobile ? 'bottom-44' : 'top-1/2 -translate-y-1/2'} ${isOpen ? 'right-64' : 'right-0'} z-50`}>
        <button onClick={() => onToggle(!isOpen)} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 rounded-l-md p-2">
          {isOpen ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      </div>
      <div className={`fixed top-0 right-0 h-full w-64 bg-white dark:bg-gray-900 border-l z-40 transform ${isOpen ? 'translate-x-0' : 'translate-x-full'} transition-transform`}>
        <div className="h-full flex flex-col">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold flex items-center gap-2"><Settings2 className="h-5 w-5" />Quick Settings</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase text-gray-500">Appearance</h4>
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
                <span className="flex items-center gap-2 text-sm">{isDarkMode ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}Dark Mode</span>
                <DarkModeToggle />
              </div>
            </div>
            <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-gray-500">Tool Display</h4>
                <label className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 cursor-pointer">
                    <span className="flex items-center gap-2 text-sm"><Maximize2 className="h-4 w-4" />Auto-expand tools</span>
                    <input type="checkbox" checked={autoExpandTools} onChange={(e) => setAutoExpandTools(e.target.checked)} className="h-4 w-4 rounded" />
                </label>
                <label className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 cursor-pointer">
                    <span className="flex items-center gap-2 text-sm"><Eye className="h-4 w-4" />Show raw parameters</span>
                    <input type="checkbox" checked={showRawParameters} onChange={(e) => setShowRawParameters(e.target.checked)} className="h-4 w-4 rounded" />
                </label>
            </div>
            <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase text-gray-500">View Options</h4>
                <label className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800 cursor-pointer">
                    <span className="flex items-center gap-2 text-sm"><ArrowDown className="h-4 w-4" />Auto-scroll</span>
                    <input type="checkbox" checked={autoScrollToBottom} onChange={(e) => setAutoScrollToBottom(e.target.checked)} className="h-4 w-4 rounded" />
                </label>
            </div>
            {/* Whisper Dictation Settings remain the same */}
          </div>
        </div>
      </div>
      {isOpen && <div className="fixed inset-0 bg-background/80 z-30" onClick={() => onToggle(false)} />}
    </>
  );
};

export default QuickSettingsPanel;
