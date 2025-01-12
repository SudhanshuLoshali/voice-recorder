const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const execPromise = util.promisify(exec);

const downloadFromS3 = async (bucketName, key, localPath) => {
  const params = {
    Bucket: bucketName,
    Key: key
  };
  const data = await s3.getObject(params).promise();
  await fs.promises.writeFile(localPath, data.Body);
};

const uploadToS3 = async (bucketName, key, filePath, contentType) => {
  const fileContent = await fs.promises.readFile(filePath);
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: fileContent,
    ContentType: contentType
  };
  return s3.upload(params).promise();
};

const deleteS3Object = async (bucketName, key) => {
  const params = {
    Bucket: bucketName,
    Key: key
  };
  return s3.deleteObject(params).promise();
};

const listS3Objects = async (bucketName, prefix) => {
  const params = {
    Bucket: bucketName,
    Prefix: prefix
  };
  return s3.listObjectsV2(params).promise();
};

exports.handler = async (event) => {
  try {
    const bucketName = process.env.BUCKET_NAME;
    const sessionId = event.queryStringParameters?.sessionId;
    
    if (!sessionId) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ error: 'Missing sessionId parameter' })
      };
    }

    // Create temporary working directory
    const tmpDir = `/tmp/${sessionId}`;
    await fs.promises.mkdir(tmpDir, { recursive: true });

    // List all chunks for this session
    const chunks = await listS3Objects(bucketName, `temp/${sessionId}/`);
    if (!chunks.Contents.length) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Credentials': true,
        },
        body: JSON.stringify({ error: 'No audio chunks found for this session' })
      };
    }

    // Download all chunks
    const chunkFiles = [];
    for (const chunk of chunks.Contents) {
      const localPath = path.join(tmpDir, path.basename(chunk.Key));
      await downloadFromS3(bucketName, chunk.Key, localPath);
      chunkFiles.push(localPath);
    }

    // Sort chunks by name to ensure correct order
    chunkFiles.sort();

    // Create file list for ffmpeg
    const fileList = path.join(tmpDir, 'files.txt');
    const fileContent = chunkFiles.map(f => `file '${f}'`).join('\n');
    await fs.promises.writeFile(fileList, fileContent);

    // Merge audio files using ffmpeg
    const outputPath = path.join(tmpDir, 'merged.wav');
    await execPromise(`ffmpeg -f concat -safe 0 -i ${fileList} -c copy ${outputPath}`);

    // Upload merged file to S3
    const mergedKey = `recordings/${sessionId}/merged.wav`;
    await uploadToS3(bucketName, mergedKey, outputPath, 'audio/wav');

    // Clean up temporary chunks
    for (const chunk of chunks.Contents) {
      await deleteS3Object(bucketName, chunk.Key);
    }

    // Clean up local files
    await fs.promises.rm(tmpDir, { recursive: true, force: true });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT,DELETE',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Credentials': true,
      },
      body: JSON.stringify({
        message: 'Audio chunks merged successfully',
        mergedKey
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
      body: JSON.stringify({ error: 'Failed to merge audio chunks' })
    };
  }
};