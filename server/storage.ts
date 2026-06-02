// Preconfigured storage helpers for Manus WebDev templates
// Uses the Biz-provided storage proxy (Authorization: Bearer <token>)

import { ENV } from './_core/env';

type StorageConfig = { baseUrl: string; apiKey: string };

function getStorageConfig(): StorageConfig {
  const baseUrl = ENV.forgeApiUrl;
  const apiKey = ENV.forgeApiKey;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Storage proxy credentials missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function buildUploadUrl(baseUrl: string, relKey: string): URL {
  const url = new URL("v1/storage/upload", ensureTrailingSlash(baseUrl));
  url.searchParams.set("path", normalizeKey(relKey));
  return url;
}

async function buildDownloadUrl(
  baseUrl: string,
  relKey: string,
  apiKey: string
): Promise<string> {
  const downloadApiUrl = new URL(
    "v1/storage/downloadUrl",
    ensureTrailingSlash(baseUrl)
  );
  downloadApiUrl.searchParams.set("path", normalizeKey(relKey));
  const response = await fetchStorageWithRetry(
    downloadApiUrl,
    {
      method: "GET",
      headers: buildAuthHeaders(apiKey),
    },
    "downloadUrl"
  );
  return (await response.json()).url;
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function toFormData(
  data: Buffer | Uint8Array | string,
  contentType: string,
  fileName: string
): FormData {
  const blob =
    typeof data === "string"
      ? new Blob([data], { type: contentType })
      : new Blob([data as any], { type: contentType });
  const form = new FormData();
  form.append("file", blob, fileName || "file");
  return form;
}

function buildAuthHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey}` };
}

// Transient gateway/proxy failures (e.g. 502 Bad Gateway from openresty/APISIX in
// front of the storage backend) are common and intermittent. Retry them with
// exponential backoff so a single hiccup does not abort an audio upload.
const TRANSIENT_STORAGE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_STORAGE_ATTEMPTS = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchStorageWithRetry(
  url: URL,
  init: RequestInit,
  opName: string
): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= MAX_STORAGE_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, init);
      if (
        response.ok ||
        !TRANSIENT_STORAGE_STATUS.has(response.status) ||
        attempt === MAX_STORAGE_ATTEMPTS
      ) {
        return response;
      }
      console.warn(
        `[Storage] ${opName} transient ${response.status} (tentativa ${attempt}/${MAX_STORAGE_ATTEMPTS}); repetindo...`
      );
    } catch (error) {
      lastError = error;
      if (attempt === MAX_STORAGE_ATTEMPTS) throw error;
      console.warn(
        `[Storage] ${opName} erro de rede (tentativa ${attempt}/${MAX_STORAGE_ATTEMPTS}); repetindo...`,
        error
      );
    }
    await sleep(Math.min(4000, 400 * 2 ** (attempt - 1)));
  }
  if (lastError) throw lastError;
  throw new Error(`[Storage] ${opName} falhou após ${MAX_STORAGE_ATTEMPTS} tentativas`);
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const uploadUrl = buildUploadUrl(baseUrl, key);
  const formData = toFormData(data, contentType, key.split("/").pop() ?? key);
  const response = await fetchStorageWithRetry(
    uploadUrl,
    {
      method: "POST",
      headers: buildAuthHeaders(apiKey),
      body: formData,
    },
    "upload"
  );

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(
      `Storage upload failed (${response.status} ${response.statusText}): ${message}`
    );
  }
  const url = (await response.json()).url;
  return { key, url };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string; }> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  return {
    key,
    url: await buildDownloadUrl(baseUrl, key, apiKey),
  };
}

export async function storageDelete(relKey: string): Promise<void> {
  const { baseUrl, apiKey } = getStorageConfig();
  const key = normalizeKey(relKey);
  const deleteUrl = new URL("v1/storage/delete", ensureTrailingSlash(baseUrl));
  deleteUrl.searchParams.set("path", key);

  const attempt = async (method: "DELETE" | "POST") => {
    const response = await fetch(deleteUrl, {
      method,
      headers: buildAuthHeaders(apiKey),
    });
    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(
        `Storage delete failed (${response.status} ${response.statusText}): ${message}`
      );
    }
  };

  try {
    await attempt("DELETE");
  } catch (error) {
    await attempt("POST");
  }
}