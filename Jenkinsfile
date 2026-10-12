// Velox CRM - Backend-only deploy pipeline
// Frontend is deployed separately via AWS Amplify (auto-builds from GitHub,
// not part of this pipeline).

 pipeline {
    agent any

    options {
        disableConcurrentBuilds()
    }

    triggers {
        pollSCM('H/5 * * * *')
     }

    environment {
        AWS_REGION             = 'ap-southeast-2'
        AWS_ACCESS_KEY_ID      = credentials('velox-aws-access-key-id')
        AWS_SECRET_ACCESS_KEY  = credentials('velox-aws-secret-access-key')
        DB_HOST          = 'ls-2dd41a1d0820b89a3ea559736accf25baf844b65.c9iim4oycvbv.ap-southeast-2.rds.amazonaws.com'
        DB_USER          = 'veloxverseDB'
        DB_NAME          = 'crm-veloxverseDB'
        DB_PASSWORD      = credentials('velox-db-password')
        JWT_SECRET       = credentials('velox-jwt-secret')
        // Must exactly match the Amplify frontend origin (no trailing slash).
        FRONTEND_URL     = 'https://main.d1912mnxcrupni.amplifyapp.com'
        // lightsailctl needs a Docker-compatible socket; use the jenkins
        // user's rootless Podman socket (uid 981 on jenkincentos).
        DOCKER_HOST      = 'unix:///run/user/981/podman/podman.sock'
        SERVICE_NAME     = 'velox-backend'
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build backend image') {
            steps {
                sh 'docker build -t velox-backend:${BUILD_NUMBER} ./backend'
            }
        }

        stage('Push backend to Lightsail') {
            steps {
                sh '''
                    aws lightsail push-container-image \
                        --region ${AWS_REGION} \
                        --service-name ${SERVICE_NAME} \
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
                        --service-name ${SERVICE_NAME} \
                        --query "containerImages[0].image" --output text)

                    echo "Deploying backend image: $BACKEND_IMAGE"

                    # jq keeps secrets out of raw shell interpolation.
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
                        --service-name ${SERVICE_NAME} \
                        --containers "$CONTAINERS_JSON" \
                        --public-endpoint '{"containerName":"velox-backend","containerPort":5002,"healthCheck":{"path":"/health"}}' \
                        --query "containerService.nextDeployment.version" --output text > .deploy_version

                    echo "Created deployment version $(cat .deploy_version)"
                '''
            }
        }

        stage('Verify deployment') {
            steps {
                timeout(time: 15, unit: 'MINUTES') {
                    sh '''
                        NEW_VERSION=$(cat .deploy_version)
                        echo "Waiting for deployment v$NEW_VERSION to become ACTIVE..."
                        while true; do
                            STATUS=$(aws lightsail get-container-services \
                                --region ${AWS_REGION} \
                                --service-name ${SERVICE_NAME} \
                                --query "containerServices[0].[currentDeployment.version, currentDeployment.state, nextDeployment.state]" \
                                --output text)
                            CUR_VER=$(echo "$STATUS" | awk '{print $1}')
                            CUR_STATE=$(echo "$STATUS" | awk '{print $2}')
                            NEXT_STATE=$(echo "$STATUS" | awk '{print $3}')
                            echo "current=v$CUR_VER ($CUR_STATE), next=$NEXT_STATE"

                            if [ "$CUR_VER" = "$NEW_VERSION" ] && [ "$CUR_STATE" = "ACTIVE" ]; then
                                echo "Deployment v$NEW_VERSION is ACTIVE."
                                break
                            fi
                            if [ "$NEXT_STATE" = "FAILED" ]; then
                                echo "Deployment v$NEW_VERSION FAILED - previous version is still serving. Check Lightsail logs."
                                exit 1
                            fi
                            if [ "$NEXT_STATE" = "None" ] && [ "$CUR_VER" != "$NEW_VERSION" ]; then
                                echo "Deployment v$NEW_VERSION was cancelled by Lightsail - previous version is still serving. Check Lightsail logs."
                                exit 1
                            fi
                            sleep 20
                        done
                    '''
                }
            }
        }

        stage('Smoke test') {
            steps {
                sh '''
                    BACKEND_URL=$(aws lightsail get-container-services \
                        --region ${AWS_REGION} \
                        --service-name ${SERVICE_NAME} \
                        --query "containerServices[0].url" --output text)

                    echo "Health check: ${BACKEND_URL}health"
                    curl -fsS --max-time 15 "${BACKEND_URL}health"
                    echo

                    CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 -X OPTIONS \
                        "${BACKEND_URL}api/auth/login" \
                        -H "Origin: ${FRONTEND_URL}" \
                        -H "Access-Control-Request-Method: POST")
                    echo "CORS preflight from ${FRONTEND_URL} returned HTTP $CODE"
                    if [ "$CODE" != "204" ] && [ "$CODE" != "200" ]; then
                        echo "CORS preflight failed - ALLOWED_ORIGINS does not match the frontend."
                        exit 1
                    fi
                '''
            }
        }
    }

    post {
        success {
            echo 'Backend deployed, ACTIVE, healthy, and CORS verified.'
        }
        failure {
            echo 'Pipeline failed -- check the failing stage above. If it failed at Verify/Smoke test, Lightsail keeps the previous version serving.'
        }
    }
}
