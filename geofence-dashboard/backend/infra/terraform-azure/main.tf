terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

locals {
  postgres_admin_password = length(trim(var.postgres_admin_password)) > 0 ? var.postgres_admin_password : random_password.pg_admin.result
}

resource "random_password" "pg_admin" {
  length           = 20
  override_characters = "@#%&*()-_=+[]{}<>?"
  keepers = {}
}

resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location
}

resource "azurerm_postgresql_flexible_server" "pg" {
  name                = "${var.prefix}-pg"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location

  administrator_login          = var.postgres_admin_user
  administrator_password       = local.postgres_admin_password
  version                      = var.postgres_version

  sku_name = var.postgres_sku
  storage_mb = var.postgres_storage_mb

  backup_retention_days = 7
  geo_redundant_backup_enabled = false
  public_network_access_enabled = true
}

resource "azurerm_app_service_plan" "plan" {
  name                = "${var.prefix}-plan"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name

  kind     = "Linux"
  reserved = true

  sku {
    tier = "Basic"
    size = "B1"
  }
}

resource "azurerm_linux_web_app" "app" {
  name                = "${var.prefix}-app"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  service_plan_id     = azurerm_app_service_plan.plan.id

  site_config {
    linux_fx_version = "DOCKER|${var.container_image}"
  }

  app_settings = {
    "WEBSITES_ENABLE_APP_SERVICE_STORAGE" = "false"
    "ASPNETCORE_ENVIRONMENT" = "Production"
    "ConnectionStrings__GeoFenceDb" = "Host=${azurerm_postgresql_flexible_server.pg.fqdn};Port=5432;Database=${var.postgres_db_name};Username=${var.postgres_admin_user};Password=${local.postgres_admin_password}"
  }
}

resource "azurerm_signalr_service" "signalr" {
  count               = var.create_signalr ? 1 : 0
  name                = "${var.prefix}-signalr"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = var.signalr_sku
  units               = var.signalr_units
}
