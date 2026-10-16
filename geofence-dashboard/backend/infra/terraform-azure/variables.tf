variable "prefix" {
  type        = string
  description = "Name prefix for all resources"
  default     = "geofence"
}

variable "location" {
  type        = string
  description = "Azure region"
  default     = "eastus"
}

variable "resource_group_name" {
  type        = string
  description = "Resource group name"
  default     = "geofence-rg"
}

variable "postgres_admin_user" {
  type        = string
  description = "Postgres admin username"
  default     = "pgadmin"
}

variable "postgres_admin_password" {
  type        = string
  description = "Postgres admin password (leave empty to let Terraform generate one)"
  default     = ""
}

variable "postgres_version" {
  type        = string
  default     = "14"
}

variable "postgres_sku" {
  type        = string
  default     = "Standard_D2s_v3"
}

variable "postgres_storage_mb" {
  type    = number
  default = 32768
}

variable "postgres_db_name" {
  type    = string
  default = "geofence"
}

variable "container_image" {
  type        = string
  description = "Container image to deploy (e.g., myrepo/geofence-api:latest)"
  default     = "backend-api:latest"
}

variable "create_signalr" {
  type    = bool
  default = false
}

variable "signalr_sku" {
  type    = string
  default = "Standard_S1"
}

variable "signalr_units" {
  type    = number
  default = 1
}
