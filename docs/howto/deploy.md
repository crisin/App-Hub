---
title: Run it permanently — local, LAN, remote
section: How-to
order: 7
summary: The hub as a service on your machine, reaching it from other devices, and what it takes to host it on a server or in Docker.
---

# Run it permanently: local, LAN, remote

The hub is built to run on the machine you code on, bound to `127.0.0.1`, always there. Everything
beyond that is possible but changes the trust situation, so read the
[trust model](../concepts/trust-model.md) first. In one sentence: **the hub spawns coding agents
with shell access, its API has no authentication, so whoever can reach port 5174 can run code as
your user.**

## Tier 1 · A service on your own machine (the intended setup)

Production build, started by the OS at logon, loopback only.

```bash
npm run build
```

**macOS** (launchd login agent, restarts on crash, logs to `logs/hub.log`):

```bash
./scripts/install-service.sh
```

```bash
./scripts/uninstall-service.sh
```

**Windows** (per-user Task Scheduler task, no admin, headless at logon):

```bash
node scripts/autostart-windows.mjs install
```

```bash
node scripts/autostart-windows.mjs status
```

`uninstall` removes it, `--dry-run` prints the `schtasks` call. Both services run
`scripts/start.mjs`, which sets `APPHUB_HOST=127.0.0.1`, `APPHUB_PORT=5174` and
`NODE_ENV=production` unless already set, and loads `packages/hub/build/index.js`.

**Updating** a service installation:

```bash
git pull && npm install && npm run build
```

then restart: `launchctl kickstart -k gui/$(id -u)/com.apphub.server` on macOS,
`schtasks /End /TN "App Hub"` followed by `schtasks /Run /TN "App Hub"` on Windows (or log off
and on). Check `curl -s http://127.0.0.1:5174/api/health`.

**Linux** has no script yet, but nothing in the hub is Windows- or macOS-specific. A systemd
user unit does the same job:

```ini
# ~/.config/systemd/user/apphub.service
[Unit]
Description=App Hub
After=network.target

[Service]
WorkingDirectory=%h/App-Hub
ExecStart=/usr/bin/node %h/App-Hub/scripts/start.mjs
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=default.target
```

```bash
systemctl --user enable --now apphub && loginctl enable-linger $USER
```

### What must be on the machine

- Node ≥ 20 on the service's `PATH` (the launchd script records the absolute path at install).
- git with a user name and email, otherwise merges and scaffold commits fail.
- Claude Code CLI, logged in as the user the service runs as. The runner finds it on `PATH`, in
  `~/.local/bin`, npm's global folder, the VS Code extension (Windows) or the desktop app
  (macOS). Alternatively `ANTHROPIC_API_KEY` in `packages/hub/.env` for the talking agents.
- Ollama running locally, or `APPHUB_OLLAMA_URL` pointing at one, if you use local models.
- `packages/hub/.env` for overrides, see [configuration](../reference/config.md).

## Tier 2 · Reach it from other devices without opening it

Keep the loopback binding and bring the port to you instead. Two ways that need no changes to
the hub:

**SSH tunnel** from the other device:

```bash
ssh -N -L 5174:127.0.0.1:5174 user@dev-machine
```

Then <http://localhost:5174> on the laptop is the hub on the dev machine, and the CLI works with
its default `APPHUB_URL`.

**Tailscale** on the dev machine makes the hub available on your tailnet with HTTPS and
Tailscale's own identity check, while the hub itself still only listens on loopback:

```bash
tailscale serve --bg 5174
```

Other devices on the tailnet open `https://dev-machine.<tailnet>.ts.net`. Set `APPHUB_URL` to
that address for the CLI on those devices.

Binding the hub to `0.0.0.0` or the LAN IP (`APPHUB_HOST`) is possible and sometimes convenient
on a home network, but then anyone on that network can drive your coding agents. Do it only
behind something that authenticates (next tier).

## Tier 3 · A server, VPS or home box ("cloud")

The hub is a Node process plus git plus agent CLIs, so it runs anywhere Node runs. What changes
is that the agents work on the **server's** checkout of your projects, with the server's git
identity and the server's Claude Code login, and that you need authentication in front of it.

Checklist:

1. Node ≥ 20, git, Claude Code CLI (`npm i -g @anthropic-ai/claude-code`, then log in once
   interactively as the service user, or provide `ANTHROPIC_API_KEY`), optionally Ollama and
   aider.
2. Clone the hub, `npm install && npm run build`, register or clone the project repos the board
   should manage (`apphub register <path>`; `apphub.local.json` is per machine).
3. A service (systemd unit above) bound to `127.0.0.1`.
4. A reverse proxy that authenticates **every** path, with SSE kept unbuffered. Caddy:

```caddyfile
hub.example.com {
    basic_auth {
        you <hash from: caddy hash-password>
    }
    reverse_proxy 127.0.0.1:5174 {
        flush_interval -1
    }
}
```

   With nginx add `proxy_buffering off;` and a long `proxy_read_timeout` for
   `/api/board/events`, or the live runner output stalls.

5. Prefer Tailscale over a public hostname: `tailscale serve` on the server gives you HTTPS and
   device identity without a public port at all.

Things to know in this setup:

- The CLI on your laptop talks to the proxy: `APPHUB_URL=https://hub.example.com`, and the
  proxy's auth has to accept it (basic auth works with `https://user:pass@host` in the URL).
- The hub's dev auth (`/api/dev/*`) is **not** protection for the hub; it is a login service for
  the apps you scaffold. Its CORS is wide open by design. The proxy must cover those routes too.
- Review-lane merges happen in the server's main checkout. Push from there, pull on your
  machines; the board travels with the commits, see [two machines](two-machines.md).
- Projects that need a GUI, a GPU, or a signed macOS build still want a real machine. The hub on
  a server is good for the board, the talking agents and server-side code; it is not a
  replacement for the desktop setup.

## Docker (sketch)

A container works and keeps the server tidy, with two caveats: the agent CLIs and their logins
must live **inside** the image, and the projects must be mounted volumes, or the agents work on
nothing. This has not been exercised in this repo yet; treat it as a starting point.

```dockerfile
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && npm i -g @anthropic-ai/claude-code
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/hub/package.json packages/hub/
COPY packages/cli/package.json packages/cli/
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production APPHUB_HOST=0.0.0.0 APPHUB_PORT=5174
EXPOSE 5174
CMD ["node", "scripts/start.mjs"]
```

```yaml
# compose.yaml
services:
  hub:
    build: .
    ports: ["127.0.0.1:5174:5174"]        # loopback on the host; put a proxy in front
    environment:
      APPHUB_OLLAMA_URL: http://host.docker.internal:11434
      APPHUB_PROJECT_PATHS: /projects/app-one:/projects/app-two
    volumes:
      - ./projects:/app/projects          # scaffolded projects
      - /srv/repos:/projects              # registered repos
      - hub-data:/app/packages/hub/data   # SQLite index + attachments
      - hub-logs:/app/logs
      - claude-home:/root/.claude         # Claude Code login, persisted
volumes:
  hub-data: {}
  hub-logs: {}
  claude-home: {}
```

Inside the container the hub must bind `0.0.0.0` (that is what `APPHUB_HOST` does here), so the
**only** safe publish is to the host's loopback as shown, with the proxy from tier 3 in front.
Log Claude Code in once with `docker compose exec hub claude` and the volume keeps the session.
Set a git identity in the image or via environment (`GIT_AUTHOR_NAME`, `GIT_COMMITTER_NAME`,
and the email variants).

## Backups

Nothing in the hub needs a backup that git does not already give you:

| Keep | Where it is | Why |
| --- | --- | --- |
| project repos | `projects/`, registered paths | code **and** board (`.apphub/`) |
| the hub repo | the checkout | agents, templates, docs, its own board |
| `packages/hub/.env` | hub root | URLs, keys, model choices (gitignored) |
| `apphub.local.json` | hub root | registered paths, per machine (gitignored) |

The SQLite index and `logs/` are disposable. Branch reviews, the activity log, dev users and
attachments live only in the index; if you care about them, copy `packages/hub/data/`.
