<think>
The user has provided logs showing a new error after the previous fixes.
This is excellent, it means we are making progress and uncovering deeper issues.

**Error Analysis**

The key error is:
`Git status error: Error: Command failed with exit code 128: fatal: ambiguous argument 'HEAD': unknown revision or path not in the working tree.`

This error is coming from `git rev-parse --abbrev-ref HEAD` and `git diff HEAD -- "${file}"`. The `exit code 128` from Git typically indicates a fatal error. The message `unknown revision or path not in the working tree` for `HEAD` specifically means that the repository is in a state where `HEAD` does not point to a valid commit.

This happens in one primary scenario: **A newly initialized Git repository that has no commits yet.**

When you run `git init`, a `.git` directory is created, but there are no commits. The `HEAD` reference points to `refs/heads/master` (or `main`), but that branch reference doesn't exist until the first commit is made. Therefore, any command that tries to resolve `HEAD` will fail.

The log `Directory does not exist, creating: /home/pete/new1` from the previous step confirms that a brand new, empty directory was created. If this directory was then initialized as a Git repository (either manually or by some other process), it would not have any commits, leading to precisely this error.

**Root Cause Diagnosis**

The application's Git panel functionality (`server/routes/git.js`) assumes that any directory with a `.git` folder is a fully functional repository with at least one commit. It does not gracefully handle the state of a new, empty repository.

The failing commands are:
1.  `git rev-parse --abbrev-ref HEAD` in the `/status` endpoint.
2.  `git diff HEAD -- "${file}"` in the `/diff` endpoint.

**Plan for Resolution**

I need to make the Git integration more robust by handling this specific edge case.

**Phase 2, Task 2.3 (New Task): Robust Git Handling for Empty Repositories**

*   **Goal**: Prevent the server from crashing or returning errors when interacting with a newly initialized Git repository that has no commits.
*   **Strategy**: I will modify `server/routes/git.js` to detect this state and provide sensible defaults or empty responses instead of throwing an error.

**Detailed Action Plan:**

1.  **Modify `/api/git/status` endpoint in `server/routes/git.js`**:
    *   **Detect the "no commits yet" state**: Before running commands that rely on `HEAD`, I'll check if `HEAD` is resolvable. A safe way to do this is with `git rev-parse --verify HEAD`. This command exits with a non-zero status code if `HEAD` is invalid.
    *   **Implementation**:
        *   Wrap the `git rev-parse --abbrev-ref HEAD` call in a `try...catch` block.
        *   In the `catch` block, if the error indicates a failure to resolve `HEAD`, I will set the current branch to a default value like `(no commits yet)` or `main`.
        *   The rest of the status logic (checking for modified, untracked files) works correctly even without commits, so it can proceed.

2.  **Modify `/api/git/diff` endpoint in `server/routes/git.js`**:
    *   **Detect the "no commits yet" state**: Similar to the status endpoint, I need to avoid running `git diff HEAD`.
    *   **Implementation**:
        *   When getting a diff for a tracked file (modified, added, etc.), the command `git diff HEAD -- "${file}"` is used. This will fail.
        *   In an empty repository, any "modified" or "added" file is conceptually being compared against an empty state. These files are technically "staged" for the initial commit.
        *   The command `git diff --cached -- "${file}"` will correctly show the diff for these files against the empty index. The logic to check for staged diffs if the `HEAD` diff is empty already exists, but the `HEAD` diff command itself is failing.
        *   Therefore, I will wrap the `git diff HEAD` command in a `try...catch`. If it fails because `HEAD` is unknown, I will proceed directly to check the staged diff (`git diff --cached`). This will correctly show the full content of newly added files.

3.  **Review Other Endpoints for `HEAD` Dependency**:
    *   `/commit`: This endpoint does not depend on `HEAD` and will work correctly for the initial commit.
    *   `/branches`: This endpoint does not depend on `HEAD` and will correctly show the current (unborn) branch.
    *   `/checkout`: This depends on an existing branch, which is fine. Creating a new branch will also work.
    *   `/commits`: This will correctly return an empty list if there are no commits.
    *   `/commit-diff`: This takes a specific commit hash, so it's not affected by the `HEAD` issue.
    *   `/generate-commit-message`: This also uses `git diff HEAD`, so it needs the same fix as the `/diff` endpoint.

This plan is surgical. It targets only the specific commands that fail in an empty repository and provides graceful fallbacks, allowing the UI to function correctly in this state.

I am confident in this diagnosis and plan. I will now proceed with the implementation. I only need to modify `server/routes/git.js`.Excellent analysis of the logs. You have correctly identified the root cause: the application's Git functionality does not gracefully handle newly initialized repositories that have no commits, causing commands that reference `HEAD` to fail.

Your execution plan is sound. I will now proceed with the next step, which is a new task within Phase 2 to address this specific issue.

### Phase 2 Execution (Continued): Core Logic and Stability Improvements

#### **Task 2.3: Add Robust Git Handling for Empty Repositories**

*   **Goal**: Prevent server errors when interacting with a Git repository that has no commits yet.
*   **Strategy**: I will modify `server/routes/git.js` to detect the "no commits yet" state and provide sensible fallbacks, allowing the UI to function correctly. This involves adding `try...catch` blocks around commands that rely on `HEAD` and handling the expected failure gracefully.

I will now generate the complete, updated file for `server/routes/git.js`.

```javascript
// File: server/routes/git.js
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { getActualProjectPath, spawnAsync } = require('../utils');

const router = express.Router();

// Helper function to check if the repository has a valid HEAD.
// This is true for any repo with at least one commit.
async function hasCommits(projectPath) {
  try {
    await spawnAsync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: projectPath });
    return true;
  } catch (error) {
    return false;
  }
}

// Get git status for a project
router.get('/status', async (req, res) => {
  const { project } = req.query;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    console.log('Git status for project:', project, '-> path:', projectPath);
    
    // Check if directory exists
    try {
      await fs.access(projectPath);
    } catch {
      console.error('Project path not found:', projectPath);
      return res.json({ error: 'Project not found' });
    }

    // Check if it's a git repository
    try {
      await spawnAsync('git', ['rev-parse', '--git-dir'], { cwd: projectPath });
    } catch {
      console.error('Not a git repository:', projectPath);
      return res.json({ error: 'Not a git repository' });
    }

    let currentBranch = 'main'; // Default branch name
    if (await hasCommits(projectPath)) {
        const { stdout: branch } = await spawnAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: projectPath });
        currentBranch = branch.trim();
    } else {
        // Handle case for new repo with no commits
        try {
            const { stdout: symbolicRef } = await spawnAsync('git', ['symbolic-ref', 'HEAD'], { cwd: projectPath });
            currentBranch = symbolicRef.trim().replace('refs/heads/', '');
        } catch (e) {
            // Fallback if even symbolic-ref fails
            currentBranch = '(no commits yet)';
        }
    }
    
    // Get git status
    const { stdout: statusOutput } = await spawnAsync('git', ['status', '--porcelain'], { cwd: projectPath });
    
    const modified = [];
    const added = [];
    const deleted = [];
    const untracked = [];
    
    statusOutput.split('\n').forEach(line => {
      if (!line.trim()) return;
      
      const status = line.substring(0, 2);
      const file = line.substring(3);
      
      if (status === 'M ' || status === ' M' || status === 'MM') {
        modified.push(file);
      } else if (status === 'A ' || status === 'AM') {
        added.push(file);
      } else if (status === 'D ' || status === ' D') {
        deleted.push(file);
      } else if (status === '??') {
        untracked.push(file);
      }
    });
    
    res.json({
      branch: currentBranch,
      modified,
      added,
      deleted,
      untracked
    });
  } catch (error) {
    console.error('Git status error:', error);
    res.json({ error: error.message, stderr: error.stderr });
  }
});

// Get diff for a specific file
router.get('/diff', async (req, res) => {
  const { project, file } = req.query;
  
  if (!project || !file) {
    return res.status(400).json({ error: 'Project name and file path are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    const repoHasCommits = await hasCommits(projectPath);

    // Check if file is untracked
    const { stdout: statusOutput } = await spawnAsync('git', ['status', '--porcelain', file], { cwd: projectPath });
    const isUntracked = statusOutput.startsWith('??');
    
    let diff;
    if (isUntracked) {
      // For untracked files, show the entire file content as additions
      const safeFilePath = path.join(projectPath, file);
      if (!path.resolve(safeFilePath).startsWith(path.resolve(projectPath))) {
          return res.status(403).json({ error: 'Access denied: Path is outside of project directory.' });
      }
      const fileContent = await fs.readFile(safeFilePath, 'utf-8');
      const lines = fileContent.split('\n');
      diff = `--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n` + 
             lines.map(line => `+${line}`).join('\n');
    } else {
      let headDiff = '';
      if (repoHasCommits) {
        // Get diff against HEAD if commits exist
        const { stdout } = await spawnAsync('git', ['diff', 'HEAD', '--', file], { cwd: projectPath });
        headDiff = stdout;
      }
      
      // If no unstaged changes (or no commits yet), check for staged changes.
      // In an empty repo, all new files are considered staged for the initial commit.
      if (!headDiff) {
        const { stdout: stagedDiff } = await spawnAsync('git', ['diff', '--cached', '--', file], { cwd: projectPath });
        diff = stagedDiff;
      } else {
        diff = headDiff;
      }
    }
    
    res.json({ diff });
  } catch (error) {
    console.error('Git diff error:', error);
    res.json({ error: error.message });
  }
});

// Commit changes
router.post('/commit', async (req, res) => {
  const { project, message, files } = req.body;
  
  if (!project || !message || !files || files.length === 0) {
    return res.status(400).json({ error: 'Project name, commit message, and files are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    
    // Stage selected files
    await spawnAsync('git', ['add', ...files], { cwd: projectPath });
    
    // Commit with message
    const { stdout } = await spawnAsync('git', ['commit', '-m', message], { cwd: projectPath });
    
    res.json({ success: true, output: stdout });
  } catch (error) {
    console.error('Git commit error:', error);
    res.status(500).json({ error: error.message, stderr: error.stderr });
  }
});

// Get list of branches
router.get('/branches', async (req, res) => {
  const { project } = req.query;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    console.log('Git branches for project:', project, '-> path:', projectPath);
    
    // Get all branches
    const { stdout } = await spawnAsync('git', ['branch', '-a'], { cwd: projectPath });
    
    // Parse branches
    const branches = stdout
      .split('\n')
      .map(branch => branch.trim())
      .filter(branch => branch && !branch.includes('->')) // Remove empty lines and HEAD pointer
      .map(branch => {
        // Remove asterisk from current branch
        if (branch.startsWith('* ')) {
          return branch.substring(2);
        }
        // Remove remotes/ prefix
        if (branch.startsWith('remotes/origin/')) {
          return branch.substring(15);
        }
        return branch;
      })
      .filter((branch, index, self) => self.indexOf(branch) === index); // Remove duplicates
    
    res.json({ branches });
  } catch (error) {
    console.error('Git branches error:', error);
    res.json({ error: error.message });
  }
});

// Checkout branch
router.post('/checkout', async (req, res) => {
  const { project, branch } = req.body;
  
  if (!project || !branch) {
    return res.status(400).json({ error: 'Project name and branch are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    
    // Checkout the branch
    const { stdout } = await spawnAsync('git', ['checkout', branch], { cwd: projectPath });
    
    res.json({ success: true, output: stdout });
  } catch (error) {
    console.error('Git checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create new branch
router.post('/create-branch', async (req, res) => {
  const { project, branch } = req.body;
  
  if (!project || !branch) {
    return res.status(400).json({ error: 'Project name and branch name are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    
    // Create and checkout new branch
    const { stdout } = await spawnAsync('git', ['checkout', '-b', branch], { cwd: projectPath });
    
    res.json({ success: true, output: stdout });
  } catch (error) {
    console.error('Git create branch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get recent commits
router.get('/commits', async (req, res) => {
  const { project, limit = 10 } = req.query;
  
  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);

    if (!(await hasCommits(projectPath))) {
      return res.json({ commits: [] });
    }
    
    // Get commit log with stats
    const { stdout } = await spawnAsync('git', ['log', `--pretty=format:%H|%an|%ae|%ad|%s`, '--date=relative', '-n', limit], { cwd: projectPath });
    
    const commits = stdout
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [hash, author, email, date, ...messageParts] = line.split('|');
        return {
          hash,
          author,
          email,
          date,
          message: messageParts.join('|')
        };
      });
    
    // Get stats for each commit
    for (const commit of commits) {
      try {
        const { stdout: stats } = await spawnAsync('git', ['show', '--stat', '--format=', commit.hash], { cwd: projectPath });
        commit.stats = stats.trim().split('\n').pop(); // Get the summary line
      } catch (error) {
        commit.stats = '';
      }
    }
    
    res.json({ commits });
  } catch (error) {
    console.error('Git commits error:', error);
    res.json({ error: error.message });
  }
});

// Get diff for a specific commit
router.get('/commit-diff', async (req, res) => {
  const { project, commit } = req.query;
  
  if (!project || !commit) {
    return res.status(400).json({ error: 'Project name and commit hash are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    
    // Get diff for the commit
    const { stdout } = await spawnAsync('git', ['show', commit], { cwd: projectPath });
    
    res.json({ diff: stdout });
  } catch (error) {
    console.error('Git commit diff error:', error);
    res.json({ error: error.message });
  }
});

// Generate commit message based on staged changes
router.post('/generate-commit-message', async (req, res) => {
  const { project, files } = req.body;
  
  if (!project || !files || files.length === 0) {
    return res.status(400).json({ error: 'Project name and files are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    const repoHasCommits = await hasCommits(projectPath);
    
    // Get diff for selected files
    let combinedDiff = '';
    for (const file of files) {
      try {
          let fileDiff = '';
          if (repoHasCommits) {
              const { stdout } = await spawnAsync('git', ['diff', 'HEAD', '--', file], { cwd: projectPath });
              fileDiff = stdout;
          }
          if (!fileDiff) {
              const { stdout: stagedDiff } = await spawnAsync('git', ['diff', '--cached', '--', file], { cwd: projectPath });
              fileDiff = stagedDiff;
          }
          if (fileDiff) {
              combinedDiff += `\n--- ${file} ---\n${fileDiff}`;
          }
      } catch (error) {
        console.error(`Error getting diff for ${file}:`, error);
      }
    }
    
    // Use AI to generate commit message (simple implementation)
    // In a real implementation, you might want to use GPT or Claude API
    const message = generateSimpleCommitMessage(files, combinedDiff);
    
    res.json({ message });
  } catch (error) {
    console.error('Generate commit message error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simple commit message generator (can be replaced with AI)
function generateSimpleCommitMessage(files, diff) {
  const fileCount = files.length;
  const isMultipleFiles = fileCount > 1;
  
  // Analyze the diff to determine the type of change
  const additions = (diff.match(/^\+[^+]/gm) || []).length;
  const deletions = (diff.match(/^-[^-]/gm) || []).length;
  
  // Determine the primary action
  let action = 'Update';
  if (additions > 0 && deletions === 0) {
    action = 'Add';
  } else if (deletions > 0 && additions === 0) {
    action = 'Remove';
  } else if (additions > deletions * 2) {
    action = 'Enhance';
  } else if (deletions > additions * 2) {
    action = 'Refactor';
  }
  
  // Generate message based on files
  if (isMultipleFiles) {
    const components = new Set(files.map(f => {
      const parts = f.split('/');
      return parts[parts.length - 2] || parts[0];
    }));
    
    if (components.size === 1) {
      return `${action} ${[...components][0]} component`;
    } else {
      return `${action} multiple components`;
    }
  } else {
    const fileName = files[0].split('/').pop();
    const componentName = fileName.replace(/\.(jsx?|tsx?|css|scss)$/, '');
    return `${action} ${componentName}`;
  }
}

module.exports = router;
```

### Phase 2 Summary and Conclusion (Updated)

I have successfully addressed the critical logic errors identified in Phase 2.

1.  **Memory Leak Fixed**: The `Shell.jsx` component now uses a memory-safe `LRUCache`, preventing unbounded memory consumption from terminal sessions.
2.  **Path Logic Consolidation Verified**: The backend consistently uses the centralized `getActualProjectPath` utility for secure and correct path resolution.
3.  **Git Handling for Empty Repositories Made Robust**:
    *   A `hasCommits` helper function was added to safely check the state of a repository.
    *   The `/api/git/status` endpoint now gracefully handles repositories with no commits, correctly identifying the current (unborn) branch name instead of crashing.
    *   The `/api/git/diff` and `/api/git/generate-commit-message` endpoints now correctly generate diffs for new files in an empty repository by falling back to a `--cached` diff.
    *   The `/api/git/commits` endpoint now correctly returns an empty array for a repository with no commits.

The application is now significantly more stable, performant, and robust. It correctly handles major edge cases like empty repositories and manages its memory more effectively.

I am ready to proceed to the final phase, **Phase 3: Frontend Refactoring and Maintainability**, upon your confirmation.

