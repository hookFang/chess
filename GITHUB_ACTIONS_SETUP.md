# GitHub Actions Setup Guide

This guide explains how to set up GitHub Actions for the King Fall chess application.

## Prerequisites

1. Repository forked or cloned to GitHub
2. A [Docker Hub](https://hub.docker.com) account

## Configuration Steps

### 1. Create a Docker Hub Access Token

1. Log in to [hub.docker.com](https://hub.docker.com)
2. Go to **Account Settings** → **Security** → **New Access Token**
3. Give the token a name (e.g., `github-actions`)
4. Select **Read, Write, Delete** permissions
5. Copy the generated token — you'll need it in the next step

### 2. Add GitHub Secrets

In your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** and add both:

| Secret Name         | Value                       |
|---------------------|-----------------------------|
| `DOCKERHUB_USERNAME`| Your Docker Hub username    |
| `DOCKERHUB_TOKEN`   | The access token from step 1|

### 3. Docker Image Publishing

The pipeline automatically builds and pushes Docker images to Docker Hub when code is pushed to `main` branch.

**Image Location:**
```
YOUR_DOCKERHUB_USERNAME/chess:latest
YOUR_DOCKERHUB_USERNAME/chess:sha-abc123
YOUR_DOCKERHUB_USERNAME/chess:run-42
```

### 4. Pull Docker Image

After the Docker build completes successfully, you can pull the image:

```bash
docker pull YOUR_DOCKERHUB_USERNAME/chess:latest
docker run -p 3001:3001 YOUR_DOCKERHUB_USERNAME/chess:latest
```

### 4. Image Tagging Strategy

The pipeline uses three tagging strategies:

- **sha-{short-sha}**: Unique tag for each commit (e.g., `sha-abc1234`)
- **run-{run-number}**: Sequential number based on workflow run (e.g., `run-42`)
- **latest**: Always points to the most recent successful build on main
- **branch-name**: Git branch name (e.g., `main`, `develop`)

This allows you to:
- Track specific commit builds
- Rollback to a specific workflow run
- Always pull the latest stable version

## Pipeline Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ Code Push to main/develop or Pull Request                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              ▼              ▼
   ┌─────────┐  ┌─────────┐  ┌──────────┐
   │ Backend │  │Frontend │  │  (N/A)   │
   │ Tests   │  │ Tests   │  │          │
   │ (Jest)  │  │(React)  │  │          │
   └────┬────┘  └────┬────┘  └──────────┘
        │            │
        └────┬───────┘
             │
      (Both pass?)
             │
             ▼
        ┌──────────┐
        │ E2E      │
        │ Tests    │
        │(Playwright)
        └────┬─────┘
             │
      (E2E pass?)
             │
        ┌────▼──────────────────────┐
        │ Only on main push:         │
        │ Build & Push Docker Image  │
        │ to GHCR                    │
        └────────────────────────────┘
```

## Test Coverage

The pipeline verifies:

### Backend Tests (Jest)
- Unit tests for chess engine, auth utilities
- Integration tests for API endpoints, WebSocket
- Database operations
- Coverage threshold: 70% (90% for chess.js)

### Frontend Tests (React Testing Library)
- Component rendering and interaction
- User input handling
- State management

### E2E Tests (Playwright)
- User authentication flow
- Game creation and joining
- Move execution
- Game state synchronization

## Triggering Builds

Builds are triggered on:

- **Push to main** → Runs all tests + builds Docker image
- **Push to develop** → Runs all tests (no Docker build)
- **Pull Requests to main** → Runs all tests

To manually skip a build, include `[skip ci]` in your commit message:
```bash
git commit -m "Update docs [skip ci]"
```

## Troubleshooting

### Docker Push Fails
- Verify GitHub Container Registry is enabled in repository settings
- Check that `secrets.GITHUB_TOKEN` is available (automatic)
- Ensure workflow has `packages: write` permission

### Tests Fail in CI but Pass Locally
- CI uses PostgreSQL service instead of Docker compose
- Check environment variables in the workflow file
- Ensure Node.js versions match (v20 in CI)

### E2E Tests Timeout
- Increase playwright timeout in `client/playwright.config.js`
- Ensure PostgreSQL service is healthy
- Check network connectivity in CI environment

## Security Notes

1. **GITHUB_TOKEN** is automatically generated and scoped to current repository
2. **Sensitive data** (API keys, credentials) should not be committed
3. Use **GitHub Secrets** for production environment variables
4. Docker images are private to your repository by default

## Next Steps

1. Push code to trigger first build
2. Monitor workflow in **Actions** tab
3. Customize coverage thresholds in `jest.config.js` if needed
4. Set up branch protection rules requiring passing checks

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Documentation](https://docs.docker.com/)
- [GHCR Documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
