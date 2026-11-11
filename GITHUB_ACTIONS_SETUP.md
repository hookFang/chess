# GitHub Actions Setup

The workflow in `.github/workflows/ci.yml` runs the tests and publishes the Docker image to Docker Hub.

## One-time setup

1. In [Docker Hub](https://hub.docker.com): **Account Settings → Security → New Access Token** (Read & Write).
2. In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**, and add:

| Secret | Value |
|---|---|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | The access token from step 1 |

## What runs

| Trigger | Jobs |
|---|---|
| Pull request to `main`/`master` | Backend tests, frontend tests, E2E |
| Push to `main`, `master` or `develop` | The same tests |
| Push to `main` or `master` (tests green) | Also builds and pushes the Docker image |

- **Backend tests**: Jest unit + integration tests against a Postgres service container.
- **Frontend tests**: React Testing Library tests for the client.
- **E2E**: Playwright with two real browsers (game creation, joining, moves, castling).
- **Docker**: builds the single image (server + embedded PostgreSQL + nginx) and pushes it to Docker Hub as `<DOCKERHUB_USERNAME>/chess:latest` (the only tag published; each build replaces the previous `latest`).

Skip a run by putting `[skip ci]` in the commit message.

## Using the published image

```bash
docker run -d --name chess -p 443:443 -v chess-data:/data <DOCKERHUB_USERNAME>/chess:latest
```

See the [README](README.md) for configuration and upgrade steps.

## Troubleshooting

- **Docker push fails** – check that both secrets exist and that the token has write access.
- **Tests fail in CI but pass locally** – CI uses a Postgres service container; compare the `env:` blocks in the workflow with your local setup. Node 20 is used in CI.
- **E2E timeouts** – raise the timeout in `client/playwright.config.js` and check the Postgres service is healthy.
