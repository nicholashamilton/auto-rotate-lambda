const aws = require('aws-sdk');
const s3 = new aws.S3({ apiVersion: '2006-03-01' });
const jo = require('jpeg-autorotate');

// Rotate an image given a buffer
const autorotateImage = (data, callback) => {
    jo.rotate(data, {}, (error, buffer, orientation) => {
        if (error) {
            console.log(`An error occurred when rotating the file: ${error.message}`);
            callback(error, null);
        } else {
            console.log(`Orientation was: ${orientation}`);
            callback(null, buffer);
        }
    });
};

// AWS Lambda runs this on every new file upload to s3
exports.handler = async (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    // Get the object from the event and show its content type
    const bucket = event.Records[0].s3.bucket.name;
    const key = event.Records[0].s3.object.key;

    s3.getObject({ Bucket: bucket, Key: key }, (err, data) => {
        if (err) {
            console.log(`Error getting object ${key} from ${bucket} bucket. Make sure they exist and your bucket is in the same region as this function.`);
            callback(`Error getting file:  ${err}`, null);
        } 
        
        else {
            // Log the content type, should be an image
            console.log('CONTENT TYPE:', data.ContentType);
            
            // Rotate the image
            autorotateImage(data.Body, (error, image) => {
                if (error) {
                    callback(`Error rotating image: ${error}`, null);
                }

                const newKeyValue = `rotated/${key}`;
                const params = {
                    Bucket: bucket,
                    Key: newKeyValue,
                    Body: image,
                };

                // Upload new image, careful not to upload it in a path that will trigger the function again.
                s3.putObject(params, (err, data) => {
                    if (error) {
                        callback(`Error uploading rotated image: ${error}`, null);
                    } else {
                        console.log('Successfully uploaded image on S3', data);
                        // Call AWS Lambda's callback, function was successful!!!
                        callback(null, data);
                    }
                });
            });
        }
    });
};
