import { readFile } from "fs/promises";

const TOKEN = process.env.LINKEDIN_ACCESS_TOKEN;
const AUTHOR_URN = process.env.LINKEDIN_AUTHOR_URN; // e.g. urn:li:person:abc123

function requireEnv() {
  if (!TOKEN || !AUTHOR_URN) {
    throw new Error(
      "LINKEDIN_ACCESS_TOKEN and LINKEDIN_AUTHOR_URN must be set"
    );
  }
  return { token: TOKEN, author: AUTHOR_URN };
}

/** Posts to LinkedIn. Returns a URL to the created post. */
export async function publishPost(
  text: string,
  imagePath?: string
): Promise<{ url: string; id: string }> {
  const { token, author } = requireEnv();

  let mediaAsset: string | undefined;
  if (imagePath) {
    mediaAsset = await uploadImage(imagePath);
  }

  const body = {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: mediaAsset ? "IMAGE" : "NONE",
        ...(mediaAsset
          ? {
              media: [
                {
                  status: "READY",
                  media: mediaAsset,
                  title: { text: "Diagram" },
                },
              ],
            }
          : {}),
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  const r = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    throw new Error(`LinkedIn publish failed: ${r.status} ${await r.text()}`);
  }

  const postId = r.headers.get("x-restli-id") ?? "unknown";
  // ugcPost URN → feed URL. Format isn't officially documented; this works in practice.
  return { id: postId, url: `https://www.linkedin.com/feed/update/${postId}/` };
}

/** Two-step image upload: register → upload binary → get asset URN. */
async function uploadImage(imagePath: string): Promise<string> {
  const { token, author } = requireEnv();

  const registerBody = {
    registerUploadRequest: {
      recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
      owner: author,
      serviceRelationships: [
        {
          relationshipType: "OWNER",
          identifier: "urn:li:userGeneratedContent",
        },
      ],
    },
  };

  const reg = await fetch(
    "https://api.linkedin.com/v2/assets?action=registerUpload",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registerBody),
    }
  );
  if (!reg.ok)
    throw new Error(
      `LinkedIn registerUpload failed: ${reg.status} ${await reg.text()}`
    );

  const regData = await reg.json();
  const uploadUrl =
    regData.value.uploadMechanism[
      "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
    ].uploadUrl;
  const asset: string = regData.value.asset;

  const imageData = await readFile(imagePath);
  const up = await fetch(uploadUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: new Uint8Array(imageData),
  });
  if (!up.ok)
    throw new Error(
      `LinkedIn image upload failed: ${up.status} ${await up.text()}`
    );

  return asset;
}
