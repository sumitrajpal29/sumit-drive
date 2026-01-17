import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = import.meta.env.VITE_AWS_BUCKET_NAME;
const CLOUDFRONT_DOMAIN = import.meta.env.VITE_CLOUDFRONT_DOMAIN;

export const listBucketContent = async (prefix = "") => {
  // Ensure prefix ends with / if not empty
  const normalizedPrefix = prefix && !prefix.endsWith("/") ? `${prefix}/` : prefix;

  const command = new ListObjectsV2Command({
    Bucket: BUCKET_NAME,
    Prefix: normalizedPrefix,
    Delimiter: "/",
  });

  try {
    const response = await s3Client.send(command);

    const folders = (response.CommonPrefixes || []).map((p) => ({
      name: p.Prefix.replace(normalizedPrefix, '').replace('/', ''),
      prefix: p.Prefix
    }));

    const files = (response.Contents || []).map((file) => ({
      key: file.Key,
      name: file.Key.replace(normalizedPrefix, ''),
      lastModified: file.LastModified,
      size: file.Size,
      url: CLOUDFRONT_DOMAIN ? `${CLOUDFRONT_DOMAIN}/${file.Key}` : null,
    })).filter(f => f.key !== normalizedPrefix);

    return { folders, files };
  } catch (error) {
    console.error("Error listing S3 objects:", error);
    throw error;
  }
};

export const uploadFile = async (file, prefix = "") => {
  const normalizedPrefix = prefix && !prefix.endsWith("/") ? `${prefix}/` : prefix;
  // Use webkitRelativePath if available (for folder uploads), otherwise fall back to name
  const fileName = file.webkitRelativePath || file.name;
  const key = `${normalizedPrefix}${fileName}`;

  try {
    // 1. Generate Presigned URL
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      // ContentType is important for the browser to send it correctly
      ContentType: file.type || 'application/octet-stream',
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    // 2. Upload using fetch
    const response = await fetch(url, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type || 'application/octet-stream',
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed with status: ${response.status}`);
    }

    return key;
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
};

export const deleteFiles = async (keys) => {
  if (!keys || keys.length === 0) return;

  const command = new DeleteObjectsCommand({
    Bucket: BUCKET_NAME,
    Delete: {
      Objects: keys.map(key => ({ Key: key })),
      Quiet: false
    }
  });

  try {
    const response = await s3Client.send(command);
    return response;
  } catch (error) {
    console.error("Error deleting S3 objects:", error);
    throw error;
  }
};

