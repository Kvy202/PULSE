# Deploying PULSE + MIRROR on AWS (one EC2 + ALB)

Both apps run a **single authoritative game loop**, so each runs as **exactly one
instance** — do not autoscale. The setup: one EC2 box runs both server containers
+ one shared Mongo on a Docker network; host nginx serves the static clients and
proxies `/api` + `/socket.io` (same-origin); an ALB terminates TLS with an ACM
cert; Route 53 maps the subdomains.

```
Route 53  pulse.tradyai.live / mirror.tradyai.live
   → ALB (HTTPS:443, ACM cert)
     → EC2:80 (nginx)
        ├─ /            → /srv/{pulse,mirror}      (static client)
        ├─ /api/*       → 127.0.0.1:{4000,4001}    (server container)
        └─ /socket.io/* → 127.0.0.1:{4000,4001}    (WebSocket)
   server containers ──► mongo (shared Docker network `webnet`)
```

## 0. Prereqs already in the code
- `NODE_ENV=production` → the session cookie is set `Secure`.
- `app.set('trust proxy', true)` so the real client IP (per-IP vote cap) is read
  from `X-Forwarded-For` behind the ALB + nginx.
- TTL indexes on `Vote` (7 days) and `Round` (30 days) so 24/7 bot traffic can't
  grow the DB without bound. The lasting memory lives in `WorldState` + `Soul`.

## 1. DNS — Route 53
1. Create a hosted zone for `tradyai.live`; point your registrar's NS at it.

## 2. Certificate — ACM (same region as the ALB)
2. Request a public cert for `pulse.tradyai.live` **and** `mirror.tradyai.live`;
   click "Create records in Route 53" to validate. Wait for **Issued**.

## 3. EC2 + security groups
3. Launch `t3.small` (Amazon Linux 2023), attach an Elastic IP (SSH convenience).
   - **ALB SG**: inbound 80 + 443 from `0.0.0.0/0`.
   - **EC2 SG**: inbound 80 from the **ALB SG only**, 22 from **your IP only**.
4. Install tooling:
   ```bash
   sudo dnf install -y docker nginx git rsync
   sudo systemctl enable --now docker nginx
   sudo usermod -aG docker ec2-user   # re-login after this
   ```

## 4. Shared Mongo on a Docker network (one for both apps)
```bash
docker network create webnet
docker run -d --name mongo --network webnet \
  -v mongo-data:/data/db --restart unless-stopped mongo:7
```
> One `mongod` serves both databases (`pulse`, `mirror`). Servers reach it as
> `mongodb://mongo:27017/...` — the service name, never `127.0.0.1`.

## 5. Secrets — persistent, per-app env files (not shell exports)
Each app reads its secrets from a **permanent, root-only, git-ignored** file:
`/etc/tradyai/pulse.env` and `/etc/tradyai/mirror.env`, each with **its own
`SESSION_SECRET`**. `deploy/docker-compose.prod.yml` loads it via `env_file`, and
`deploy.sh` **refuses to deploy if it's missing** — dropping a ready-to-use
example (with a freshly generated secret) the first time:

```bash
git clone https://github.com/Kvy202/PULSE.git  && cd PULSE
./deploy/deploy.sh                              # fails: writes /etc/tradyai/pulse.env.example
sudo cp /etc/tradyai/pulse.env.example /etc/tradyai/pulse.env
./deploy/deploy.sh                              # now deploys
cd ..
```
Repeat for MIRROR (`/etc/tradyai/mirror.env`). The files persist across reboots
and redeploys; keep them backed up somewhere safe.

`deploy.sh` then builds + starts the server container (compose), installs the
shared forwarded-proto map + the app's nginx block, builds the client with the
right `VITE_SERVER_URL`, and publishes it to `/srv/<app>`. Containers publish to
`127.0.0.1:4000` / `:4001` only.

## 6. ALB
6. Create an internet-facing **ALB** across both public subnets (ALB SG).
   - **Target group** → the EC2 instance, port **80**, health check path `/health`
     (nginx answers it directly, so it never depends on a backend).
   - **Listeners**: 443 (HTTPS) with the ACM cert → forward to the target group;
     80 → redirect to 443.
   - Raise the **idle timeout to ~120s** (headroom for the Socket.io ping cycle).

## 7. Point the subdomains at the ALB
7. Route 53 → A/ALIAS records `pulse.tradyai.live` and `mirror.tradyai.live` → ALB.

## 8. Verify
- `https://pulse.tradyai.live/health` → `{"ok":true}`.
- Open each site: the visualization animates, two tabs answer and move live, the
  padlock is valid, and the session cookie is `Secure; HttpOnly`.

## Updating
SSH in, `git pull` in the repo, re-run `./deploy/deploy.sh`. (Or wire a GitHub
Actions job that SSHes and runs it.)

## Backups (Mongo)
One `mongo` container holds both databases. Dump everything to a gzip archive:
```bash
docker exec mongo mongodump --archive --gzip > "mongo-$(date +%F).archive.gz"
```
Restore it (the `--drop` replaces existing data):
```bash
docker exec -i mongo mongorestore --archive --gzip --drop < mongo-2026-06-17.archive.gz
```
Run the dump on a schedule with cron and keep a few days of archives. *(Optional,
later: copy the archive off-box with `aws s3 cp … s3://your-bucket/` — not set up
here yet.)*

## Notes
- **One instance per app.** Never run two — the loops would fight over the DB.
  To scale reads/sockets later: `@socket.io/redis-adapter` + ElastiCache, with the
  loop pinned to a single leader.
- Managed-DB option: swap the Mongo container for **Amazon DocumentDB** (same VPC,
  allow 27017 from the EC2 SG) and set `MONGO_URI` to its endpoint — test the
  app's operators against DocumentDB 5.0 first.
- Static delivery can later move to **S3 + CloudFront** for a global CDN.
