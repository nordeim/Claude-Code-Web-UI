// server/utils.js
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

/**
 * A secure wrapper around child_process.spawn that returns a promise.
 * @param {string} command The command to execute.
 * @param {string[]} args The arguments for the command.
 * @param {import('child_process').SpawnOptions} options The options for spawn.
 * @returns {Promise<{stdout: string, stderr: string}>} A promise that resolves with stdout and stderr.
 */
function spawnAsync(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`Command failed with exit code ${code}: ${stderr}`);
        error.code = code;
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Decodes an encoded project name into its actual file system path.
 * This is the single source of truth for resolving project paths.
 * @param {string} projectName The encoded project name (e.g., '-home-user-project').
 * @returns {Promise<string>} The absolute file system path.
 */
async function getActualProjectPath(projectName) {
  const claudeDir = path.join(process.env.HOME, '.claude');

  // Priority 1: Check project-config.json for manually added projects
  try {
    const configPath = path.join(claudeDir, 'project-config.json');
    const configData = await fs.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);
    if (config[projectName]?.originalPath) {
      return config[projectName].originalPath;
    }
  } catch (error) {
    // Ignore if config doesn't exist or is invalid
  }

  // Priority 2: Check metadata.json inside the project's data directory
  try {
    const metadataPath = path.join(claudeDir, 'projects', projectName, 'metadata.json');
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
    if (metadata.path || metadata.cwd) {
      return metadata.path || metadata.cwd;
    }
  } catch (error) {
    // Ignore if metadata.json doesn't exist
  }

  // Fallback: Decode the path from the project name
  // This is the original, less robust method, but now it's just a fallback.
  return projectName.replace(/-/g, '/');
}


/**
 * Checks if a given file path is safely within a specified root directory.
 * Prevents path traversal attacks.
 * @param {string} filePath The file path to check.
 * @param {string} projectRoot The root directory that the file path should be within.
 * @returns {boolean} True if the path is safe, false otherwise.
 */
function isPathSafe(filePath, projectRoot) {
  const resolvedPath = path.resolve(filePath);
  const resolvedRoot = path.resolve(projectRoot);

  // Check if the resolved path is within the resolved root directory.
  // The + path.sep is crucial to prevent cases where projectRoot is a prefix
  // of another directory name, e.g., /home/user/project vs /home/user/project-plus.
  return resolvedPath.startsWith(resolvedRoot + path.sep) || resolvedPath === resolvedRoot;
}


module.exports = {
  spawnAsync,
  getActualProjectPath,
  isPathSafe
};
