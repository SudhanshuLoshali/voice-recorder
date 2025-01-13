const AWS = require('aws-sdk');
const s3 = new AWS.S3();

const uploadToS3 = async (bucketName, key, body, contentType) => {
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: contentType
  };
  return s3.upload(params).promise();
};

const downloadFromS3 = async (bucketName, key, localPath) => {
  const params = {
    Bucket: bucketName,
    Key: key
  };
  const data = await s3.getObject(params).promise();
  await fs.promises.writeFile(localPath, data.Body);
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

module.exports = {
  uploadToS3,
  downloadFromS3,
  deleteS3Object,
  listS3Objects
};