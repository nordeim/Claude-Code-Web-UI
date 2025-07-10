Of course. I have analyzed the issue and the logs you provided. The error `Path does not exist: /home/pete/claudecodeui/new1` when creating a project with a relative path like `new1`, combined with the `ENOENT: no such file or directory, scandir '/home/pete/.claude/projects'` error, indicates two distinct problems:

1.  **Incorrect Relative Path Handling**: The application incorrectly resolves relative project paths (like `new1`) against its own working directory (`/home/pete/claudecodeui`) and expects that path to exist, rather than creating a new project directory in a sensible default location (like the user's home directory).
2.  **Missing Directory Graceful Handling**: The server crashes or logs errors if the `~/.claude/projects` directory doesn't exist upon startup. A robust application should create this directory if it's missing.

I will now execute a precise plan to fix both issues by modifying `server/projects.js`.

### Execution Plan: Project Creation and Stability Fix

*   **Goal**: Rectify the project creation logic to correctly handle relative paths and improve server stability by ensuring required directories exist.
*   **Strategy**: I will modify `server/projects.js` to implement the following changes:
    1.  **Directory Creation**: In the `getProjects` and `saveProjectConfig` functions, I will add logic to create the `~/.claude` and `~/.claude/projects` directories if they do not exist.
    2.  **Path Resolution Logic**: I will rewrite the `addProjectManually` function to intelligently distinguish between absolute paths (which must already exist) and relative paths (which will be created as new project directories within the user's home folder).

This approach will align the application's behavior with user expectations for creating new projects and make the server more resilient.

Here is the complete, updated file with the necessary fixes.

```javascript
// File: server/projects.js
const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const os = require('os');

// Load project configuration file
async function loadProjectConfig() {
  const configPath = path.join(process.env.HOME, '.claude', 'project-config.json');
  try {
    const configData = await fs.readFile(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    // Return empty config if file doesn't exist
    return {};
  }
}

// Save project configuration file
async function saveProjectConfig(config) {
  const configDir = path.join(process.env.HOME, '.claude');
  await fs.mkdir(configDir, { recursive: true }); // Ensure parent directory exists
  const configPath = path.join(configDir, 'project-config.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
}

// Generate better display name from path
async function generateDisplayName(projectName) {
  // Convert "-home-user-projects-myapp" to a readable format
  let projectPath = projectName.replace(/-/g, '/');
  
  // Try to read package.json from the project path
  try {
    const packageJsonPath = path.join(projectPath, 'package.json');
    const packageData = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageData);
    
    // Return the name from package.json if it exists
    if (packageJson.name) {
      return packageJson.name;
    }
  } catch (error) {
    // Fall back to path-based naming if package.json doesn't exist or can't be read
  }
  
  // If it starts with /, it's an absolute path
  if (projectPath.startsWith('/')) {
    const parts = projectPath.split('/').filter(Boolean);
    if (parts.length > 3) {
      // Show last 2 folders with ellipsis: "...projects/myapp"
      return `.../${parts.slice(-2).join('/')}`;
    } else {
      // Show full path if short: "/home/user"
      return projectPath;
    }
  }
  
  return projectPath;
}

async function getProjects() {
  const claudeDir = path.join(process.env.HOME, '.claude', 'projects');

  // Ensure the projects directory exists to prevent read errors.
  await fs.mkdir(claudeDir, { recursive: true }).catch(err => {
      // Log the error but don't crash the server; the next part will handle the empty state.
      console.error(`Warning: Could not create projects directory at ${claudeDir}.`, err);
  });

  const config = await loadProjectConfig();
  const projects = [];
  const existingProjects = new Set();
  
  try {
    // First, get existing projects from the file system
    const entries = await fs.readdir(claudeDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        existingProjects.add(entry.name);
        const projectPath = path.join(claudeDir, entry.name);
        
        // Get display name from config or generate one
        const customName = config[entry.name]?.displayName;
        const autoDisplayName = await generateDisplayName(entry.name);
        const fullPath = entry.name.replace(/-/g, '/');
        
        const project = {
          name: entry.name,
          path: projectPath,
          displayName: customName || autoDisplayName,
          fullPath: fullPath,
          isCustomName: !!customName,
          sessions: []
        };
        
        // Try to get sessions for this project (just first 5 for performance)
        try {
          const sessionResult = await getSessions(entry.name, 5, 0);
          project.sessions = sessionResult.sessions || [];
          project.sessionMeta = {
            hasMore: sessionResult.hasMore,
            total: sessionResult.total
          };
        } catch (e) {
          console.warn(`Could not load sessions for project ${entry.name}:`, e.message);
        }
        
        projects.push(project);
      }
    }
  } catch (error) {
    console.error('Error reading projects directory:', error);
  }
  
  // Add manually configured projects that don't exist as folders yet
  for (const [projectName, projectConfig] of Object.entries(config)) {
    if (!existingProjects.has(projectName) && projectConfig.manuallyAdded) {
      const fullPath = projectName.replace(/-/g, '/');
      
      const project = {
        name: projectName,
        path: null, // No physical path yet
        displayName: projectConfig.displayName || await generateDisplayName(projectName),
        fullPath: fullPath,
        isCustomName: !!projectConfig.displayName,
        isManuallyAdded: true,
        sessions: []
      };
      
      projects.push(project);
    }
  }
  
  return projects;
}

async function getSessions(projectName, limit = 5, offset = 0) {
  const projectDir = path.join(process.env.HOME, '.claude', 'projects', projectName);
  
  try {
    const files = await fs.readdir(projectDir);
    const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
    
    if (jsonlFiles.length === 0) {
      return { sessions: [], hasMore: false, total: 0 };
    }
    
    // For performance, get file stats to sort by modification time
    const filesWithStats = await Promise.all(
      jsonlFiles.map(async (file) => {
        const filePath = path.join(projectDir, file);
        const stats = await fs.stat(filePath);
        return { file, mtime: stats.mtime };
      })
    );
    
    // Sort files by modification time (newest first) for better performance
    filesWithStats.sort((a, b) => b.mtime - a.mtime);
    
    const allSessions = new Map();
    let processedCount = 0;
    
    // Process files in order of modification time
    for (const { file } of filesWithStats) {
      const jsonlFile = path.join(projectDir, file);
      const sessions = await parseJsonlSessions(jsonlFile);
      
      // Merge sessions, avoiding duplicates by session ID
      sessions.forEach(session => {
        if (!allSessions.has(session.id)) {
          allSessions.set(session.id, session);
        }
      });
      
      processedCount++;
      
      // Early exit optimization: if we have enough sessions and processed recent files
      if (allSessions.size >= (limit + offset) * 2 && processedCount >= Math.min(3, filesWithStats.length)) {
        break;
      }
    }
    
    // Convert to array and sort by last activity
    const sortedSessions = Array.from(allSessions.values()).sort((a, b) => 
      new Date(b.lastActivity) - new Date(a.lastActivity)
    );
    
    const total = sortedSessions.length;
    const paginatedSessions = sortedSessions.slice(offset, offset + limit);
    const hasMore = offset + limit < total;
    
    return {
      sessions: paginatedSessions,
      hasMore,
      total,
      offset,
      limit
    };
  } catch (error) {
    console.error(`Error reading sessions for project ${projectName}:`, error);
    return { sessions: [], hasMore: false, total: 0 };
  }
}

async function parseJsonlSessions(filePath) {
  const sessions = new Map();
  
  try {
    const fileStream = require('fs').createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    // console.log(`[JSONL Parser] Reading file: ${filePath}`);
    let lineCount = 0;
    
    for await (const line of rl) {
      if (line.trim()) {
        lineCount++;
        try {
          const entry = JSON.parse(line);
          
          if (entry.sessionId) {
            if (!sessions.has(entry.sessionId)) {
              sessions.set(entry.sessionId, {
                id: entry.sessionId,
                summary: 'New Session',
                messageCount: 0,
                lastActivity: new Date(),
                cwd: entry.cwd || ''
              });
            }
            
            const session = sessions.get(entry.sessionId);
            
            // Update summary if this is a summary entry
            if (entry.type === 'summary' && entry.summary) {
              session.summary = entry.summary;
            } else if (entry.message?.role === 'user' && entry.message?.content && session.summary === 'New Session') {
              // Use first user message as summary if no summary entry exists
              const content = entry.message.content;
              if (typeof content === 'string' && content.length > 0) {
                // Skip command messages that start with <command-name>
                if (!content.startsWith('<command-name>')) {
                  session.summary = content.length > 50 ? content.substring(0, 50) + '...' : content;
                }
              }
            }
            
            // Count messages instead of storing them all
            session.messageCount = (session.messageCount || 0) + 1;
            
            // Update last activity
            if (entry.timestamp) {
              session.lastActivity = new Date(entry.timestamp);
            }
          }
        } catch (parseError) {
          console.warn(`[JSONL Parser] Error parsing line ${lineCount}:`, parseError.message);
        }
      }
    }
    
    // console.log(`[JSONL Parser] Processed ${lineCount} lines, found ${sessions.size} sessions`);
  } catch (error) {
    console.error('Error reading JSONL file:', error);
  }
  
  // Convert Map to Array and sort by last activity
  return Array.from(sessions.values()).sort((a, b) => 
    new Date(b.lastActivity) - new Date(a.lastActivity)
  );
}

// Get messages for a specific session
async function getSessionMessages(projectName, sessionId) {
  const projectDir = path.join(process.env.HOME, '.claude', 'projects', projectName);
  
  try {
    const files = await fs.readdir(projectDir);
    const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
    
    if (jsonlFiles.length === 0) {
      return [];
    }
    
    const messages = [];
    
    // Process all JSONL files to find messages for this session
    for (const file of jsonlFiles) {
      const jsonlFile = path.join(projectDir, file);
      const fileStream = require('fs').createReadStream(jsonlFile);
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });
      
      for await (const line of rl) {
        if (line.trim()) {
          try {
            const entry = JSON.parse(line);
            if (entry.sessionId === sessionId) {
              messages.push(entry);
            }
          } catch (parseError) {
            console.warn('Error parsing line:', parseError.message);
          }
        }
      }
    }
    
    // Sort messages by timestamp
    return messages.sort((a, b) => 
      new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
    );
  } catch (error) {
    console.error(`Error reading messages for session ${sessionId}:`, error);
    return [];
  }
}

// Rename a project's display name
async function renameProject(projectName, newDisplayName) {
  const config = await loadProjectConfig();
  
  if (!newDisplayName || newDisplayName.trim() === '') {
    // Remove custom name if empty, will fall back to auto-generated
    delete config[projectName];
  } else {
    // Set custom display name
    config[projectName] = {
      ...(config[projectName] || {}), // Preserve other potential settings
      displayName: newDisplayName.trim()
    };
  }
  
  await saveProjectConfig(config);
  return true;
}

// Delete a session from a project
async function deleteSession(projectName, sessionId) {
  const projectDir = path.join(process.env.HOME, '.claude', 'projects', projectName);
  
  try {
    const files = await fs.readdir(projectDir);
    const jsonlFiles = files.filter(file => file.endsWith('.jsonl'));
    
    if (jsonlFiles.length === 0) {
      throw new Error('No session files found for this project');
    }
    
    // Check all JSONL files to find which one contains the session
    for (const file of jsonlFiles) {
      const jsonlFile = path.join(projectDir, file);
      const content = await fs.readFile(jsonlFile, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      // Check if this file contains the session
      const hasSession = lines.some(line => {
        try {
          const data = JSON.parse(line);
          return data.sessionId === sessionId;
        } catch {
          return false;
        }
      });
      
      if (hasSession) {
        // Filter out all entries for this session
        const filteredLines = lines.filter(line => {
          try {
            const data = JSON.parse(line);
            return data.sessionId !== sessionId;
          } catch {
            return true; // Keep malformed lines
          }
        });
        
        // Write back the filtered content
        await fs.writeFile(jsonlFile, filteredLines.join('\n') + (filteredLines.length > 0 ? '\n' : ''));
        return true;
      }
    }
    
    throw new Error(`Session ${sessionId} not found in any files`);
  } catch (error) {
    console.error(`Error deleting session ${sessionId} from project ${projectName}:`, error);
    throw error;
  }
}

// Check if a project is empty (has no sessions)
async function isProjectEmpty(projectName) {
  try {
    const sessionsResult = await getSessions(projectName, 1, 0);
    return sessionsResult.total === 0;
  } catch (error) {
    console.error(`Error checking if project ${projectName} is empty:`, error);
    return false;
  }
}

// Delete an empty project
async function deleteProject(projectName) {
  const projectDir = path.join(process.env.HOME, '.claude', 'projects', projectName);
  
  try {
    // First check if the project is empty
    const isEmpty = await isProjectEmpty(projectName);
    if (!isEmpty) {
      throw new Error('Cannot delete project with existing sessions');
    }
    
    // Remove the project directory
    await fs.rm(projectDir, { recursive: true, force: true });
    
    // Remove from project config
    const config = await loadProjectConfig();
    delete config[projectName];
    await saveProjectConfig(config);
    
    return true;
  } catch (error) {
    console.error(`Error deleting project ${projectName}:`, error);
    throw error;
  }
}

// Add a project manually to the config
async function addProjectManually(projectPath, displayName = null) {
  let absolutePath;
  const trimmedPath = projectPath.trim();

  // Handle tilde expansion first
  const expandedPath = trimmedPath.startsWith('~/') 
    ? path.join(os.homedir(), trimmedPath.slice(2)) 
    : trimmedPath;
  
  // Check if path is absolute or relative
  if (path.isAbsolute(expandedPath)) {
    absolutePath = expandedPath;
    
    // For absolute paths, they MUST exist and be a directory.
    try {
      await fs.access(absolutePath);
      const stats = await fs.stat(absolutePath);
      if (!stats.isDirectory()) {
          throw new Error(`Path exists but is not a directory: ${absolutePath}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Path does not exist: ${absolutePath}`);
      }
      throw error; // Rethrow other errors like permissions
    }
  } else {
    // Handle relative paths: treat as new directories to be created in user's HOME folder.
    absolutePath = path.join(os.homedir(), expandedPath);

    try {
      // Check if it exists first
      await fs.access(absolutePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Directory does not exist, so create it.
        console.log(`Directory does not exist, creating: ${absolutePath}`);
        await fs.mkdir(absolutePath, { recursive: true });
      } else {
        // Other error (e.g., permissions)
        throw new Error(`Failed to access path ${absolutePath}: ${error.message}`);
      }
    }
  }

  // Generate project name (encode path for use as directory name)
  const projectName = absolutePath.replace(/\//g, '-');
  
  // Check if project already exists in config or as a folder
  const config = await loadProjectConfig();
  const projectDir = path.join(process.env.HOME, '.claude', 'projects', projectName);
  
  try {
    await fs.access(projectDir);
    // If we are here, directory exists in .claude/projects, so project exists
    throw new Error(`Project already exists for path: ${absolutePath}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      // Something other than "not found" happened, which is an issue.
      throw error;
    }
    // ENOENT is expected, means we can proceed.
  }
  
  if (config[projectName]) {
    throw new Error(`Project already configured for path: ${absolutePath}`);
  }
  
  // Add to config as manually added project
  config[projectName] = {
    manuallyAdded: true,
    originalPath: absolutePath
  };
  
  if (displayName) {
    config[projectName].displayName = displayName;
  }
  
  await saveProjectConfig(config);
  
  return {
    name: projectName,
    path: null, // No physical path inside .claude/projects yet
    fullPath: absolutePath,
    displayName: displayName || await generateDisplayName(projectName),
    isManuallyAdded: true,
    sessions: []
  };
}


module.exports = {
  getProjects,
  getSessions,
  getSessionMessages,
  parseJsonlSessions,
  renameProject,
  deleteSession,
  isProjectEmpty,
  deleteProject,
  addProjectManually,
  loadProjectConfig,
  saveProjectConfig
};
```

### Summary of Changes in `server/projects.js`

1.  **Added `os` import**: `const os = require('os');` was added at the top of the file to access the user's home directory.
2.  **`getProjects()` Updated**: This function now ensures the `~/.claude/projects` directory exists before attempting to read from it, preventing server errors on first run.
3.  **`saveProjectConfig()` Updated**: This function now ensures the `~/.claude` directory exists before writing the configuration file, preventing another potential `ENOENT` error.
4.  **`addProjectManually()` Overhauled**:
    *   It now correctly handles tilde (`~`) expansion for paths.
    *   It checks if a path is absolute. If so, it verifies the path exists and is a directory.
    *   If the path is relative (e.g., `new1`), it now correctly interprets this as a request to create a new directory inside the user's home folder (`~/new1`).
    *   It creates this new directory if it doesn't already exist.
    *   The rest of the function proceeds as before, registering this newly available path as a project in the UI.

These changes directly address the bugs you identified. The application will now correctly create new project directories from relative paths and will be more resilient to environments where the `.claude` configuration directory has not yet been created. I have completed Phase 1 and the stability improvements for this specific issue. I will now await your confirmation before moving to the next phase of the plan.

---
https://drive.google.com/file/d/1QQZl8EJf50QFoZcprQ7lNFDNp0GrAeev/view?usp=sharing, https://aistudio.google.com/app/prompts?state=%7B%22ids%22:%5B%221eXtmJxlVjZlv_VB1J4k5H4n7pEzSvt20%22%5D,%22action%22:%22open%22,%22userId%22:%22108686197475781557359%22,%22resourceKeys%22:%7B%7D%7D&usp=sharing, https://drive.google.com/file/d/1g7OWapqd9KDMdc-pL8_28Is1dWbYrdjA/view?usp=sharing, https://drive.google.com/file/d/1inv8hftL7sFp1SvEm3FD17YAwOjaMT_H/view?usp=sharing

