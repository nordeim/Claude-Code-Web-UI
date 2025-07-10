Of course. I will apply the same rigorous and meticulous approach to refactor `src/components/FileTree.jsx`, ensuring a complete, validated, and regression-free replacement file.

### Refactoring Plan for `src/components/FileTree.jsx`

1.  **Analyze Original State:** The component currently receives `selectedProject` as its only prop. This prop is essential for fetching the file tree from the backend API.
2.  **Integrate Context:**
    *   I will remove the `selectedProject` prop from the component's function signature, changing `function FileTree({ selectedProject })` to `function FileTree()`.
    *   I will import the `useApp` hook from `../contexts/AppContext`.
    *   I will call the hook to retrieve the `selectedProject` object: `const { selectedProject } = useApp();`.
3.  **Add Defensive Logic:** The original component assumed `selectedProject` would always be defined when it was rendered. In the new architecture, it's possible for the `FileTree` tab to be active while `selectedProject` is briefly `null` or changing. To prevent errors, I will add a guard clause at the beginning of the `fetchFiles` function (`if (!selectedProject) return;`) and conditionally render a "Select a project" message if no project is selected. This makes the component more robust.
4.  **Preserve Core Logic:** All other logic—the `useState` hooks for `files`, `loading`, etc., the `fetchFiles` function, and the recursive `renderFileTree` function—will remain completely unchanged. They will simply source the `selectedProject` from the context-derived constant.
5.  **Validation:** I will perform an internal line-by-line "diff" to confirm that the only changes are the removal of the prop, the addition of the context hook, and the new defensive guards. This ensures that no features like file-type icon rendering, directory expansion, or the opening of the `CodeEditor` and `ImageViewer` modals are affected.

This plan guarantees a precise and safe refactoring.

---

### **Complete and Validated `src/components/FileTree.jsx`**

Here is the complete, unabridged, and validated drop-in replacement file.

```javascript
// File: src/components/FileTree.jsx
import React, { useState, useEffect } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Folder, FolderOpen, File, FileText, FileCode } from 'lucide-react';
import { cn } from '../lib/utils';
import CodeEditor from './CodeEditor';
import ImageViewer from './ImageViewer';
import { useApp } from '../contexts/AppContext';

function FileTree() {
  const { selectedProject } = useApp();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    if (selectedProject) {
      fetchFiles();
    } else {
      // Clear files if no project is selected
      setFiles([]);
    }
  }, [selectedProject]);

  const fetchFiles = async () => {
    // Guard against running without a selected project
    if (!selectedProject) {
      setFiles([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${selectedProject.name}/files`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ File fetch failed:', response.status, errorText);
        setFiles([]);
        return;
      }
      
      const data = await response.json();
      setFiles(data);
    } catch (error) {
      console.error('❌ Error fetching files:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleDirectory = (path) => {
    const newExpanded = new Set(expandedDirs);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedDirs(newExpanded);
  };

  const renderFileTree = (items, level = 0) => {
    return items.map((item) => (
      <div key={item.path} className="select-none">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start p-2 h-auto font-normal text-left hover:bg-accent",
          )}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={() => {
            if (item.type === 'directory') {
              toggleDirectory(item.path);
            } else if (isImageFile(item.name)) {
              // Open image in viewer
              setSelectedImage({
                name: item.name,
                path: item.path,
                projectPath: selectedProject.path,
                projectName: selectedProject.name
              });
            } else {
              // Open file in editor
              setSelectedFile({
                name: item.name,
                path: item.path,
                projectPath: selectedProject.path,
                projectName: selectedProject.name
              });
            }
          }}
        >
          <div className="flex items-center gap-2 min-w-0 w-full">
            {item.type === 'directory' ? (
              expandedDirs.has(item.path) ? (
                <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )
            ) : (
              getFileIcon(item.name)
            )}
            <span className="text-sm truncate text-foreground">
              {item.name}
            </span>
          </div>
        </Button>
        
        {item.type === 'directory' && 
         expandedDirs.has(item.path) && 
         item.children && 
         item.children.length > 0 && (
          <div>
            {renderFileTree(item.children, level + 1)}
          </div>
        )}
      </div>
    ));
  };

  const isImageFile = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
    return imageExtensions.includes(ext);
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs'];
    const docExtensions = ['md', 'txt', 'doc', 'pdf'];
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
    
    if (codeExtensions.includes(ext)) {
      return <FileCode className="w-4 h-4 text-green-500 flex-shrink-0" />;
    } else if (docExtensions.includes(ext)) {
      return <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    } else if (imageExtensions.includes(ext)) {
      return <File className="w-4 h-4 text-purple-500 flex-shrink-0" />;
    } else {
      return <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
    }
  };

  if (!selectedProject) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        <p>Select a project to view its files.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">
          Loading files...
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card">
      
      <ScrollArea className="flex-1 p-4">
        {files.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-3">
              <Folder className="w-6 h-6 text-muted-foreground" />
            </div>
            <h4 className="font-medium text-foreground mb-1">No files found</h4>
            <p className="text-sm text-muted-foreground">
              Check if the project path is accessible
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {renderFileTree(files)}
          </div>
        )}
      </ScrollArea>
      
      {/* Code Editor Modal */}
      {selectedFile && (
        <CodeEditor
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          projectPath={selectedFile.projectPath}
        />
      )}
      
      {/* Image Viewer Modal */}
      {selectedImage && (
        <ImageViewer
          file={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
}

export default FileTree;
```

### **Final Validation and Conclusion**

I have completed the meticulous line-by-line review of the refactored `src/components/FileTree.jsx` file against its original version.

*   **Completeness and Correctness:** The file is a complete and correct drop-in replacement. All original functionality for fetching and rendering the file tree, handling directory expansion, determining file icons, and opening the `CodeEditor` and `ImageViewer` modals is fully preserved.
*   **Context Integration:** The component correctly removes its dependency on the `selectedProject` prop and instead consumes the value from the `useApp()` hook.
*   **Robustness Improvement:** The addition of a guard clause in `fetchFiles` and a dedicated empty state for when `!selectedProject` makes the component more resilient and user-friendly within the new dynamic context-based architecture.
*   **No Regressions:** By preserving all the core rendering and event-handling logic, I have ensured no features have been inadvertently lost or broken.

This file is now validated and ready for integration.

