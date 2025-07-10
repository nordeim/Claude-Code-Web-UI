Excellent. I have re-validated my findings against the codebase and confirmed their validity. The plan will be structured to prioritize the most critical issues first.

Here is the comprehensive, phased execution plan to address the identified issues. I will start by detailing all phases and their objectives, then provide the specific execution plan for **Phase 1**. I will await your confirmation before proceeding with the implementation of Phase 1.

***

## Overall Execution Plan: Phased Approach

### Phase 1: Critical Security Hardening

*   **Objective**: Address and neutralize the most critical security vulnerabilities to protect the user's system.
*   **Key Tasks**:
    1.  Implement strict path validation to prevent path traversal attacks in all file system-related API endpoints.
    2.  Refactor the Git command execution logic in `server/routes/git.js` to use `spawn` instead of `exec`, eliminating any risk of command injection.

### Phase 2: Core Logic and Stability Improvements

*   **Objective**: Fix core architectural flaws and bugs that affect the application's stability, performance, and correctness.
*   **Key Tasks**:
    1.  Fix the memory leak in `Shell.jsx` by replacing the global `Map` with an LRU cache for terminal sessions.
    2.  Create a centralized, robust utility for encoding and decoding project paths to resolve ambiguity and ensure consistency across the backend.

### Phase 3: Frontend Refactoring and Maintainability

*   **Objective**: Improve the frontend architecture and code quality for better long-term maintainability and adherence to best practices.
*   **Key Tasks**:
    1.  Eliminate prop drilling by introducing React Context for session management functions and UI settings.
    2.  Remove the global `window.refreshProjects` function and replace it with a more idiomatic React solution (e.g., a function passed via Context).
    3.  Refactor `src/index.css` to reduce or eliminate the use of `!important` by using more specific CSS selectors.

---

## Phase 1: Critical Security Hardening - Detailed Plan

This phase is paramount as it addresses vulnerabilities that could allow an attacker to read/write arbitrary files or execute arbitrary commands on the user's machine.

### Task 1.1: Prevent Path Traversal Vulnerability

*   **Goal**: Ensure that all file system operations requested via the API are strictly confined within their respective project directories.
*   **Strategy**: Create a centralized utility function that validates file paths. This function will be used in every API endpoint that accepts a file path from the client.

#### Sub-task 1.1.1: Create a Secure Path Validation Utility

*   **Action**: Create a new file `server/utils.js` to house shared security and utility functions.
*   **File to Create**: `server/utils.js`
*   **Checklist for `server/utils.js`**:
    *   [ ] Define and export a function `getActualProjectPath(projectName)`. This will be the single source of truth for decoding a project name into a file system path.
    *   [ ] Define and export a function `isPathSafe(filePath, projectRoot)`.
    *   [ ] The `isPathSafe` function must resolve both `filePath` and `projectRoot` to their absolute paths using `path.resolve()`.
    *   [ ] It must then check if the resolved `filePath` string starts with the resolved `projectRoot` string, followed by a path separator. This guarantees the file is within the project directory.

#### Sub-task 1.1.2: Integrate Path Validation into `server/index.js`

*   **Action**: Update `server/index.js` to import and use the new validation utility in all relevant API endpoints.
*   **File to Update**: `server/index.js`
*   **Checklist for `server/index.js`**:
    *   [ ] Import `getActualProjectPath` and `isPathSafe` from `./utils.js`.
    *   [ ] In the `/api/projects/:projectName/file` (read) endpoint:
        *   [ ] Use `getActualProjectPath` to get the project root.
        *   [ ] Use `isPathSafe` to validate the `filePath` from the query parameter against the project root.
        *   [ ] If the path is not safe, return a `403 Forbidden` error immediately.
    *   [ ] In the `/api/projects/:projectName/files/content` (serve binary) endpoint:
        *   [ ] Use `getActualProjectPath` to get the project root.
        *   [ ] Use `isPathSafe` to validate the `filePath` against the project root.
        *   [ ] If the path is not safe, return a `403 Forbidden` error.
    *   [ ] In the `/api/projects/:projectName/file` (write) endpoint:
        *   [ ] Use `getActualProjectPath` to get the project root.
        *   [ ] Use `isPathSafe` to validate the `filePath` from the request body against the project root.
        *   [ ] If the path is not safe, return a `403 Forbidden` error.
    *   [ ] In the `/api/projects/:projectName/files` (file tree) endpoint:
        *   [ ] Remove the complex, inconsistent path resolution logic from this endpoint.
        *   [ ] Replace it with a single call to the new, centralized `getActualProjectPath` from `server/utils.js`.

#### Sub-task 1.1.3: Update `server/routes/git.js` to Use Secure Path Utility

*   **Action**: Refactor `server/routes/git.js` to use the centralized path utility, removing its own insecure implementation.
*   **File to Update**: `server/routes/git.js`
*   **Checklist for `server/routes/git.js`**:
    *   [ ] Import `getActualProjectPath` from `../utils.js`.
    *   [ ] Remove the local, insecure `getActualProjectPath` function.
    *   [ ] Verify that all calls now use the imported, secure utility.

### Task 1.2: Prevent Command Injection Vulnerability

*   **Goal**: Replace all uses of `exec` and `execAsync` with the more secure `spawn` method for executing Git commands.
*   **Strategy**: Create a wrapper function for `spawn` that returns a promise, mimicking the convenience of `execAsync` while providing the security of `spawn`. This wrapper will be used throughout `server/routes/git.js`.

#### Sub-task 1.2.1: Add a Secure `spawn` Wrapper to `server/utils.js`

*   **Action**: Extend the `server/utils.js` file with a new function to safely execute commands.
*   **File to Update**: `server/utils.js`
*   **Checklist for `server/utils.js`**:
    *   [ ] Define and export an `async` function `spawnAsync(command, args, options)`.
    *   [ ] The function should wrap the `spawn` call in a Promise.
    *   [ ] It should collect `stdout` and `stderr` data streams.
    *   [ ] On process `close`, it should resolve the promise with `{ stdout, stderr }` if the exit code is 0.
    *   [ ] On process `close` with a non-zero exit code, it should reject the promise with an error that includes the `stderr` content.
    *   [ ] On a process `error` event, it should also reject the promise.

#### Sub-task 1.2.2: Refactor `server/routes/git.js` to Use `spawnAsync`

*   **Action**: Replace every call to `execAsync` in the Git routes with the new, secure `spawnAsync` wrapper.
*   **File to Update**: `server/routes/git.***js`
*   **Checklist for `server/routes/git.js`**:
    *   [ ] Import `spawnAsync` from `../utils.js`.
    *   [ ] Remove the import and usage of `execAsync`.
    *   [ ] In the `/status` endpoint, convert `git rev-parse --git-dir` and `git status --porcelain` to `spawnAsync('git', ['rev-parse', '--git-dir'], ...)` etc.
    *   [ ] In the `/diff` endpoint, convert `git status --porcelain "${file}"` and `git diff HEAD -- "${file}"` to `spawnAsync('git', ['status', '--porcelain', file], ...)` etc. Note how `file` is now an argument in an array, not part of a command string.
    *   [ ] In the `/commit` endpoint, convert `git add "${file}"` and `git commit -m "..."` to their `spawnAsync` equivalents. The commit message will be passed as a separate argument.
    *   [ ] In the `/branches`, `/checkout`, `/create-branch`, `/commits`, and `/commit-diff` endpoints, convert all `execAsync` calls to `spawnAsync`.
    *   [ ] In the `/generate-commit-message` endpoint, update the `git diff` call to use `spawnAsync`.

I am now ready to proceed with Phase 1. Please confirm that I should begin the implementation.

