const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const util = require('util');
const { downloadFromS3, uploadToS3, deleteS3Object, listS3Objects } = require('../utils/s3Helper');

const execPromise = util.promisify(exec);

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
    if (!chunks.Contents || !chunks.Contents.length) {
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

    chunkFiles.sort((a, b) => {
      const getChunkId = (filename) => {
        const match = filename.match(/chunk_(\d+)/);
        return match ? parseInt(match[1]) : 0;
      };
      return getChunkId(a) - getChunkId(b);
    });


    const fileList = path.join(tmpDir, 'files.txt');
    const fileContent = chunkFiles.map(f => `file '${f}'`).join('\n');
    await fs.promises.writeFile(fileList, fileContent);


    const ffmpegPath = process.env.LAMBDA_TASK_ROOT ? 
      '/opt/nodejs/bin/ffmpeg' : 
      'ffmpeg';

    // Merge audio files using ffmpeg with transcoding
    const outputPath = path.join(tmpDir, 'merged.wav');
    await execPromise(`${ffmpegPath} -f concat -safe 0 -i ${fileList} -c:a pcm_s16le -ar 48000 -ac 1 ${outputPath}`);


    const mergedKey = `recordings/${sessionId}/merged.wav`;
    await uploadToS3(bucketName, mergedKey, outputPath, 'audio/wav');


    for (const chunk of chunks.Contents) {
      await deleteS3Object(bucketName, chunk.Key);
    }


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
      body: JSON.stringify({ 
        error: 'Failed to merge audio chunks',
        details: error.message 
      })
    };
  }
};