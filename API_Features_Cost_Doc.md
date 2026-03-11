# Evacuation Map - API, Features, & Cost Estimation Documentation

This document outlines the external APIs integrated into the Evacuation Map application, the features showcased in the UI, and an estimation of potential costs associated with the API usage.

## 1. APIs Used

The application relies on two primary mapping/location service providers to deliver a comprehensive evacuation tracking experience:

### A. Google Maps JavaScript API
*   **Purpose**: Functions as the primary base map renderer and handles the drawing of all map overlays (markers, paths, info windows).
*   **Libraries Included**: `places`, `geometry`.
*   **Components Used**:
    *   `GoogleMap`: The core map container.
    *   `Marker`: Used to pinpoint the user's location, emergency shelter locations, and TomTom traffic incident locations (for point-based data).
    *   `Polyline`: Used for drawing TomTom traffic incident lines (e.g., road closures) and the traffic-aware calculated route segments.
    *   `InfoWindow`: Provides detailed pop-up information for shelters and incidents.
    *   `TrafficLayer`: Displays Google's native real-time traffic overlay as a background contextual layer.

### B. TomTom Traffic API (v5 - Incident Details)
*   **Endpoint**: `https://api.tomtom.com/traffic/services/5/incidentDetails`
*   **Purpose**: Live aggregation of real-time traffic incidents (accidents, jams, road closures, hazards) within the Bengaluru bounding box limits (`77.4,12.8,77.8,13.1`).
*   **Usage Pattern**: The app polls this endpoint every **60 seconds** (`setInterval`) to ensure the map displays up-to-the-minute hazard information.

### C. TomTom Routing API (v1 - Calculate Route)
*   **Endpoint**: `https://api.tomtom.com/routing/1/calculateRoute`
*   **Purpose**: Calculates the fastest and safest evacuation route from the user's current location to a selected shelter, actively avoiding traffic bottlenecks.
*   **Usage Pattern**: Triggered on-demand when a user clicks on a shelter. It utilizes the `sectionType=traffic` parameter to return the route broken down into segments based on traffic severity.

---

## 2. Things We Are Showing (Features)

The `EvacuationMap` component acts as a tactical dashboard displaying the following elements:

1.  **Interactive Base Map**: A full-screen Google Map interface that centers on the user's geolocated position (or Bengaluru by default).
2.  **User Location**: A distinct crosshair/person marker indicating the user's exact geographical position.
3.  **Emergency Shelters List (Sidebar)**:
    *   A searchable sidebar panel listing pre-defined shelters.
    *   Displays operational status (`● Available`, `● Limited`, `● Closed`), capacity figures, shelter type, address, and a visual thumbnail.
4.  **Shelter Map Markers**:
    *   Shelters are plotted on the map.
    *   Selecting a shelter highlights it with a visual "pulse" effect, triggers route calculation, and displays an `InfoWindow` with its name and capacity.
5.  **Multi-Colored Traffic-Aware Routing**:
    *   When navigating to a shelter, the calculated route line is rendered as multiple interconnected segments.
    *   Segments are color-coded based on TomTom's delay data:
        *   **Red**: Critical traffic delay (> 60 seconds).
        *   **Orange**: Moderate traffic delay (> 10 seconds).
        *   **Blue**: Clear traffic / no significant delay.
6.  **Real-Time Incident Plotting**:
    *   Incidents are overlaid on the map with specific emojis/icons (🚨 Accidents, 🚗 Jams, ⛔ Closures, 🔧 Road Works, ⚠️ Danger).
    *   **Polylines**: For incidents affecting a stretch of road (LineStrings), a thick colored trace is drawn.
    *   **Markers**: For localized incidents (Points), an icon is placed.
    *   Clicking an incident reveals detailing (category, descriptive road info, and incident text).
7.  **Interactive Filters**: A header toolbar allows users to toggle the visibility of specific incident categories to reduce map clutter.
8.  **Map Controls & Legend**: Header zoom controls (+ / -) and a floating bottom-left legend explaining the route segment color codes (Heavy, Moderate, Clear).

---

## 3. Cost Estimation & Usage Considerations

*Note: Pricing is approximate and based on standard public API tiers. Actual costs scale with real-world user traffic.*

### Google Maps API Costs
*   **Dynamic Maps JS API**: Google provides a **$200 monthly free credit**, which covers approximately **28,500 map loads** per month for free.
*   **Beyond Free Tier**: Costs are **$7.00 per 1,000 requests** for Dynamic Maps.
*   **Cost Factor**: The map is loaded once per user session. Subsequent panning, zooming, routing, or adding incident markers do *not* trigger new map load charges.

### TomTom API Costs (Traffic & Routing)
*   **Free Tier / Quota**: TomTom typically offers a generous developer tier (e.g., 2,500 free daily API transactions or a high monthly request limit).
*   **Beyond Free Tier**: Generally structured as pay-as-you-grow, averaging roughly **$0.50 per 1,000 transactions**.
*   **Traffic Incidents (High Usage Impact)**:
    *   *Calculation*: Fetched every 1 minute. If 1 user leaves the map open for 1 hour, that generates **60 API calls**.
    *   *Scenario*: 100 concurrent users holding the page open for 1 hour = **6,000 TomTom API calls**.
*   **Routing (Low Usage Impact)**:
    *   *Calculation*: Triggered only upon a shelter click. 1 click = 1 API call. Much cheaper and highly predictable.

### Recommendations for Production Optimization
To prevent runaway costs on the TomTom API if the app scales to thousands of concurrent users:
1.  **Backend Proxy & Caching (Crucial)**: Instead of the React frontend calling TomTom directly, create a backend endpoint (e.g., Next.js API route). The backend polls TomTom once every 60 seconds and caches the JSON. All thousands of connected users fetch from your backend cache. This limits your TomTom API traffic usage to exactly **1,440 calls per day**, completely irrespective of the number of users online.
2.  **API Key Security**: Ensure `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_TOMTOM_API_KEY` are restricted to your specific production domains within their respective developer consoles to prevent key theft.
3.  **Throttle UI Updates**: Consider increasing the traffic polling interval from `60000ms` (1 min) to `180000ms` (3 min) if ultra-real-time precision isn't strictly necessary.
