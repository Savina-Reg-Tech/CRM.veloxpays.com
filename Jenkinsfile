// Velox CRM — Backend-only deploy pipeline
// Frontend is deployed separately via AWS Amplify (auto-builds from GitHub,
// not part of this pipeline). See SKILL.md section 10 for Amplify setup.

pipeline {
    agent any

    environment {
        AWS_REGION             = 'ap-southeast-2'
        AWS_ACCESS_KEY_ID      = credentials('aws-access-key-id')
        AWS_SECRET_ACCESS_KEY  = credentials('aws-secret-access-key')
        DB_HOST          = 'ls-2dd41a1d0820b89a3ea559736accf25baf844b65.c9iim4oycvbv.ap-southeast-2.rds.amazonaws.com'
        DB_USER          = 'veloxverseDB'
        DB_NAME          = 'crm-veloxverseDB'
        DB_PASSWORD      = credentials('db-password')
        JWT_SECRET       = credentials('jwt-secret')
        // Must match the Amplify app's real domain once it's live.
        FRONTEND_URL     = 'https://velox-frontend.0w5cqv649rpjg.ap-southeast-2.cs.amazonlightsail.com'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build backend image') {
            steps {
                // On this server "docker" is Podman's emulation shim --
                // works the same for build/push purposes.
                sh 'docker build -t velox-backend:${BUILD_NUMBER} ./backend'
            }
        }

        stage('Push backend to Lightsail') {
            steps {
                sh '''
                    aws lightsail push-container-image \
                        --region ${AWS_REGION} \
                        --service-name velox-backend \
                        --label velox-backend \
                        --image velox-backend:${BUILD_NUMBER}
                '''
            }
        }

        stage('Deploy backend') {
            steps {
                sh '''
                    BACKEND_IMAGE=$(aws lightsail get-container-images \
                        --region ${AWS_REGION} \
                        --service-name velox-backend \
                        --query "containerImages[0].image" --output text)

                    echo "Deploying backend image: $BACKEND_IMAGE"

                    # jq keeps secrets out of raw shell interpolation -- DB_PASSWORD
                    # has shell-special characters that break direct string building.
                    CONTAINERS_JSON=$(jq -n \
                        --arg image "$BACKEND_IMAGE" \
                        --arg dbhost "$DB_HOST" \
                        --arg dbuser "$DB_USER" \
                        --arg dbpass "$DB_PASSWORD" \
                        --arg dbname "$DB_NAME" \
                        --arg origins "$FRONTEND_URL" \
                        --arg jwt "$JWT_SECRET" \
                        '{
                          "velox-backend": {
                            image: $image,
                            ports: { "5002": "HTTP" },
                            environment: {
                              DB_HOST: $dbhost,
                              DB_PORT: "5432",
                              DB_USER: $dbuser,
                              DB_PASSWORD: $dbpass,
                              DB_NAME: $dbname,
                              NODE_ENV: "production",
                              ALLOWED_ORIGINS: $origins,
                              JWT_SECRET: $jwt,
                              JWT_EXPIRES_IN: "7d"
                            }
                          }
                        }')

                    aws lightsail create-container-service-deployment \
                        --region ${AWS_REGION} \
                        --service-name velox-backend \
                        --containers "$CONTAINERS_JSON" \
                        --public-endpoint '{"containerName":"velox-backend","containerPort":5002,"healthCheck":{"path":"/health"}}'
                '''
            }
        }
    }

    post {
        success {
            echo 'Backend deployed to Lightsail successfully.'
        }
        failure {
            echo 'Deployment failed -- check the stage logs above for the failing step.'
        }
    }
}
