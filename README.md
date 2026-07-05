# 🔗 URL Shortener — End-to-End DevOps Project

A deliberately simple app used as a vehicle to practice the **entire DevOps toolchain**:
Docker → CI → Terraform → Ansible → Kubernetes → CD → Monitoring → Security.

```
Code push → GitHub Actions (test, build, scan) → Image pushed to Docker Hub
   → Terraform provisions an Azure VM → Ansible configures it & deploys
   → (or) Kubernetes runs it with autoscaling → Prometheus/Grafana monitor it live
```

> 📘 For a full beginner-friendly walkthrough with explanations at every step, see **AZURE-GUIDE.md**.

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
   - `DOCKERHUB_TOKEN` (create one at hub.docker.com → Account Settings → Security — make sure it has **Read & Write** access, not read-only)
3. Push to `main`. Go to the **Actions** tab and watch it: run tests → build image → scan with Trivy → push to Docker Hub.

This is `.github/workflows/ci-cd.yml`. Every commit now automatically produces a tested, scanned, versioned image — no manual `docker build` ever again.

---

## Phase 3: Terraform (provision a real server on Azure)

Requires an Azure account (Free Tier or Azure for Students both work) and the Azure CLI configured (`az login`).

```bash
cd terraform-azure
terraform init
terraform plan
terraform apply
```
Note the `vm_public_ip` output — you'll need it in Phase 4.

> ⚠️ **Azure for Students note:** student subscriptions restrict which regions and VM sizes you can use. If `terraform apply` fails with `RequestDisallowedByAzure`, run this to find your account's allowed regions:
> ```bash
> az policy assignment list --query "[?contains(policyDefinitionId, 'e56962a6-4747-49cd-b67b-bf8b01975c4c')].{name:displayName, allowedRegions:parameters.listOfAllowedLocations.value}" -o json
> ```
> Then update `location` in `variables.tf` to one of the allowed regions. If you also hit `SkuNotAvailable`, try a different VM size (`Standard_B1ms`, `Standard_B2s`, or `Standard_D2s_v3`) in `main.tf`.

To tear it down when done (important — avoids using up your Azure credit):
```bash
terraform destroy
```

---

## Phase 4: Ansible (configure the server & deploy)

Ansible doesn't run natively on Windows — install **WSL2** first (`wsl --install` in an Administrator PowerShell, then restart), then run everything below inside the Ubuntu terminal it installs.

1. Edit `ansible/inventory-azure.ini` — put the IP from Terraform's `vm_public_ip` output.
2. Copy your SSH key into the Linux environment if using WSL:
   ```bash
   mkdir -p ~/.ssh
   cp /mnt/c/Users/<you>/.ssh/id_rsa ~/.ssh/
   cp /mnt/c/Users/<you>/.ssh/id_rsa.pub ~/.ssh/
   chmod 600 ~/.ssh/id_rsa
   ```
3. The first time connecting to a new server, SSH in manually once to accept its host key (Ansible can't answer that prompt itself):
   ```bash
   ssh azureuser@<vm_public_ip>
   exit
   ```
4. Run the playbook:
   ```bash
   cd ansible
   ansible-playbook -i inventory-azure.ini playbook.yml --extra-vars "dockerhub_username=YOUR_DOCKERHUB_USERNAME"
   ```

This installs Docker on the fresh server and starts your app + MongoDB containers automatically — no manual SSH configuration steps.

Visit `http://<vm_public_ip>:3000` — your app is now live on real cloud infrastructure.

---

## Phase 5: Kubernetes (orchestration)

Try it locally first with **Minikube**. On Windows, if VirtualBox fails with a virtualization error, use the Docker driver instead (works alongside Docker Desktop with no BIOS changes needed):
```bash
minikube start --driver=docker
```
Then:
```bash
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

Once comfortable, do the same against a managed cluster like **Azure Kubernetes Service (AKS)**.

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
- Next steps to add yourself: store secrets in **Azure Key Vault** instead of `.env`, add HTTPS via `cert-manager` if deployed on Kubernetes with Ingress.

---

## Architecture Diagram

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
                 provisions Azure VM & deploys                  (Deployment + HPA)
                          |                                             |
                          -----------------------------------------------
                                                     |
                                        [Prometheus] <--- scrapes /metrics
                                                     |
                                              [Grafana Dashboard]
```

---
