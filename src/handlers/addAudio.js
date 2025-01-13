const { uploadToS3 } = require('./utils/s3Helper');

exports.handler = async (event) => {
  try {
    const bucketName = process.env.BUCKET_NAME;
    const chunkId = event.queryStringParameters?.chunkId;
    const sessionId = event.queryStringParameters?.sessionId;
    
    if (!chunkId || !sessionId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ error: 'Missing chunkId or sessionId parameter' })
      };
    }

    const audioData = Buffer.from(JSON.parse(event.body).audioData, 'base64');
    
    // Upload to S3 with temporary path
    const key = `temp/${sessionId}/chunk_${chunkId}.wav`;
    await uploadToS3(bucketName, key, audioData, 'audio/wav');

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Audio chunk uploaded successfully',
        chunkId,
        sessionId,
        key
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({ error: 'Failed to process audio chunk' })
    };
  }
};