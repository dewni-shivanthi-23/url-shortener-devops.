# Complete Beginner Guide: Building the URL Shortener DevOps Project with Microsoft Azure

This walks through **every single step**, in order, with an explanation of *why* each step exists — not just *what* to type. Follow it top to bottom.

---

## Part 1: Get Your Tools Ready

### Step 1.1 — Create an Azure account
1. Go to https://azure.microsoft.com/free and sign up.
2. Azure gives new accounts **$200 credit for 30 days** plus some services free for 12 months. A `Standard_B1s` VM (what we'll use) is tiny and costs pennies a day, so your credit easily covers the whole project.
3. You'll need a credit/debit card to verify identity — Azure won't charge you unless you upgrade out of the free tier.

> **Why this step matters:** Terraform can't create anything without somewhere to create it — Azure is that "somewhere."

### Step 1.2 — Install the Azure CLI
This is the command-line tool that lets your computer talk to your Azure account.

**Windows (PowerShell as Administrator):**
```powershell
winget install -e --id Microsoft.AzureCLI
```
**Mac:**
```bash
brew install azure-cli
```
**Linux:**
```bash
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
```

Verify it installed:
```bash
az --version
```

### Step 1.3 — Log in
```bash
az login
```
This opens a browser window — log in with the same account you just created. Once done, your terminal is now authenticated to manage Azure resources.

### Step 1.4 — Install Terraform
**Windows:** `winget install Hashicorp.Terraform`
**Mac:** `brew install terraform`
**Linux:**
```bash
sudo apt update && sudo apt install -y gnupg software-properties-common
wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform
```
Verify: `terraform -version`

### Step 1.5 — Install Ansible
**Mac/Linux:**
```bash
pip install ansible
```
**Windows:** Ansible doesn't run natively on Windows — install **WSL2** (Windows Subsystem for Linux) first, then run the Linux command inside it. This is normal; most DevOps tooling assumes a Linux/Mac shell.

### Step 1.6 — Install Docker Desktop
Download from https://www.docker.com/products/docker-desktop — needed for Phase 1 (building/running containers locally) and Phase 5 (Minikube uses it too).

### Step 1.7 — Generate an SSH key (if you don't have one)
This is how you'll securely log into your Azure VM without a password.
```bash
ssh-keygen -t rsa -b 4096
```
Press Enter through the prompts to accept defaults. This creates `~/.ssh/id_rsa` (private, never share) and `~/.ssh/id_rsa.pub` (public, safe to share — Terraform uses this one).

---

## Part 2: Get the App Running Locally

**Why first:** never provision cloud infrastructure for code you haven't proven works. Always go local → container → cloud.

```bash
cd app
npm install
```
Start MongoDB in a container (simplest option for a beginner — no local install needed):
```bash
docker run -d -p 27017:27017 --name mongo mongo:7
```
Start the app:
```bash
MONGO_URI=mongodb://localhost:27017/urlshortener node server.js
```
Open `http://localhost:3000` in your browser. Shorten a URL. If it works, you've validated the app itself — everything from here is *operations*, not coding.

Run the test file (this is what CI will run automatically later):
```bash
npm test
```

---

## Part 3: Docker — Package the App

**Why:** "works on my machine" is the oldest problem in software. A container guarantees the app runs identically everywhere — your laptop, a teammate's laptop, or a cloud server.

From the project root:
```bash
docker compose up --build
```
This one command reads `docker-compose.yml` and starts **four containers**: your app, MongoDB, Prometheus, and Grafana, all networked together automatically.

Check what's running:
```bash
docker ps
```
Stop everything:
```bash
docker compose down
```

---

## Part 4: CI with GitHub Actions

**Why:** manual testing before every deploy doesn't scale and humans forget steps. CI runs the same checks, identically, on every single push.

1. Create a GitHub repo, then push this project:
```bash
git init
git add .
git commit -m "Initial commit: URL shortener with full DevOps pipeline"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/url-shortener-devops.git
git push -u origin main
```
2. Create a Docker Hub account at hub.docker.com (free), then generate an access token: **Account Settings → Security → New Access Token**.
3. In your GitHub repo: **Settings → Secrets and variables → Actions → New repository secret**. Add:
   - `DOCKERHUB_USERNAME`
   - `DOCKERHUB_TOKEN`
4. Push any small change to `main`. Go to the **Actions** tab in GitHub and watch the pipeline run: test → build → security scan → push image.

---

## Part 5: Terraform on Azure — Provision the Server

**Why:** clicking through the Azure Portal to create a VM works once — but it's not repeatable, not version-controlled, and not something you can hand to a teammate. Terraform describes your infrastructure as code, so it can be recreated (or destroyed) with one command.

```bash
cd terraform-azure
terraform init
```
`init` downloads the Azure provider plugin — the piece of code that knows how to talk to Azure's API.

```bash
terraform plan
```
`plan` shows you exactly what Terraform *will* create, without creating anything yet — always review this before applying.

```bash
terraform apply
```
Type `yes` when prompted. This takes 2-3 minutes and creates: a resource group, virtual network, public IP, firewall rules, and the VM itself.

Get your server's IP:
```bash
terraform output vm_public_ip
```

**When you're done with the whole project**, tear it down to avoid any charges:
```bash
terraform destroy
```

---

## Part 6: Ansible — Configure the Server & Deploy

**Why:** Terraform built an *empty* server. Ansible installs the software on it and starts your app — without you ever manually SSH-ing in and typing commands by hand (which doesn't scale past one server).

1. Open `ansible/inventory-azure.ini` and replace the placeholder IP with your real one from Terraform's output.
2. Run the playbook:
```bash
cd ansible
ansible-playbook -i inventory-azure.ini playbook.yml --extra-vars "dockerhub_username=YOUR_DOCKERHUB_USERNAME"
```
This connects over SSH, installs Docker, and starts your app + MongoDB containers — read `playbook.yml` top to bottom, every line is a plain-English task name.

3. Visit `http://<vm_public_ip>:3000` — your app is now running on a real cloud server, deployed entirely through code.

---

## Part 7: Kubernetes — Orchestration

**Why:** running one container on one server is fine until that server dies, or you get more traffic than it can handle. Kubernetes runs multiple copies of your app, restarts crashed ones automatically, and scales up under load.

Start local practice with Minikube:
```bash
minikube start
```
Update `k8s/deployment.yaml` — replace `YOUR_DOCKERHUB_USERNAME` with your real Docker Hub username, then:
```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/mongo-pvc.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress-and-hpa.yaml
```
Check it's running:
```bash
kubectl get pods
kubectl get hpa
minikube service url-shortener-service --url
```
Once you're comfortable, the natural next step is **Azure Kubernetes Service (AKS)** — a managed Kubernetes cluster on Azure. That's a good "Phase 2" once this project is solid; it's a bigger jump so don't feel behind if you stop at Minikube for your first pass.

---

## Part 8: Monitoring

Already running from `docker compose up` (Part 3). Open Grafana at `http://localhost:3001` (login `admin`/`admin`):
1. Add a data source: Prometheus, URL `http://prometheus:9090`
2. Create a dashboard panel with the query `http_requests_total` — you'll see real request counts from your own app's `/metrics` endpoint.

**Why this matters to recruiters:** anyone can deploy an app. Fewer beginners show they also *watch* it in production — this is what separates "I can code" from "I can operate."

---

## Part 9: Security

- Your Docker image already runs as a non-root user (check the `Dockerfile`).
- CI already scans every image with Trivy before pushing.
- Next step to try yourself: move `MONGO_URI` out of plain environment variables into **Azure Key Vault**, and reference it as a secret — this is the kind of detail that shows up well in an interview answer.

---

## Part 10: LinkedIn Post Checklist

1. Push everything to GitHub, pin the repo, add topics: `azure`, `docker`, `kubernetes`, `terraform`, `ansible`, `cicd`, `devops`.
2. Record a 60-90 second screen recording: `git push` → GitHub Actions turning green → the live app on your Azure VM → the Grafana dashboard.
3. Post structure:
   - Hook line: *"I built a URL shortener to learn the full DevOps lifecycle on Azure — here's the pipeline 👇"*
   - Attach the architecture diagram (draw one in Excalidraw — a picture gets 10x the engagement of text alone)
   - 4-5 bullets, one line each: what Docker/Terraform/Ansible/Kubernetes/Prometheus did in this project
   - Link to the GitHub repo + your demo video
   - One honest line about what broke and how you debugged it
   - Tags: #devops #azure #docker #kubernetes #terraform

---

## Quick Command Reference

| Task | Command |
|---|---|
| Run app locally | `node server.js` |
| Run tests | `npm test` |
| Build & run all containers | `docker compose up --build` |
| Provision Azure VM | `terraform apply` (inside `terraform-azure/`) |
| Deploy to VM | `ansible-playbook -i inventory-azure.ini playbook.yml` |
| Deploy to Kubernetes | `kubectl apply -f k8s/` |
| Destroy Azure resources | `terraform destroy` |
