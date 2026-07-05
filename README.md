# 🔗 URL Shortener — End-to-End DevOps Project

A deliberately simple app used as a vehicle to practice the **entire DevOps toolchain**:
Docker → CI → Terraform → Ansible → Kubernetes → CD → Monitoring → Security.

```
Code push → GitHub Actions (test, build, scan) → Image pushed to Docker Hub
   → Terraform provisions AWS server → Ansible configures it & deploys
   → (or) Kubernetes runs it with autoscaling → Prometheus/Grafana monitor it live
```

---

## Phase 0: Run it locally (no DevOps yet — just prove the app works)

```bash
cd app
npm install
# You need a local MongoDB running, or use Docker for just the DB:
docker run -d -p 27017:27017 --name mongo mongo:7
MONGO_URI=mongodb://localhost:27017/urlshortener node server.js
```
Visit `http://localhost:3000`. Test the API directly:
```bash
curl -X POST http://localhost:3000/api/shorten -H "Content-Type: application/json" \
  -d '{"originalUrl":"https://github.com"}'
```

---

## Phase 1: Docker

Build and run everything (app + MongoDB + Prometheus + Grafana) with one command:
```bash
docker compose up --build
```
- App: http://localhost:3000
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (login: admin/admin)

Concepts you're learning: Dockerfile layers, multi-stage builds, non-root users, health checks, Docker Compose networking.

---

## Phase 2: CI with GitHub Actions

1. Push this repo to GitHub.
2. In your repo settings → **Secrets and variables → Actions**, add:
   - `DOCKERHUB_USERNAME`
   - `DOCKERHUB_TOKEN` (create one at hub.docker.com → Account Settings → Security)
3. Push to `main`. Go to the **Actions** tab and watch it: run tests → build image → scan with Trivy → push to Docker Hub.

This is `.github/workflows/ci-cd.yml`. Every commit now automatically produces a tested, scanned, versioned image — no manual `docker build` ever again.

---

## Phase 3: Terraform (provision a real server on AWS)

Requires an AWS account (Free Tier is enough) and the AWS CLI configured (`aws configure`).

```bash
cd terraform
terraform init
terraform plan -var="key_pair_name=YOUR_EC2_KEY_PAIR_NAME"
terraform apply -var="key_pair_name=YOUR_EC2_KEY_PAIR_NAME"
```
Note the `instance_public_ip` output — you'll need it in Phase 4.

To tear it down when done (important, avoids AWS charges):
```bash
terraform destroy -var="key_pair_name=YOUR_EC2_KEY_PAIR_NAME"
```

---

## Phase 4: Ansible (configure the server & deploy)

1. Edit `ansible/inventory.ini` — put the IP from Terraform's output.
2. Run:
```bash
cd ansible
ansible-playbook -i inventory.ini playbook.yml --extra-vars "dockerhub_username=YOUR_DOCKERHUB_USERNAME"
```
This installs Docker on the fresh server and starts your app + MongoDB containers automatically — no manual SSH steps.

Visit `http://<instance_public_ip>:3000` — your app is now live on real cloud infrastructure.

---

## Phase 5: Kubernetes (orchestration)

Try it locally first with **Minikube**:
```bash
minikube start
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/mongo-pvc.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress-and-hpa.yaml

kubectl get pods        # see your pods running
kubectl get hpa         # see the autoscaler
minikube service url-shortener-service --url
```
> Replace `YOUR_DOCKERHUB_USERNAME` in `k8s/deployment.yaml` with your actual Docker Hub image before applying.

Once comfortable, do the same against a managed cluster like **AWS EKS** or **DigitalOcean Kubernetes**.

---

## Phase 6: CD (GitOps, conceptual next step)

The `deploy` job in the GitHub Actions workflow is a placeholder. The real next step:
- Install **ArgoCD** on your cluster
- Point it at this repo's `k8s/` folder
- Update the CI pipeline to bump the image tag in `k8s/deployment.yaml` on every successful build
- ArgoCD detects the change and auto-syncs the cluster — **no one ever runs `kubectl apply` by hand again**

---

## Phase 7: Monitoring

Already wired up in `docker-compose.yml` and `monitoring/prometheus.yml`. The app exposes metrics at `/metrics` (see `server.js`) using `prom-client`.

In Grafana (http://localhost:3001):
1. Add Prometheus as a data source: `http://prometheus:9090`
2. Import or build a dashboard showing `http_requests_total` and default Node.js metrics (memory, event loop lag)

---

## Phase 8: Security

- Trivy scan already runs in CI (`ci-cd.yml`) — set `exit-code: '1'` once you want builds to fail on critical CVEs.
- The Docker image runs as a **non-root user** (see `Dockerfile`).
- Next steps to add yourself: store secrets in AWS Secrets Manager instead of `.env`, add HTTPS via `cert-manager` if deployed on Kubernetes with Ingress.

---

## Architecture Diagram (recreate this in draw.io/Excalidraw for your README/LinkedIn post)

```
 [Developer] --push--> [GitHub] --triggers--> [GitHub Actions CI]
                                                     |
                                        test -> build -> Trivy scan -> push image
                                                     |
                                                     v
                                          [Docker Hub Registry]
                                                     |
                          -----------------------------------------------
                          |                                             |
                 [Terraform + Ansible]                         [Kubernetes Cluster]
                 provisions EC2 & deploys                       (Deployment + HPA)
                          |                                             |
                          -----------------------------------------------
                                                     |
                                        [Prometheus] <--- scrapes /metrics
                                                     |
                                              [Grafana Dashboard]
```

---

## Putting This on LinkedIn

1. **Push to GitHub**, pin the repo on your profile, add topics: `docker`, `kubernetes`, `terraform`, `ansible`, `cicd`, `devops`, `prometheus`.
2. **Record a 60-90 second demo**: show a `git push`, jump to the GitHub Actions tab going green, then show the live app and the Grafana dashboard. Use Loom or OBS.
3. **Write the post** using this structure:
   - Hook: "I built a URL shortener to learn DevOps — here's the pipeline behind it 👇"
   - The architecture diagram image (this stops the scroll far more than a link)
   - 4-5 bullet points: what each tool does in one line
   - The GitHub link + demo video
   - Tag it: #devops #docker #kubernetes #terraform #cicd
4. Mention what broke and how you fixed it — a two-line "biggest challenge" note makes it far more credible than a polished tutorial recap.
