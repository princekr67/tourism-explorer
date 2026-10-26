
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, ".env");

// Load the Geoapify API key from the root .env file.
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separator = trimmedLine.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separator).trim();
    const value = trimmedLine.slice(separator + 1).trim();

    if (key === "GEOAPIFY_API_KEY") {
      process.env.GEOAPIFY_API_KEY = value.replace(/^["']|["']$/g, "");
    }
  }
}

// Categories used by the frontend.
const categoryMap = {
  attractions:
    "tourism.sights,entertainment.museum,religion.place_of_worship,leisure.park",
  museums: "entertainment.museum",
  temples: "religion.place_of_worship",
  monuments: "tourism.sights.monument",
  forts: "tourism.sights.castle",
  parks: "leisure.park",
  viewpoints: "tourism.sights.viewpoint"
};

const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, "http://localhost:3001");

  if (url.pathname !== "/api/places") {
    res.writeHead(404);
    return res.end(JSON.stringify({ error: "Route not found" }));
  }

  if (req.method !== "GET") {
    res.writeHead(405);
    return res.end(JSON.stringify({ error: "Method not allowed" }));
  }

  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const category = (url.searchParams.get("category") || "attractions")
    .toLowerCase();

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    res.writeHead(400);
    return res.end(
      JSON.stringify({ error: "Valid latitude and longitude are required" })
    );
  }

  const apiKey = process.env.GEOAPIFY_API_KEY;

  if (!apiKey) {
    res.writeHead(500);
    return res.end(
      JSON.stringify({ error: "GEOAPIFY_API_KEY is missing in .env" })
    );
  }

  try {
    const apiUrl = new URL("https://api.geoapify.com/v2/places");

    apiUrl.searchParams.set(
      "categories",
      categoryMap[category] || categoryMap.attractions
    );

    // Geoapify expects longitude first, then latitude.
    apiUrl.searchParams.set("filter", `circle:${lon},${lat},20000`);
    apiUrl.searchParams.set("limit", "20");
    apiUrl.searchParams.set("apiKey", apiKey);

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!response.ok) {
      console.error("Geoapify API error:", data);

      res.writeHead(response.status);
      return res.end(
        JSON.stringify({
          error: "Geoapify request failed",
          details: data.message || data.error || "Check your API request"
        })
      );
    }

    res.writeHead(200);
    return res.end(JSON.stringify(data));
  } catch (error) {
    console.error("Geoapify connection error:", error);

    res.writeHead(502);
    return res.end(
      JSON.stringify({ error: "Could not connect to Geoapify" })
    );
  }
});

server.listen(3001, () => {
  console.log("Tourism backend running at http://localhost:3001");
});
