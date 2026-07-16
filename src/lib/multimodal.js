const SUPPORTED_IMAGE_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export function parseDataImageUrl(url) {
  if (typeof url !== "string") return null;
  const match = url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) return null;
  const mediaType = match[1].toLowerCase();
  if (!SUPPORTED_IMAGE_MEDIA_TYPES.has(mediaType)) return null;
  return { mediaType, data: match[2].replace(/\s+/g, "") };
}

export function toAnthropicContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return JSON.stringify(content || "");

  const parts = [];
  for (const part of content) {
    if (part?.type === "text" && part.text) {
      parts.push({ type: "text", text: String(part.text) });
      continue;
    }

    if (part?.type === "tool_use" && part.id && part.name) {
      parts.push({
        type: "tool_use",
        id: String(part.id),
        name: String(part.name),
        input: part.input && typeof part.input === "object" ? part.input : {},
      });
      continue;
    }

    if (part?.type === "tool_result" && part.tool_use_id) {
      parts.push({
        type: "tool_result",
        tool_use_id: String(part.tool_use_id),
        content: typeof part.content === "string" ? part.content : JSON.stringify(part.content || ""),
        is_error: part.is_error === true,
      });
      continue;
    }

    if (part?.type === "image" && part.source?.type === "base64" && part.source?.media_type && part.source?.data) {
      parts.push({
        type: "image",
        source: {
          type: "base64",
          media_type: String(part.source.media_type).toLowerCase(),
          data: String(part.source.data).replace(/\s+/g, ""),
        },
      });
      continue;
    }

    const imageUrl = part?.type === "image_url"
      ? (typeof part.image_url === "string" ? part.image_url : part.image_url?.url)
      : null;
    const image = parseDataImageUrl(imageUrl);
    if (image) {
      parts.push({
        type: "image",
        source: {
          type: "base64",
          media_type: image.mediaType,
          data: image.data,
        },
      });
    }
  }

  return parts.length > 0 ? parts : "";
}

export function hasImageContent(content) {
  return Array.isArray(content) && content.some((part) => part?.type === "image_url");
}
