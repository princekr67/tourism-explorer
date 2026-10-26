
import React, { useEffect, useState } from "react";
import { Typography } from "@mui/material";

function getSearchData(searchData) {
  if (Array.isArray(searchData)) {
    return searchData[0] || {};
  }

  return searchData || {};
}

function getCoordinates(searchData) {
  const data = getSearchData(searchData);

  const entities = [
    ...(Array.isArray(data?.entities) ? data.entities : []),
    data?.entity,
    data?.entityInfo
  ].filter(Boolean);

  for (const entity of entities) {
    const geo = entity?.entityInfo?.geo || entity?.geo;

    const lat = Number(geo?.lat);
    const lon = Number(geo?.long ?? geo?.lon);

    if (
      geo &&
      Number.isFinite(lat) &&
      Number.isFinite(lon) &&
      lat >= -90 &&
      lat <= 90 &&
      lon >= -180 &&
      lon <= 180
    ) {
      return { lat, lon };
    }
  }

  return null;
}

function getQuery(searchData, props) {
  const data = getSearchData(searchData);

  return (
    data.query ||
    data.searchQuery ||
    props?.query ||
    props?.searchQuery ||
    ""
  );
}

function getRequestedCategory(query) {
  const text = query.toLowerCase();

  if (/\bmuseums?\b/.test(text)) return "museums";
  if (/\btemples?\b/.test(text)) return "temples";
  if (/\bmonuments?\b/.test(text)) return "monuments";
  if (/\bforts?\b/.test(text)) return "forts";
  if (/\bparks?\b|\bgardens?\b/.test(text)) return "parks";
  if (/\bviewpoints?\b/.test(text)) return "viewpoints";

  return "attractions";
}

function getPlaceCategory(properties, requestedCategory) {
  const categories = properties?.categories || [];
  const raw = properties?.datasource?.raw || {};

  if (requestedCategory === "museums") return "Museum";
  if (requestedCategory === "temples") return "Temple";
  if (requestedCategory === "parks") return "Park";
  if (requestedCategory === "monuments") return "Monument";
  if (requestedCategory === "forts") return "Fort";
  if (requestedCategory === "viewpoints") return "Viewpoint";

  // For general searches, classify each result using its actual categories.
  if (
    categories.some((item) =>
      item.startsWith("entertainment.museum")
    ) ||
    raw.tourism === "museum"
  ) {
    return "Museum";
  }

  if (
    categories.some((item) =>
      item.startsWith("religion.place_of_worship")
    )
  ) {
    return "Temple";
  }

  if (
    categories.some((item) =>
      item.startsWith("leisure.park")
    )
  ) {
    return "Park";
  }

  if (
    categories.some((item) =>
      item.startsWith("tourism.sights.castle")
    ) ||
    raw.historic === "castle" ||
    raw.tourism === "fort"
  ) {
    return "Fort";
  }

  if (
    categories.some((item) =>
      item.startsWith("tourism.sights.viewpoint")
    )
  ) {
    return "Viewpoint";
  }

  if (
    categories.some((item) =>
      item.includes("monument")
    ) ||
    raw.historic === "monument"
  ) {
    return "Monument";
  }

  return "Sight";
}

function matchesCategory(feature, requestedCategory) {
  const properties = feature.properties || {};
  const categories = properties.categories || [];
  const raw = properties.datasource?.raw || {};

  const name = (
    properties.name ||
    properties.address_line1 ||
    ""
  ).toLowerCase();

  if (requestedCategory === "museums") {
    const looksLikeRoad =
      /\bflyover\b|\bramp\b|\broad\b|\bhighway\b|\bunderpass\b/.test(name);

    return (
      (
        categories.some((item) =>
          item.startsWith("entertainment.museum")
        ) ||
        raw.tourism === "museum"
      ) &&
      !looksLikeRoad
    );
  }

  if (requestedCategory === "temples") {
    return categories.some((item) =>
      item.startsWith("religion.place_of_worship")
    );
  }

  if (requestedCategory === "parks") {
    return categories.some((item) =>
      item.startsWith("leisure.park")
    );
  }

  if (requestedCategory === "forts") {
    return (
      categories.some((item) =>
        item.startsWith("tourism.sights.castle")
      ) ||
      raw.historic === "castle" ||
      raw.tourism === "fort"
    );
  }

  if (requestedCategory === "viewpoints") {
    return categories.some((item) =>
      item.startsWith("tourism.sights.viewpoint")
    );
  }

  if (requestedCategory === "monuments") {
    return (
      categories.some((item) =>
        item.includes("monument")
      ) ||
      raw.historic === "monument"
    );
  }

  // "All" / general attractions includes sights, museums, temples and parks.
  return categories.some(
    (item) =>
      item.startsWith("tourism.sights") ||
      item.startsWith("entertainment.museum") ||
      item.startsWith("religion.place_of_worship") ||
      item.startsWith("leisure.park")
  ) || raw.tourism === "museum";
}

function NewComponent(props) {
  const [places, setPlaces] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    props?.messageHandlers?.componentLoaded?.();
  }, []);

  const searchData = props?.searchData;
  const coordinates = getCoordinates(searchData);
  const query = getQuery(searchData, props);
  const requestedCategory = getRequestedCategory(query);

  useEffect(() => {
    let cancelled = false;

    async function getPlaces() {
      if (!coordinates) {
        setPlaces([]);
        setError(
          "Location coordinates were not provided. Try searching with a city or district name."
        );
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const url = new URL("http://localhost:3001/api/places");
        url.searchParams.set("lat", coordinates.lat);
        url.searchParams.set("lon", coordinates.lon);
        url.searchParams.set("category", requestedCategory);

        const response = await fetch(url);

        if (!response.ok) {
          const result = await response.json().catch(() => ({}));

          throw new Error(
            result.details ||
            result.error ||
            "Failed to fetch tourist places"
          );
        }

        const data = await response.json();
        const features = Array.isArray(data.features)
          ? data.features
          : [];

        const filteredFeatures = features.filter((feature) =>
          matchesCategory(feature, requestedCategory)
        );

        const newPlaces = filteredFeatures.map((feature, index) => {
          const properties = feature.properties || {};
          const coords = feature.geometry?.coordinates || [];

          return {
            id:
              properties.place_id ||
              `${properties.name || "place"}-${index}`,
            name:
              properties.name ||
              properties.address_line1 ||
              `Tourist Place ${index + 1}`,
            city:
              properties.city ||
              properties.state ||
              properties.country ||
              properties.formatted ||
              "Location unavailable",
            category: getPlaceCategory(
              properties,
              requestedCategory
            ),
            description:
              properties.formatted ||
              properties.address_line2 ||
              "Explore this place of interest.",
            latitude: coords[1],
            longitude: coords[0]
          };
        });

        if (!cancelled) {
          setPlaces(newPlaces);
          setCategory("All");
        }
      } catch (err) {
        if (!cancelled) {
          setPlaces([]);
          setError(
            err.message ||
            "Unable to load places. Check that the backend is running."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    getPlaces();

    return () => {
      cancelled = true;
    };
  }, [coordinates?.lat, coordinates?.lon, requestedCategory]);

  const categories = [
    "All",
    ...new Set(places.map((place) => place.category))
  ];

  const filteredPlaces = places.filter((place) => {
    const text = search.trim().toLowerCase();

    const matchesSearch =
      place.name.toLowerCase().includes(text) ||
      place.city.toLowerCase().includes(text) ||
      place.description.toLowerCase().includes(text) ||
      place.category.toLowerCase().includes(text);

    const matchesSelectedCategory =
      category === "All" || place.category === category;

    return matchesSearch && matchesSelectedCategory;
  });

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        color: "#1e293b",
        padding: "20px",
        background: "#f8fafc",
        borderRadius: "16px"
      }}
    >
      <div
        style={{
          background: "linear-gradient(120deg, #0f766e, #164e63)",
          color: "white",
          padding: "28px 20px",
          borderRadius: "14px",
          marginBottom: "22px"
        }}
      >
        <Typography variant="h4" style={{ fontWeight: "bold" }}>
          Discover Amazing Places
        </Typography>

        <p>
          {query
            ? `Explore places for: ${query}`
            : "Find your next unforgettable destination."}
        </p>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search attractions, museums, parks..."
          aria-label="Search attractions"
          style={{
            width: "100%",
            maxWidth: "450px",
            padding: "13px",
            borderRadius: "8px",
            border: "none",
            fontSize: "15px",
            boxSizing: "border-box"
          }}
        />
      </div>

      {places.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            marginBottom: "20px"
          }}
        >
          {categories.map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              style={{
                padding: "9px 14px",
                borderRadius: "20px",
                border: "1px solid #0f766e",
                background: category === item ? "#0f766e" : "white",
                color: category === item ? "white" : "#0f766e",
                cursor: "pointer",
                textTransform: "capitalize"
              }}
            >
              {item}
            </button>
          ))}
        </div>
      )}

      <h3>Explore destinations</h3>

      {loading && <p>Loading live tourist attractions...</p>}

      {!loading && error && <p role="alert">{error}</p>}

      {!loading && !error && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: "18px"
            }}
          >
            {filteredPlaces.map((place) => (
              <div
                key={place.id}
                style={{
                  background: "white",
                  borderRadius: "12px",
                  overflow: "hidden",
                  boxShadow: "0 3px 12px #00000012"
                }}
              >
                <div
                  style={{
                    height: "8px",
                    background: "#0f766e"
                  }}
                />

                <div style={{ padding: "14px" }}>
                  <span
                    style={{
                      color: "#0f766e",
                      fontSize: "12px",
                      fontWeight: "bold",
                      textTransform: "capitalize"
                    }}
                  >
                    {place.category}
                  </span>

                  <h3 style={{ margin: "8px 0" }}>
                    {place.name}
                  </h3>

                  <p style={{ color: "#64748b", fontSize: "13px" }}>
                    {place.city}
                  </p>

                  <p style={{ fontSize: "14px", lineHeight: 1.5 }}>
                    {place.description}
                  </p>

                  {place.latitude != null &&
                    place.longitude != null && (
                      <a
                        href={`https://www.google.com/maps?q=${place.latitude},${place.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: "#0f766e",
                          fontSize: "14px",
                          fontWeight: "bold"
                        }}
                      >
                        View on Google Maps
                      </a>
                    )}
                </div>
              </div>
            ))}
          </div>

          {filteredPlaces.length === 0 && (
            <p>No matching destinations found. Try another search.</p>
          )}
        </>
      )}
    </div>
  );
}

export default NewComponent;
