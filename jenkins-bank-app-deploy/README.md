# Jenkins deployment infrastructure

This directory provisions an Ubuntu Jenkins controller on a `t2.large` EC2 instance and configures it with Ansible.

## 1. Provision EC2

From `terraform/`, copy and edit the variables file. Use an existing EC2 key pair and restrict `admin_cidr` to your public IP, for example `198.51.100.20/32`.

```bash
cp terraform.tfvars.example terraform.tfvars
terraform init
terraform plan -out=tfplan
terraform apply tfplan
terraform output -raw jenkins_public_ip
```

The instance profile grants the controller ECR access, `sts:GetCallerIdentity`, and permission to describe EKS clusters. Attach additional least-privilege EKS permissions if the pipeline will update a cluster through AWS-authenticated access.

## 2. Configure Jenkins

Copy `ansible/inventory.ini.example` to `ansible/inventory.ini`, replace the host address and SSH key path, then run:

```bash
cd ansible
ansible-galaxy collection install -r requirements.yml
ansible-playbook -i inventory.ini site.yml
```

The playbook installs Java 17, Jenkins, Docker, AWS CLI, Node.js, kubectl, and the Pipeline, Git, Docker, AWS, ECR, SonarQube, Kubernetes, notification, and logging plugins used by the pipeline.

## 3. Jenkins configuration

Create a Pipeline job pointed at the repository and use `Jenkinsfile`. Configure these items in Jenkins:

- Global tool/config name `sonarqube` for the SonarQube server.
- Secret text credential ID `sonar-token`, referenced by the SonarQube stage.
- AWS credentials ID `aws-credentials` if the instance role is not used by the AWS plugin.
- Secret file `kubeconfig-liontech-finance`.
- Secret text credentials `liontech-finance-auth-secret` and `liontech-finance-service-token`.

The pipeline validates Node.js, runs the smoke test, scans with SonarQube, builds and pushes all service images to ECR, then updates the EKS deployments and waits for rollouts.

Do not commit `terraform.tfvars`, private keys, kubeconfigs, or application secrets.
