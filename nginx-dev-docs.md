# nginx + Docker — Dev Guide

nginx sits in front of the clinic app as a **reverse proxy** and **load balancer**.
It is the single public entry point on **port 80** and distributes traffic across
one or more `app` replicas. The app container itself publishes **no** host port —
you always reach it through nginx.

## Architecture

```
                 ┌─────────────────────────────────────────────┐
  browser  ──►   │  nginx :80  (reverse proxy + load balancer)  │
   :80           └───────────────┬─────────────────────────────┘
                                 │  round-robin (Docker DNS)
                 ┌───────────────┼───────────────┐
                 ▼               ▼               ▼
              app :4000      app :4000       app :4000      (N replicas, internal only)
                 │
                 ▼
              waha :3000  (WhatsApp gateway — its own published port)
```

### Ports

| Service   | Internal | Published | Notes                                                |
|-----------|----------|-----------|------------------------------------------------------|
| nginx     | 80       | **80**    | Public entry point. Hit the app here.                |
| app       | 4000     | —         | Internal only (`expose`). Scaled behind nginx.       |
| waha      | 3000     | 3000      | WhatsApp dashboard/API, direct at `localhost:3000`.  |
| postgres  | 5432     | 5432      | Optional, `localdb` profile only.                    |

### How the load balancing works

nginx uses Docker's embedded DNS (`resolver 127.0.0.11`) plus a **variable**
`proxy_pass` (`set $app_upstream http://app:4000;`) instead of a static
`upstream` block. The variable form forces nginx to re-resolve the `app` hostname
on each request; Docker DNS returns all replica IPs in round-robin order, so
traffic spreads across every replica and newly-scaled instances join within ~10s.
A static `upstream { server app:4000; }` would resolve once at startup and pin to
a single replica — which is why we deliberately avoid it. See
[`nginx/nginx.conf`](nginx/nginx.conf).

## Important Docker commands

> All commands run from the repo root. Requires a populated `.env` (Supabase +
> WAHA keys). Docker Compose v2 syntax (`docker compose`, not `docker-compose`).

### Build & run

```bash
docker compose up -d --build          # build images + start the whole stack
docker compose up -d                  # start (reuse existing images)
docker compose up -d --scale app=3    # run 3 app replicas behind nginx
docker compose --profile localdb up -d  # also start the local Postgres
```

### Inspect

```bash
docker compose ps                     # container status + health
docker compose logs -f nginx          # follow nginx access/error logs
docker compose logs -f app            # follow app logs (all replicas)
```

### Prove the load balancer is spreading traffic

Follow nginx logs in one terminal, hammer it in another, and watch the
`-> <ip>:4000` (`$upstream_addr`) field rotate across replicas:

```bash
docker compose logs -f nginx
# in another terminal:
for i in $(seq 1 12); do curl -s http://localhost/ -o /dev/null; done
```

### nginx config workflow (no rebuild needed)

`nginx/nginx.conf` is bind-mounted, so edit it and reload live:

```bash
docker compose exec nginx nginx -t          # validate config syntax
docker compose exec nginx nginx -s reload   # hot-reload, zero downtime
```

### Health checks

```bash
curl -i http://localhost/healthz      # nginx itself → "ok" (never touches the app)
curl -I http://localhost/             # app response through nginx
```

### Tear down

```bash
docker compose down                   # stop + remove containers/network
docker compose down -v                # also drop volumes (WAHA session + pg data)
```

## Notes

- **`NEXT_PUBLIC_SITE_URL`** should now point at the nginx origin — `http://localhost`
  (port 80), not `http://localhost:4000`. It is inlined into the client bundle at
  build time, so change it in `.env` **before** `--build`.
- The **WAHA dashboard** is not proxied — reach it directly at `http://localhost:3000`
  (scan the QR to link WhatsApp).
- nginx waits for the app's Docker `HEALTHCHECK` (`depends_on: condition:
  service_healthy`), so `docker compose up` briefly shows the app as `starting`
  before nginx comes online — this is expected.
