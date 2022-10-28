#!/usr/bin/python

import os
import subprocess
from AWSIoTPythonSDK.MQTTLib import AWSIoTMQTTShadowClient
import json


# Setup the environment
os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'
os.environ['AWS_ACCESS_KEY_ID'] = '<YOUR_KEY_ID>'
os.environ['AWS_SECRET_ACCESS_KEY'] = '<YOUR_KEY>'
os.environ['AWS_SESSION_TOKEN'] = '<YOUR_TOKEN>'
os.environ['GST_PLUGIN_PATH'] = '~/project/amazon-kinesis-video-streams-producer-sdk-cpp/build'

# Setup our MQTT client and security certificates
# Make sure your certificate names match what you downloaded from AWS IoT

# Note: We are using the Shadow Client
mqttc = AWSIoTMQTTShadowClient("enzhi_camera_stream")

# Make sure you use the correct region!
mqttc.configureEndpoint(
    "<YOUR_ENDPOINT>", 8883)
mqttc.configureCredentials(
    "./AmazonRootCA1.pem", "./private.pem.key", "./certificate.pem.crt")

shadowClient = mqttc.createShadowHandlerWithName("enzhi_camera_stream", True)

# Function to encode a payload into JSON

def json_encode(string):
    return json.dumps(string)


mqttc.json_encode = json_encode
shadowClient.json_encode = json_encode

def on_message(message, response, token):
    print(message)
    delta = json.loads(message)
    if 'switch' in delta['state'] and delta['state']['switch'] == 1:
        # print(os.getenv('GST_PLUGIN_PATH'))
        width = 100 #1280 640
        height = 100 #720 480
        if 'width' in delta['state']:
            width = delta['state']['width']
        if 'height' in delta['state']:
            height = delta['state']['height']
        strcmd = 'gst-launch-1.0 autovideosrc ! videoconvert ! video/x-raw,format=I420,width=' + str(width) + ',height=' + str(height) + ',framerate=30/1 ! vtenc_h264_hw allow-frame-reordering=FALSE realtime=TRUE max-keyframe-interval=45 bitrate=500 ! h264parse ! video/x-h264,stream-format=avc,alignment=au,profile=baseline ! kvssink stream-name=enzhi_camera_stream storage-size=128'
        print('###'+ strcmd)
        subprocess.run(strcmd, shell=True)
        

mqttc.on_message = on_message
shadowClient.on_message = on_message

mqttc.connect()
print("Connected")
shadowClient.shadowRegisterDeltaCallback(on_message)
print("Listening for Delta Messages")

# Loop forever
while True:
    pass
