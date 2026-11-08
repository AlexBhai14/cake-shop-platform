# Phase 01 Learning Notes

## Tools and their roles
- **Node.js / npm:** runs JavaScript/TypeScript and installs libraries.
- **Git:** version control; each phase ends with a commit.
- **Docker / Compose:** containers for MySQL, Redis, RabbitMQ and services.
- **Kubernetes:** orchestrates containers; used from Phase 17.
- **kubectl:** command-line tool for Kubernetes.

## Version checks
- `--version` shows a tool is installed; it does not prove it is running.
- `docker info` proves the Docker engine is running.
- `kubectl get nodes` proves a cluster is reachable.

## Git lessons
- `git rev-parse --show-toplevel` shows which repository you are in.
- `git remote -v` shows where `git push` sends code. Check it before pushing.
- A folder inside another repository belongs to that repository unless it has its own `.git`.
- `git rm <file>` deletes a file and stages the deletion.
- `.gitignore` must exist before secrets do; a public repo makes this critical.
- Git does not track empty folders, hence `.gitkeep` files.
