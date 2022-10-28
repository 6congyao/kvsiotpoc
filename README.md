# kvsiotpoc

# Thingsboard setup using EKS

https://thingsboard.io/docs/user-guide/install/cluster/aws-microservices-setup/

--------------------------------------------------------------------------------

# GStreamer Installation on Mac

## Homebrew install depending libraries

```bash
brew update

brew install pkg-config openssl cmake gstreamer gst-plugins-base gst-plugins-good gst-plugins-bad gst-plugins-ugly log4cplus gst-libav
```

## Git

```bash
git clone --recursive https://github.com/awslabs/amazon-kinesis-video-streams-producer-sdk-cpp.git
```

## VSCode 编辑CMakeLists.txt
> BUILD_GSTREAMER_PLUGIN ON

> BUILD_DEPENDENCIES OFF
```bash
cmake
make
```

## Device monitor
```bash
export GST_PLUGIN_PATH=/opt/homebrew/lib/gstreamer-1.0/

gst-device-monitor-1.0
```

## Setup environment

```bash
export AWS_DEFAULT_REGION="us-east-1"
export AWS_ACCESS_KEY_ID=$(jq --raw-output '.credentials.accessKeyId' token.json)
export AWS_SECRET_ACCESS_KEY=$(jq --raw-output '.credentials.secretAccessKey' token.json)
export AWS_SESSION_TOKEN=$(jq --raw-output '.credentials.sessionToken' token.json)
export GST_PLUGIN_PATH=$HOME/project/amazon-kinesis-video-streams-producer-sdk-cpp/build
export AWS_KVS_AUDIO_DEVICE=51
export AWS_KVS_VIDEO_DEVICE=0
```

```bash
gst-launch-1.0 autovideosrc ! videoconvert ! video/x-raw,format=I420,width=640,height=480,framerate=30/1 ! vtenc_h264_hw allow-frame-reordering=FALSE realtime=TRUE max-keyframe-interval=45 bitrate=500 ! h264parse ! video/x-h264,stream-format=avc,alignment=au,profile=baseline ! kvssink stream-name=enzhi_camera_stream storage-size=128
```

## Play
https://aws-samples.github.io/amazon-kinesis-video-streams-media-viewer/

## Refer: 
https://github.com/awslabs/amazon-kinesis-video-streams-producer-sdk-cpp/blob/master/docs/macos.md

--------------------------------------------------------------------------------

## rekognition stream processor

aws rekognition list-stream-processors

aws rekognition create-stream-processor --region us-east-1 --cli-input-json file://createstreamprocessor.json

aws rekognition delete-stream-processor --region us-east-1 --cli-input-json file://deletestreamprocessor.json

aws rekognition describe-stream-processor --name video_event_stream_processor --region us-east-1

aws rekognition start-stream-processor --region us-east-1 --cli-input-json file://startstreamprocessor.json

aws rekognition stop-stream-processor --region us-east-1 --cli-input-json file://deletestreamprocessor.json

aws rekognition create-collection --collection-id face-ab3-collection
aws rekognition describe-collection --collection-id face-ab3-collection

export BUCKET_NAME="face-for-ab3-871839178153"

for key in $(aws s3 ls s3://$BUCKET_NAME | awk '{print $4}'); do
  name=$(echo $key | sed 's/\.[^\.]*$//')
  echo "index: $key"
  aws rekognition index-faces --collection-id face-ab3-collection \
  --image "S3Object={Bucket=$BUCKET_NAME,Name=$key}" \
  --external-image-id $name \
  --max-faces=1
done

--------------------------------------------------------------------------------
# KVS producer SDK

```bash
aws --profile default  iot create-role-alias --role-alias KvsCameraIoTRoleAlias --role-arn arn:aws:iam::871839178153:role/KVSCameraCertificateBasedIAMRole --credential-duration-seconds 43200 > iot-role-alias.json

aws iot describe-endpoint --endpoint-type iot:CredentialProvider
curl --silent -H "x-amzn-iot-thingname:enzhi_camera_stream" --cert certificate.pem.crt --key private.pem.key https://c2hjvyyuzzkrxm.credentials.iot.us-east-1.amazonaws.com/role-aliases/KvsCameraIoTRoleAlias/credentials --cacert AmazonRootCA1.pem > token.json

AWS_ACCESS_KEY_ID=$(jq --raw-output '.credentials.accessKeyId' token.json) AWS_SECRET_ACCESS_KEY=$(jq --raw-output '.credentials.secretAccessKey' token.json) AWS_SESSION_TOKEN=$(jq --raw-output '.credentials.sessionToken' token.json) aws kinesisvideo describe-stream --stream-name enzhi_camera_stream

export AWS_DEFAULT_REGION="us-east-1"
export AWS_ACCESS_KEY_ID=$(jq --raw-output '.credentials.accessKeyId' token.json)
export AWS_SECRET_ACCESS_KEY=$(jq --raw-output '.credentials.secretAccessKey' token.json)
export AWS_SESSION_TOKEN=$(jq --raw-output '.credentials.sessionToken' token.json)

export GST_PLUGIN_PATH=$HOME/amazon-kinesis-video-streams-producer-sdk-cpp/build
export LD_LIBRARY_PATH=$HOME/amazon-kinesis-video-streams-producer-sdk-cpp/open-source/local/lib

cd ~/amazon-kinesis-video-streams-producer-sdk-cpp/build
while true; do ./kvs_gstreamer_file_uploader_sample enzhi_camera_stream ~/tang.mp4 $(date +%s) audio-video && sleep 10s; done

HLS
aws kinesisvideo get-data-endpoint --stream-name enzhi_camera_stream --api-name GET_HLS_STREAMING_SESSION_URL

export KVS_DATA_ENDPOINT=https://b-a1246f81.kinesisvideo.us-east-1.amazonaws.com

aws kinesis-video-archived-media get-hls-streaming-session-url --endpoint-url $KVS_DATA_ENDPOINT \
--stream-name enzhi_camera_stream \
--playback-mode LIVE
```

--------------------------------------------------------------------------------
# EKS with Fargate

```bash
eksctl create cluster --name ipc-demo-cluster --version 1.22 --fargate
```

```bash
eksctl utils associate-iam-oidc-provider --cluster ipc-demo-cluster --approve
```

```bash
curl -o iam_policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/${LBC_VERSION}/docs/install/iam_policy.json

aws iam create-policy \
    --policy-name AWSLoadBalancerControllerIAMPolicy \
    --policy-document file://iam_policy.json
    
rm iam_policy.json
```

```bash
eksctl create iamserviceaccount \
  --cluster ipc-demo-cluster \
  --namespace kube-system \
  --name aws-load-balancer-controller \
  --attach-policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/AWSLoadBalancerControllerIAMPolicy \
  --override-existing-serviceaccounts \
  --approve
```

```bash
kubectl get serviceaccount aws-load-balancer-controller --namespace kube-system -o yaml
```

```bash
kubectl apply -k "github.com/aws/eks-charts/stable/aws-load-balancer-controller/crds?ref=master"

helm repo add eks https://aws.github.io/eks-charts
```

```bash
export VPC_ID=$(aws eks describe-cluster \
                --name ipc-demo-cluster \
                --query "cluster.resourcesVpcConfig.vpcId" \
                --output text)

helm upgrade -i aws-load-balancer-controller \
    eks/aws-load-balancer-controller \
    -n kube-system \
    --set clusterName=ipc-demo-cluster \
    --set serviceAccount.create=false \
    --set serviceAccount.name=aws-load-balancer-controller \
    --set image.tag="${LBC_VERSION}" \
    --set region=${AWS_REGION} \
    --set vpcId=${VPC_ID} \
    --version="${LBC_CHART_VERSION}"
```

```bash
eksctl get fargateprofile \
  --cluster ipc-demo-cluster \
  -o yaml
```