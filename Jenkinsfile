// Velox CRM - PRODUCTION backend pipeline (Lightsail container service velox-backend).
// Flow: on every change to main, build + push automatically, then WAIT for a manual
// approval in Jenkins before anything is deployed to production.
// Runtime settings come from the Jenkins "Secret file" credential crm-prod-env (KEY=value lines).
// The frontend is deployed separately by AWS Amplify.

pipeline {
    agent none

    options {
        disableConcurrentBuilds()
    }

    triggers {
        pollSCM('H/5 * * * *')
    }

    environment {
        AWS_REGION     = 'ap-southeast-2'
        // jenkins user's rootless Podman socket (uid 981 on jenkincentos), needed by lightsailctl
        DOCKER_HOST    = 'unix:///run/user/981/podman/podman.sock'
        SERVICE_NAME   = 'velox-backend'
        CONTAINER_NAME = 'velox-backend'
        IMAGE_NAME     = 'velox-backend'
    }

    stages {

        stage('Build') {
            agent any
            environment {
                AWS_ACCESS_KEY_ID     = credentials('velox-aws-access-key-id')
                AWS_SECRET_ACCESS_KEY = credentials('velox-aws-secret-access-key')
            }
            stages {
                stage('Check settings file') {
                    steps {
                        withCredentials([file(credentialsId: 'crm-prod-env', variable: 'ENV_FILE')]) {
                            sh '''
                                set +x
                                ENV_JSON=$(sed 's/\\r$//' "$ENV_FILE" | jq -Rn '[inputs | select(test("^[A-Za-z_][A-Za-z0-9_]*=")) | capture("^(?<key>[A-Za-z_][A-Za-z0-9_]*)=(?<value>.*)$")] | from_entries')
                                echo "Settings file contains $(echo "$ENV_JSON" | jq 'length') variables:"
                                echo "$ENV_JSON" | jq -r 'keys | join(", ")'
                                for k in NODE_ENV DB_HOST DB_NAME DB_USER DB_PASSWORD JWT_SECRET ALLOWED_ORIGINS; do
                                    echo "$ENV_JSON" | jq -e --arg k "$k" '(.[$k] // "") | length > 0' >/dev/null || { echo "MISSING or EMPTY setting: $k"; exit 1; }
                                done
                                echo "NODE_ENV=$(echo "$ENV_JSON" | jq -r .NODE_ENV)  DB_NAME=$(echo "$ENV_JSON" | jq -r .DB_NAME)  ALLOWED_ORIGINS=$(echo "$ENV_JSON" | jq -r .ALLOWED_ORIGINS)"
                            '''
                        }
                    }
                }

                stage('Build image') {
                    steps {
                        sh 'docker build -t ${IMAGE_NAME}:${BUILD_NUMBER} ./backend'
                    }
                }

                stage('Push to Lightsail') {
                    steps {
                        sh '''
                            aws lightsail push-container-image \
                                --region ${AWS_REGION} \
                                --service-name ${SERVICE_NAME} \
                                --label ${IMAGE_NAME} \
                                --image ${IMAGE_NAME}:${BUILD_NUMBER} | tee push.log
                            grep -o 'Refer to this image as "[^"]*"' push.log | sed -E 's/.*"(.*)"/\\1/' > .image_ref
                            test -s .image_ref || { echo "Could not read the pushed image name"; exit 1; }
                            echo "Pushed image: $(cat .image_ref)"
                        '''
                        stash name: 'image-ref', includes: '.image_ref'
                    }
                }
            }
        }

        stage('Approve production deploy') {
            agent none
            steps {
                // Waits without holding a Jenkins worker. No approval within 24h = aborted, nothing deployed.
                timeout(time: 24, unit: 'HOURS') {
                    input message: 'Deploy this build to CRM PRODUCTION (api-crm.veloxverse.com)?',
                          ok: 'Deploy to production'
                }
            }
        }

        stage('Production') {
            agent any
            environment {
                AWS_ACCESS_KEY_ID     = credentials('velox-aws-access-key-id')
                AWS_SECRET_ACCESS_KEY = credentials('velox-aws-secret-access-key')
            }
            stages {
                stage('Deploy') {
                    steps {
                        unstash 'image-ref'
                        withCredentials([file(credentialsId: 'crm-prod-env', variable: 'ENV_FILE')]) {
                            sh '''
                                set +x
                                umask 077
                                trap 'rm -f containers.json' EXIT

                                IMAGE=$(cat .image_ref)
                                echo "Deploying image: $IMAGE"

                                ENV_JSON=$(sed 's/\\r$//' "$ENV_FILE" | jq -Rn '[inputs | select(test("^[A-Za-z_][A-Za-z0-9_]*=")) | capture("^(?<key>[A-Za-z_][A-Za-z0-9_]*)=(?<value>.*)$")] | from_entries')

                                jq -n --arg name "$CONTAINER_NAME" --arg image "$IMAGE" --argjson env "$ENV_JSON" \
                                    '{($name): {image: $image, ports: {"5002": "HTTP"}, environment: $env}}' > containers.json

                                ENDPOINT_JSON=$(jq -n --arg name "$CONTAINER_NAME" \
                                    '{containerName: $name, containerPort: 5002, healthCheck: {path: "/health"}}')

                                aws lightsail create-container-service-deployment \
                                    --region "$AWS_REGION" \
                                    --service-name "$SERVICE_NAME" \
                                    --containers file://containers.json \
                                    --public-endpoint "$ENDPOINT_JSON" \
                                    --query "containerService.nextDeployment.version" --output text > .deploy_version

                                echo "Created deployment version $(cat .deploy_version)"
                            '''
                        }
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
                        withCredentials([file(credentialsId: 'crm-prod-env', variable: 'ENV_FILE')]) {
                            sh '''
                                set +x
                                BACKEND_URL=$(aws lightsail get-container-services \
                                    --region "$AWS_REGION" --service-name "$SERVICE_NAME" \
                                    --query "containerServices[0].url" --output text)
                                ORIGIN=$(sed 's/\\r$//' "$ENV_FILE" | grep -m1 '^ALLOWED_ORIGINS=' | cut -d= -f2- | cut -d, -f1)

                                echo "Health check: ${BACKEND_URL}health"
                                curl -fsS --max-time 15 "${BACKEND_URL}health"
                                echo

                                CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 -X OPTIONS \
                                    "${BACKEND_URL}api/auth/login" \
                                    -H "Origin: ${ORIGIN}" \
                                    -H "Access-Control-Request-Method: POST")
                                echo "CORS preflight from ${ORIGIN} returned HTTP $CODE"
                                if [ "$CODE" != "204" ] && [ "$CODE" != "200" ]; then
                                    echo "CORS preflight failed - check ALLOWED_ORIGINS in crm-prod-env."
                                    exit 1
                                fi
                            '''
                        }
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'Approved and deployed: CRM production is ACTIVE, healthy, and CORS verified.'
        }
        aborted {
            echo 'Not approved (aborted or timed out after 24h) - nothing was deployed to production.'
        }
        failure {
            echo 'Pipeline failed - check the failing stage. If it failed at Verify/Smoke test, Lightsail keeps the previous version serving.'
        }
    }
}
