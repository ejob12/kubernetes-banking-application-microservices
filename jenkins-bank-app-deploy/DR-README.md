# Disaster Recovery and Availability for the Banking Application Platform

This deployment includes:

- Jenkins EC2 controller
- SonarQube EC2 server
- Amazon ECR repository
- EKS cluster in us-east-1
- Terraform remote state in S3

## 1. Disaster Recovery Mechanism

### A. Remote Terraform state protection

Terraform state is stored in an S3 bucket with the following backend configuration:

- Bucket: `2026-state-ejob`
- Region: `us-east-1`
- State key: `jenkins-bank-app/.../terraform.tfstate`
- Encryption: enabled
- Locking: DynamoDB table `terraform-locks`

This protects the infrastructure definition and prevents concurrent state writes. If the workspace or local state is lost, operators can rebuild infrastructure from the S3 remote state.

### B. Jenkins disaster recovery

The Jenkins controller is a single EC2 instance, so it should be protected with the following operational measures:

- Use an EC2 AMI backup or EBS snapshot of the Jenkins root volume.
- Back up `/var/lib/jenkins` regularly to a secure artifact store (S3 or another bucket).
- Store Jenkins credentials and job configuration as code or export pipeline configuration.
- Keep the Jenkins private key and SSH configuration outside the repository.
- If the instance fails, rebuild from the latest AMI and restore the Jenkins home directory.

### C. SonarQube disaster recovery

SonarQube is deployed as a Docker container with persistent data directories under `/opt/sonarqube`.

- Snapshot the EBS volume backing that path.
- Use a backup job to archive `/opt/sonarqube/data`, `/opt/sonarqube/logs`, and `/opt/sonarqube/extensions`.
- If the instance fails, recreate the container and restore the backed-up data directories.
- Store the SonarQube admin credentials and project configuration outside git.

### D. ECR disaster recovery

Amazon ECR is a managed registry and is highly available within a region. For stronger resilience, use:

- Image lifecycle policies to keep only required tags.
- Cross-region replication for the registry if a regional outage occurs.
- A backup of deployment manifests and image tags in the repository or CI/CD pipeline.

### E. EKS disaster recovery

The EKS cluster is managed via Terraform and the node group uses autoscaling. Recovery should include:

- Keep the cluster definition in version control and remote state in S3.
- Back up Kubernetes manifests, Helm releases, and workloads in source control.
- Save kubeconfig files to a secure secret store.
- Rebuild the cluster from Terraform in a secondary region if a full regional failure occurs.
- Reapply deployments and secrets after the failed cluster is recreated.

### F. Regional failover recommendation

For true disaster recovery, the recommended design is a secondary AWS region (for example, `us-west-2`) with:

- Same EKS cluster configuration
- Replicated ECR images
- Replicated Terraform state and backups
- Route53 or a load balancer failover policy
- Automated redeploy pipelines

This gives a better recovery time objective (RTO) and recovery point objective (RPO) than a single-region architecture.

## 2. Availability and Scaling Assessment

### What this architecture does well

This architecture improves resilience in several ways:

- EKS node groups are created in private subnets and can scale within the cluster.
- The EKS cluster is multi-AZ by design through the public and private subnets.
- ECR is a managed service with strong regional durability.
- Terraform state is stored remotely and protected with encryption and locking.
- Jenkins and SonarQube are provisioned with EC2 instances using SSH access and security groups.

### What it does not fully guarantee

This architecture does not by itself guarantee full application availability and horizontal scaling for the deployed application.

It is not a complete production high-availability design because:

- There is no Application Load Balancer or Ingress controller in front of the application services.
- There is no multi-AZ or multi-region deployment pattern for the application workloads themselves.
- There is no Horizontal Pod Autoscaler or workload autoscaling policy configured yet.
- Jenkins and SonarQube are still single-instance services unless additional redundancy is added.
- The application services must be built to be stateless, scale horizontally, and persist data externally.

### Production recommendation

To ensure real availability and scaling, add the following:

- AWS ALB or NGINX Ingress in front of the application
- Horizontal Pod Autoscaler (HPA) for deployment workloads
- Multi-AZ EKS node groups and load-balanced services
- Route53 health checks and failover for external DNS
- Managed database services with multi-AZ replication
- CloudWatch alarms and auto-recovery monitoring
- S3 or artifact backup for build outputs and runtime data

## 3. Conclusion

This architecture provides a solid starting point for a resilient CI/CD pipeline and Kubernetes deployment, and it includes a good base for disaster recovery. However, the application itself will only achieve strong availability and scaling when it is designed as a stateless, horizontally scalable service behind a load balancer, with backups, health checks, and multi-AZ or multi-region failover in place.

In other words, the architecture improves resilience and operability, but it is not full high availability by default.
