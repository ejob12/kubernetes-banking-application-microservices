pipeline {
  agent any

  options {
    ansiColor('xterm')
    buildDiscarder(logRotator(numToKeepStr: '20'))
    disableConcurrentBuilds()
    timestamps()
  }

  tools {
    git 'Default'   // ✅ Explicitly tell Jenkins to use the configured Git tool
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
          // ✅ Ensure IMAGE_TAG is set correctly
          env.IMAGE_TAG = "${env.BUILD_NUMBER}-${shortCommit}"
        }
        echo "Building ${env.APP_NAME} from ${env.PROJECT_DIR} with image tag ${env.IMAGE_TAG}"
      }
    }

    stage('Docker Login') {
      steps {
        // ✅ Added explicit DockerHub login stage before building images
        withCredentials([usernamePassword(credentialsId: 'dockerhub-credentials', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_TOKEN')]) {
          sh '''
            echo "$DOCKERHUB_TOKEN" | docker login docker.io -u "$DOCKERHUB_USER" --password-stdin
          '''
        }
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
        dir(env.PROJECT_DIR) {
          sh '''
            set -eu
            for image in frontend gateway auth profile accounts balancer notifications deposits transfers analytics ai admin; do
              docker push docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-$image:$IMAGE_TAG
              docker push docker.io/$DOCKERHUB_NAMESPACE/liontech-finance-$image:latest
            done
          '''
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

              for svc in frontend api-gateway auth-service profile-service accounts-service balancer-service notifications-service deposits-service transfers-service analytics-service ai-service admin-service; do
                kubectl -n "$KUBE_NAMESPACE" rollout status deployment/$svc --timeout=180s
              done

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
