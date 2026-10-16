output "web_app_default_hostname" {
  value = azurerm_linux_web_app.app.default_site_hostname
}

output "postgres_fqdn" {
  value = azurerm_postgresql_flexible_server.pg.fqdn
}

output "postgres_connection_string" {
  value = "Host=${azurerm_postgresql_flexible_server.pg.fqdn};Port=5432;Database=${var.postgres_db_name};Username=${var.postgres_admin_user};Password=${length(trim(var.postgres_admin_password)) > 0 ? var.postgres_admin_password : random_password.pg_admin.result}"
  sensitive = true
}

output "signalr_endpoint" {
  value = azurerm_signalr_service.signalr[0].endpoint
  condition = var.create_signalr
}
