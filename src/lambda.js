var AWS = require('aws-sdk');
var sns = new AWS.SNS();

var SNSTopic = process.env.sns;


function jsonKeysToCase(json, type) {
    if (typeof json == 'object') {
        var tempJson = JSON.parse(JSON.stringify(json));
        toCase(tempJson);
        return tempJson;
    } else {
        return json;
    }

    function toCase(json) {
        if (typeof json == 'object') {
            if (Array.isArray(json)) {
                json.forEach(function (item) {
                    toCase(item);
                })
            } else {
                for (var key in json) {
                    var item = json[key
                    ];
                    if (typeof item == 'object') {
                        toCase(item);
                    }
                    delete (json[key
                    ]);
                    switch (type) {
                        case 1:
                            json[key.toLocaleUpperCase()
                            ] = item;
                            break;
                        case 2:
                            json[key.substring(0,
                                1).toLocaleUpperCase() + key.substring(1).toLocaleLowerCase()
                            ] = item;
                            break;
                        case 3:
                            json[key.substring(0,
                                1).toLocaleLowerCase() + key.substring(1)
                            ] = item;
                            break;
                        default:
                            json[key.toLocaleLowerCase()
                            ] = item;
                            break;
                    }
                }
            }
        }
    }
}

exports.handler = (event, context, callback) => {
   // console.log('Received event:', JSON.stringify(event, null, 2));
    
        //console.log('Received event:', JSON.stringify(event, null, 2));
        event.Records.forEach((record) => {
            
            // Kinesis data is base64 encoded so decode here
            const load = new Buffer(record.kinesis.data, 'base64').toString('ascii');
            const payload = JSON.parse(load);
       
            var confidence = null;
            var name = null;
            var boundingBox = null;
            
           if(payload.FaceSearchResponse != null)
           {
               payload.FaceSearchResponse.forEach((face) =>  {
                   if(face.MatchedFaces != null && 
                         Object.keys(face.MatchedFaces).length > 0)
                   {
                       confidence = face.MatchedFaces[0].Similarity;
                       name = face.MatchedFaces[0].Face.ExternalImageId;
                       boundingBox = face.MatchedFaces[0].Face.BoundingBox;
                   }
               });
           }
           
           if(confidence != null && name != null)
            {
                var input = jsonKeysToCase(payload, 3).inputInformation;
                var eventNamespace = {
                    type: "FACE_MATCHED"
                }
                var label = {
                    name: name,
                    confidence: confidence,
                    boundingBox: boundingBox
                }
                var data = {
                    inputInformation: input,
                    eventNamespace: eventNamespace,
                    labels: [label]
                }
                var params = {
                  Message: JSON.stringify(data), /* required */
                  TopicArn: SNSTopic
                };
                sns.publish(params, function(err, data) {
                    if (err){
                        console.log(err, err.stack); // an error occurred
                        callback(err);
                    } 
                    else{
                        console.log(data);           // successful response
                        callback(null, `Successfully processed ${event.Records.length} records.`);
                    }     
                });
            }
        });
        
};