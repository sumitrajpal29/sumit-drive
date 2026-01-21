const API_URL = import.meta.env.VITE_API_GATEWAY_URL;
const CLOUDFRONT_DOMAIN = import.meta.env.VITE_CLOUDFRONT_DOMAIN;

export const listBucketContent = async (prefix = "") => {
  const normalizedPrefix = prefix && !prefix.endsWith("/") ? `${prefix}/` : prefix;

  try {
    const response = await fetch(`${API_URL}?prefix=${encodeURIComponent(normalizedPrefix)}`);

    if (!response.ok) {
      throw new Error(`List failed with status: ${response.status}`);
    }

    const rawData = await response.json();

    // Handle the flat structure: { objects: [...] }
    const objects = rawData.objects || [];

    const foldersMap = new Map();
    const files = [];

    objects.forEach(obj => {
      const key = obj.key;

      // If we are looking for root (prefix=""), we want items that don't start with / (or handle it if they do)
      // key: "A.mp4" (prefix="") -> file "A.mp4"
      // key: "Screenshots/B.png" (prefix="") -> folder "Screenshots"
      // key: "Screenshots/B.png" (prefix="Screenshots/") -> file "B.png" inside

      if (!key.startsWith(normalizedPrefix)) return;

      const relativeKey = key.slice(normalizedPrefix.length);
      const parts = relativeKey.split('/');

      if (parts.length === 1) {
        // It's a file at this level (e.g. "A.mp4" or "B.png" inside Screenshots/)
        if (parts[0] !== "") { // Avoid empty string if key matches prefix exactly (shouldn't happen for files usually)
          files.push({
            ...obj,
            name: parts[0],
            url: obj.url || (CLOUDFRONT_DOMAIN ? `${CLOUDFRONT_DOMAIN}/${key}` : null)
          });
        }
      } else {
        // It's a subfolder item (e.g. "Screenshots/B.png" -> "Screenshots" is the folder)
        const folderName = parts[0];
        if (!foldersMap.has(folderName)) {
          foldersMap.set(folderName, {
            name: folderName,
            prefix: normalizedPrefix + folderName + "/"
          });
        }
      }
    });

    const folders = Array.from(foldersMap.values());

    return { folders, files };
  } catch (error) {
    console.error("Error listing S3 objects:", error);
    throw error;
  }
};

export const uploadFile = async (file, prefix = "") => {
  const normalizedPrefix = prefix && !prefix.endsWith("/") ? `${prefix}/` : prefix;
  const fileName = file.webkitRelativePath || file.name;
  const key = `${normalizedPrefix}${fileName}`;

  try {
    // 1. Get Presigned URL from API Gateway
    const presignResponse = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key,
        contentType: file.type || 'application/octet-stream'
      }),
    });

    if (!presignResponse.ok) {
      throw new Error(`Failed to get presigned URL: ${presignResponse.status}`);
    }

    const { uploadUrl } = await presignResponse.json();

    // 2. Upload to S3 using the presigned URL
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type || 'application/octet-stream',
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed with status: ${uploadResponse.status}`);
    }

    return key;
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
};

export const deleteFiles = async (keys) => {
  if (!keys || keys.length === 0) return;

  try {
    const response = await fetch(API_URL, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ keys }),
    });

    if (!response.ok) {
      throw new Error(`Delete failed with status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error deleting S3 objects:", error);
    throw error;
  }
};

