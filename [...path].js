// pages/api/brawl/[...path].js
// Server-side proxy for Brawl Stars API to avoid CORS & IP restrictions

const BASE_URL = "https://api.brawlstars.com/v1";

// Simple in-memory cache to avoid hammering the API
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 60 seconds

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { path } = req.query;
  if (!path || !Array.isArray(path)) {
    return res.status(400).json({ error: "Invalid path" });
  }

  // Reconstruct the path and query string
  const apiPath = "/" + path.join("/");
  const queryString = new URLSearchParams(req.query);
  // Remove the 'path' param (it's part of the route)
  queryString.delete("path");
  const fullUrl = `${BASE_URL}${apiPath}${queryString.toString() ? "?" + queryString.toString() : ""}`;

  // Check cache
  const cacheKey = fullUrl;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    res.setHeader("X-Cache", "HIT");
    return res.status(200).json(cached.data);
  }

  const token = process.env.BS_TOKEN;
  if (!token) {
    return res.status(500).json({ error: "API token not configured" });
  }

  try {
    const response = await fetch(fullUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      // Pass through the error from the API
      return res.status(response.status).json({
        error: data.reason || data.message || "API error",
        status: response.status,
        detail: data,
      });
    }

    // Store in cache
    cache.set(cacheKey, { data, ts: Date.now() });

    // Cache headers
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");
    res.setHeader("X-Cache", "MISS");
    return res.status(200).json(data);
  } catch (err) {
    console.error("Brawl Stars API proxy error:", err);
    return res.status(500).json({ error: "Failed to fetch from Brawl Stars API", detail: err.message });
  }
}
