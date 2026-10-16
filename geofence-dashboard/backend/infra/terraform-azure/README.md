Azure Terraform manifest for GeoFence API

This folder contains a minimal Terraform configuration to provision an Azure Resource Group, a managed PostgreSQL Flexible Server, a Linux App Service hosting a container, and an optional Azure SignalR Service.

Prerequisites
- Azure CLI installed and logged in: `az login`
- Terraform v1.0+
- An image of the API pushed to a registry accessible from Azure (Docker Hub or ACR). Set `container_image` to the full image path.

Quick start

1. Configure variables in a `terraform.tfvars` file or pass them via `-var` arguments. Example `terraform.tfvars`:

```
resource_group_name = "geofence-rg"
location = "eastus"
postgres_admin_password = "<strong-password>"
container_image = "myrepo/geofence-api:latest"
create_signalr = false
```

2. Initialize, plan and apply:

```bash
terraform init
terraform plan -out plan.tfplan
terraform apply plan.tfplan
```

Notes
- If `postgres_admin_password` is left blank, Terraform will generate a strong random password and expose it via the `postgres_connection_string` output (sensitive).
- For production use, consider pushing the container to Azure Container Registry and enabling secure networking for the Postgres instance.
- This manifest is intentionally minimal — review and harden settings (networking, backups, TLS, private endpoints) before production.
