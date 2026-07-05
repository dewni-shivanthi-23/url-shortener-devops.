variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "ami_id" {
  description = "AMI ID for Ubuntu 22.04 (varies by region — check the AWS console)"
  type        = string
  default     = "ami-0e2c8caa4b6378d8c" # Ubuntu 22.04 LTS in us-east-1, verify before use
}

variable "key_pair_name" {
  description = "Name of an existing EC2 key pair for SSH access"
  type        = string
}
