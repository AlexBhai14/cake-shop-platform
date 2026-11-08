# Git Workflow

This document defines how Git is used in the Cloud-Native Cake Shop Platform.

## 1. Core Rules

1. The repository is **public**. Never commit `.env` files, passwords, private keys or tokens.
2. Never run `git add .` blindly. Run `git status` first and review every file.
3. Commit only after the phase's tests and checks pass.
4. Never claim a commit or push succeeded without checking the terminal output.
5. Push only after confirming the remote and getting approval.
6. Each phase gets one record file: `git-management/PHASE_XX_GIT.md`.
7. Before every push, run `git remote -v` and `git rev-parse --show-toplevel`.

## 2. Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Stable, working code only |
| `phase/XX-name` | Work for one phase (used from Phase 02 onward) |

Phase 01 is committed directly to `main` because the repository is nearly empty. From Phase 02, each phase is developed on its own branch and merged into `main` after verification.

Example branch name: `phase/02-mysql-prisma`

## 3. Commit Message Format

Format: `type(scope): short description`

| Type | Use for |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `chore` | Setup, config, tooling |
| `test` | Adding or changing tests |
| `refactor` | Code change without behaviour change |

Examples:

- `chore(setup): initialize project structure and git workflow`
- `feat(auth): add user registration endpoint`
- `docs(readme): update project status`

## 4. Commands Used Often

| Command | What it does |
|---|---|
| `git status` | Shows changed, staged and untracked files |
| `git add <file>` | Stages a specific file for the next commit |
| `git commit -m "message"` | Saves staged changes as a snapshot |
| `git log --oneline` | Shows commit history in short form |
| `git push` | Uploads commits to GitHub |
| `git pull` | Downloads and merges commits from GitHub |
| `git branch` | Lists branches |
| `git switch -c <name>` | Creates and switches to a new branch |
| `git merge <name>` | Merges a branch into the current branch |

## 5. End-of-Phase Checklist

1. Run `git status` and list new, modified and deleted files.
2. Review `.gitignore`.
3. Confirm no `.env`, secrets, keys or generated files are staged.
4. Run the phase's tests and checks.
5. Update `PHASE_XX_GIT.md`.
6. Stage files by name or folder after review.
7. Commit with a proper message.
8. Verify with `git log --oneline`.
9. Push after approval and verify on GitHub.
10. Record the commit hash and push status in `PHASE_XX_GIT.md`.

## 6. If Something Goes Wrong

- **Secret committed by mistake:** stop and tell the mentor. Rotate the secret first, then clean the history.
- **Merge conflict:** do not guess. Open the conflicted file, read both versions, and resolve deliberately.
- **Wrong repository:** check `git remote -v` and `git rev-parse --show-toplevel` before every push.
