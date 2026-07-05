output "vm_public_ip" {
  description = "Public IP address of the deployed VM"
  value       = azurerm_public_ip.public_ip.ip_address
}

output "ssh_command" {
  description = "Command to SSH into the VM"
  value       = "ssh azureuser@${azurerm_public_ip.public_ip.ip_address}"
}
