# Git Commit Guidelines

Whenever you are asked to commit or push changes for this project, you must strictly follow these rules:

1. **No Big Commits:** Do NOT squash all changes into a single "big commit" (e.g., `git add . && git commit -m "update"`). 
2. **Atomic Commits:** ALWAYS split changes into atomic, granular, and logical commits based on the architecture layer (e.g., separating UI components, Backend scripts, Smart Contracts, and Documentation into distinct commits).
3. **Conventional Commits:** Use standard conventional commit formatting for the commit messages:
   - `feat(ui): ...` for frontend/app changes.
   - `feat(contracts): ...` for smart contract/Anchor changes.
   - `feat(backend): ...` for keeper/crank scripts.
   - `docs: ...` for README or markdown updates.
   - `fix(...): ...` for bug fixes.
   - `chore(...): ...` for dependency or config updates.
4. **Careful Staging:** Use `git status` to carefully review modified files, and selectively stage files for each logical commit using `git add <file1> <file2>`.
