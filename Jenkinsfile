pipeline {
  agent any

  options {
    ansiColor('xterm')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    disableConcurrentBuilds()
    timestamps()
  }

  environment {
    AWS_REGION = 'us-east-1'
    ECR_REGISTRY = ''
    IMAGE_TAG = ''
    SONARQUBE_SERVER = 'sonarqube'
    KUBE_NAMESPACE = 'liontech-finance'
    K8S_MANIFEST = 'k8s/liontech-finance.yaml'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Prepare') {
      steps {
        script {
          def shortCommit = sh(returnStdout: true, script: 'git rev-parse --short=7 HEAD').trim()
          env.IMAGE_TAG = "${env.BUILD_NUMBER}-${shortCommit}"
          env.AWS_ACCOUNT_ID = sh(
            returnStdout: true,
            script: "aws sts get-caller-identity --query Account --output text"
          ).trim()
          env.ECR_REGISTRY = "${env.AWS_ACCOUNT_ID}.dkr.ecr.${env.AWS_REGION}.amazonaws.com"
        }
        echo "Building LionTech Finance with image tag ${env.IMAGE_TAG}"
      }
    }

    stage('Validate Build') {
      steps {
        sh '''
            set -eu
            node --version
            docker --version
            aws --version
            node --check shared/src/auth.js
            node --check shared/src/http.js
            node --check shared/src/server.js
            node --check shared/src/store.js
            node --check gateway/src/index.js
            node --check services/auth/src/index.js
            node --check services/profile/src/index.js
            node --check services/accounts/src/index.js
            node --check services/balancer/src/index.js
            node --check services/notifications/src/index.js
            node --check services/deposits/src/index.js
            node --check services/transfers/src/index.js
            node --check services/analytics/src/index.js
            node --check services/ai/src/index.js
            node --check services/admin/src/index.js
            node scripts/smoke-test.js
          '''
      }
    }

    stage('SonarQube Analysis') {
      steps {
        withCredentials([string(credentialsId: 'sonar-token', variable: 'SONAR_AUTH_TOKEN')]) {
          withSonarQubeEnv(env.SONARQUBE_SERVER) {
            sh '''
              docker run --rm \
                -e SONAR_HOST_URL="$SONAR_HOST_URL" \
                -e SONAR_TOKEN="$SONAR_AUTH_TOKEN" \
                -v "$WORKSPACE:/usr/src" \
                sonarsource/sonar-scanner-cli:latest \
                -Dsonar.projectKey=liontech-finance \
                -Dsonar.sources=/usr/src \
                -Dsonar.scm.provider=git
            '''
          }
        }
      }
    }

    stage('ECR Login') {
      steps {
        sh '''
            set -eu
            aws ecr get-login-password --region "$AWS_REGION" | docker login \
              --username AWS --password-stdin "$ECR_REGISTRY"
        '''
      }
    }

    stage('Build And Push Images') {
      steps {
        sh '''
            set -eu
            for image in frontend gateway auth profile accounts balancer notifications deposits transfers analytics ai admin; do
              repository="$ECR_REGISTRY/banking-app/$image"
              dockerfile="$image/Dockerfile"
              if [ "$image" != "frontend" ] && [ "$image" != "gateway" ]; then
                dockerfile="services/$image/Dockerfile"
              fi
              aws ecr describe-repositories --repository-name "banking-app/$image" --region "$AWS_REGION" >/dev/null 2>&1 || \
                aws ecr create-repository --repository-name "banking-app/$image" --region "$AWS_REGION" >/dev/null
              docker build -f "$dockerfile" -t "$repository:$IMAGE_TAG" .
              docker tag "$repository:$IMAGE_TAG" "$repository:latest"
              docker push "$repository:$IMAGE_TAG"
              docker push "$repository:latest"
            done
        '''
      }
    }

    stage('Deploy To EKS') {
      steps {
        withCredentials([
          file(credentialsId: 'kubeconfig-liontech-finance', variable: 'KUBECONFIG'),
          string(credentialsId: 'liontech-finance-auth-secret', variable: 'AUTH_SECRET'),
          string(credentialsId: 'liontech-finance-service-token', variable: 'SERVICE_TOKEN')
        ]) {
          sh '''
            set -eu
            kubectl apply -f "$K8S_MANIFEST"
            kubectl -n "$KUBE_NAMESPACE" create secret generic liontech-finance-secrets \
              --from-literal=AUTH_SECRET="$AUTH_SECRET" \
              --from-literal=SERVICE_TOKEN="$SERVICE_TOKEN" \
              --dry-run=client -o yaml | kubectl apply -f -
            for image in frontend gateway auth profile accounts balancer notifications deposits transfers analytics ai admin; do
              case "$image" in
                frontend) deployment=frontend ;;
                gateway) deployment=api-gateway ;;
                *) deployment="$image-service" ;;
              esac
              kubectl -n "$KUBE_NAMESPACE" set image deployment/$deployment \
                "$deployment=$ECR_REGISTRY/banking-app/$image:$IMAGE_TAG"
              kubectl -n "$KUBE_NAMESPACE" rollout status deployment/$deployment --timeout=180s
            done
            kubectl -n "$KUBE_NAMESPACE" get svc
          '''
        }
      }
    }
  }

  post {
    success {
      echo "LionTech Finance deployed with image tag ${env.IMAGE_TAG}"
    }
    failure {
      echo "LionTech Finance pipeline failed. Check the stage logs above."
    }
    always {
      sh 'docker logout "$ECR_REGISTRY" >/dev/null 2>&1 || true'
    }
  }
}
