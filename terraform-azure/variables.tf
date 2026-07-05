variable "location" {
  description = "Azure region to deploy into"
  type        = string
  default     = "East US"
}

variable "ssh_public_key_path" {
  description = "Path to your SSH public key (used to log into the VM)"
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}
