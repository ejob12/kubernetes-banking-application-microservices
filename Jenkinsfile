pipeline {
  agent any

  options {
    ansiColor('xterm')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    disableConcurrentBuilds()
    timestamps()
  }

  environment {
    APP_NAME = 'liontech-finance'
    KUBE_NAMESPACE = 'liontech-finance'
    DOCKERHUB_NAMESPACE = 'ejob12'
    IMAGE_TAG = ''
    K8S_MANIFEST = 'k8s/liontech-finance.yaml'
    PROJECT_DIR = ''
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
          env.PROJECT_DIR = fileExists('liontech-finance/docker-compose.yml') ? 'liontech-finance' : '.'
          def shortCommit = sh(returnStdout: true, script: 'git rev-parse --short=7 HEAD').trim()
          env.IMAGE_TAG = "${env.BUILD_NUMBER}-${shortCommit}"
        }
        echo "Building ${env.APP_NAME} from ${env.PROJECT_DIR} with image tag ${env.IMAGE_TAG}"
      }
    }

    stage('Validate') {
      steps {
        dir(env.PROJECT_DIR) {
          sh '''
            set -eu
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
          '''
        }
      }
    }

    stage('Build Images') {
      steps {
        dir(env.PROJECT_DIR) {
          sh '''
            set -eu
            docker build -f frontend/Dockerfile -t docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-frontend:$IMAGE_TAG .
            docker build -f gateway/Dockerfile -t docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-gateway:$IMAGE_TAG .
            docker build -f services/auth/Dockerfile -t docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-auth:$IMAGE_TAG .
            docker build -f services/profile/Dockerfile -t docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-profile:$IMAGE_TAG .
            docker build -f services/accounts/Dockerfile -t docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-accounts:$IMAGE_TAG .
            docker build -f services/balancer/Dockerfile -t docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-balancer:$IMAGE_TAG .
            docker build -f services/notifications/Dockerfile -t docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-notifications:$IMAGE_TAG .
            docker build -f services/deposits/Dockerfile -t docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-deposits:$IMAGE_TAG .
            docker build -f services/transfers/Dockerfile -t docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-transfers:$IMAGE_TAG .
            docker build -f services/analytics/Dockerfile -t docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-analytics:$IMAGE_TAG .
            docker build -f services/ai/Dockerfile -t docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-ai:$IMAGE_TAG .
            docker build -f services/admin/Dockerfile -t docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-admin:$IMAGE_TAG .
          '''
        }
      }
    }

    stage('Tag Latest') {
      steps {
        dir(env.PROJECT_DIR) {
          sh '''
            set -eu
            for image in frontend gateway auth profile accounts balancer notifications deposits transfers analytics ai admin; do
              docker tag docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-$image:$IMAGE_TAG docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-$image:latest
            done
          '''
        }
      }
    }

    stage('Push Images') {
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_TOKEN')]) {
          dir(env.PROJECT_DIR) {
            sh '''
              set -eu
              echo "$DOCKERHUB_TOKEN" | docker login docker.io -u "$DOCKERHUB_USER" --password-stdin
              for image in frontend gateway auth profile accounts balancer notifications deposits transfers analytics ai admin; do
                docker push docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-$image:$IMAGE_TAG
                docker push docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-$image:latest
              done
              docker logout docker.io
            '''
          }
        }
      }
    }

    stage('Deploy To Kubernetes') {
      steps {
        withCredentials([
          file(credentialsId: 'kubeconfig-liontech-finance', variable: 'KUBECONFIG'),
          string(credentialsId: 'liontech-finance-auth-secret', variable: 'AUTH_SECRET'),
          string(credentialsId: 'liontech-finance-service-token', variable: 'SERVICE_TOKEN')
        ]) {
          dir(env.PROJECT_DIR) {
            sh '''
              set -eu

              kubectl get namespace "$KUBE_NAMESPACE" >/dev/null 2>&1 || kubectl create namespace "$KUBE_NAMESPACE"

              kubectl apply -f "$K8S_MANIFEST"

              kubectl -n "$KUBE_NAMESPACE" create secret generic liontech-finance-secrets \
                --from-literal=AUTH_SECRET="$AUTH_SECRET" \
                --from-literal=SERVICE_TOKEN="$SERVICE_TOKEN" \
                --dry-run=client -o yaml | kubectl apply -f -

              kubectl -n "$KUBE_NAMESPACE" set image deployment/frontend \
                frontend=docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-frontend:$IMAGE_TAG
              kubectl -n "$KUBE_NAMESPACE" set image deployment/api-gateway \
                api-gateway=docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-gateway:$IMAGE_TAG
              kubectl -n "$KUBE_NAMESPACE" set image deployment/auth-service \
                auth-service=docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-auth:$IMAGE_TAG
              kubectl -n "$KUBE_NAMESPACE" set image deployment/profile-service \
                profile-service=docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-profile:$IMAGE_TAG
              kubectl -n "$KUBE_NAMESPACE" set image deployment/accounts-service \
                accounts-service=docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-accounts:$IMAGE_TAG
              kubectl -n "$KUBE_NAMESPACE" set image deployment/balancer-service \
                balancer-service=docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-balancer:$IMAGE_TAG
              kubectl -n "$KUBE_NAMESPACE" set image deployment/notifications-service \
                notifications-service=docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-notifications:$IMAGE_TAG
              kubectl -n "$KUBE_NAMESPACE" set image deployment/deposits-service \
                deposits-service=docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-deposits:$IMAGE_TAG
              kubectl -n "$KUBE_NAMESPACE" set image deployment/transfers-service \
                transfers-service=docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-transfers:$IMAGE_TAG
              kubectl -n "$KUBE_NAMESPACE" set image deployment/analytics-service \
                analytics-service=docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-analytics:$IMAGE_TAG
              kubectl -n "$KUBE_NAMESPACE" set image deployment/ai-service \
                ai-service=docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-ai:$IMAGE_TAG
              kubectl -n "$KUBE_NAMESPACE" set image deployment/admin-service \
                admin-service=docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-admin:$IMAGE_TAG

              kubectl -n "$KUBE_NAMESPACE" rollout status deployment/frontend --timeout=180s
              kubectl -n "$KUBE_NAMESPACE" rollout status deployment/api-gateway --timeout=180s
              kubectl -n "$KUBE_NAMESPACE" rollout status deployment/auth-service --timeout=180s
              kubectl -n "$KUBE_NAMESPACE" rollout status deployment/profile-service --timeout=180s
              kubectl -n "$KUBE_NAMESPACE" rollout status deployment/accounts-service --timeout=180s
              kubectl -n "$KUBE_NAMESPACE" rollout status deployment/balancer-service --timeout=180s
              kubectl -n "$KUBE_NAMESPACE" rollout status deployment/notifications-service --timeout=180s
              kubectl -n "$KUBE_NAMESPACE" rollout status deployment/deposits-service --timeout=180s
              kubectl -n "$KUBE_NAMESPACE" rollout status deployment/transfers-service --timeout=180s
              kubectl -n "$KUBE_NAMESPACE" rollout status deployment/analytics-service --timeout=180s
              kubectl -n "$KUBE_NAMESPACE" rollout status deployment/ai-service --timeout=180s
              kubectl -n "$KUBE_NAMESPACE" rollout status deployment/admin-service --timeout=180s

              kubectl -n "$KUBE_NAMESPACE" get svc
            '''
          }
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
      sh 'docker logout docker.io >/dev/null 2>&1 || true'
    }
  }
}
