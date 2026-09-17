terraform {
  backend "s3" {
    bucket         = "2026-state-ejob"
    key            = "jenkins-bank-app/eks-cluster/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
