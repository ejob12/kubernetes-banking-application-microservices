variable "aws_region" {
  description = "AWS region for the Jenkins controller"
  type        = string
  default     = "us-east-1"
}

variable "name" {
  description = "Name prefix for created resources"
  type        = string
  default     = "jenkins-bank-app"
}

variable "key_name" {
  description = "Existing EC2 key pair name used for SSH"
  type        = string
  default     = "19_Oct_2025"
}

variable "ecr_repository_name" {
  description = "Name of the ECR repository used for application images"
  type        = string
  default     = "liontech-finance"
}

variable "sonarqube_instance_type" {
  description = "Instance type for the SonarQube server"
  type        = string
  default     = "t2.medium"
}

variable "admin_cidr" {
  description = "CIDR allowed to reach SSH, Jenkins, and agent ports"
  type        = string
}
