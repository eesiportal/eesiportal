# Return Directions as Coordinates / Polylines Along a Route

This sub-workflow covers how to calculate routes between two or more coordinates
(or address strings/Place IDs) and retrieve the resulting route geometry as a
series of coordinates (`LatLngAltitude` arrays) or rendered `Polyline` objects
using the Maps JavaScript API.

> **European Economic Area (EEA) developers:** If your billing address is in the
> European Economic Area, effective on 8 July 2025, the
> [Google Maps Platform EEA Terms of Service](https://cloud.google.com/terms/maps-platform/eea)
> will apply to your use of the Services. Functionality varies by region.
> [Learn more](https://developers.google.com/maps/comms/eea/faq).

--------------------------------------------------------------------------------

## 1. Modern Approach: Routes Library (`Route.computeRoutes`)

The `routes` library in the Maps JavaScript API provides the
`Route.computeRoutes` method, which calculates directions and returns route
paths as `LatLngAltitude` coordinate arrays or ready-to-render
`google.maps.Polyline` instances.

### Polyline & Billing Types

When calling `computeRoutes`, you can request different types of polylines
depending on your data needs:

1.  **Basic Polyline (Default):** Represents the route geometry without embedded
    traffic information. Billed at the **Routes Basic** rate.
    -   **Required `fields`:** `['path']`
2.  **Traffic-Aware Polyline:** Contains traffic conditions along the route
    expressed as speed categories (`NORMAL`, `SLOW`, `TRAFFIC_JAM`) on specific
    intervals. Billed at the **Routes Preferred** rate.
    -   **Required configuration:**
        -   `travelMode`: `'DRIVING'`
        -   `routingPreference`: `'TRAFFIC_AWARE'`
        -   `extraComputations`: `['TRAFFIC_ON_POLYLINE']`
        -   `fields`: `['path', 'speedPaths', 'routeLabels']`
3.  **Multimodal Polyline:** Contains transit details as well as traffic
    information. Billed at the **Routes Preferred** rate.

--------------------------------------------------------------------------------

### Implementation: Basic & Traffic-Aware Polylines (Vanilla JS)

To compute a route and display its polylines on a map:

1.  Load the `maps` and `routes` libraries via `google.maps.importLibrary()`.
2.  Construct a `ComputeRoutesRequest` including `internalUsageAttributionIds:
    ['gmp_git_agentskills_v1']`.
3.  Call `Route.computeRoutes(request)`.
4.  Call `routes[0].createPolylines()` to generate `google.maps.Polyline`
    objects, and bind them to your map via `polyline.setMap(map)`.

```javascript
async function initRoutesMap() {
  const { Map } = await google.maps.importLibrary("maps");
  const { Route } = await google.maps.importLibrary("routes");

  const map = new Map(document.getElementById("map"), {
    zoom: 13,
    center: { lat: 37.78, lng: -122.41 },
    mapId: "DEMO_MAP_ID",
    internalUsageAttributionIds: ["gmp_git_agentskills_v1"],
  });

  // 1. Define a basic routes request using lat/lng coordinates or addresses
  const basicRequest = {
    origin: { lat: 37.7937, lng: -122.3935 }, // 155 Steuart St, SF
    destination: { lat: 37.7885, lng: -122.4083 }, // 450 Powell St, SF
    travelMode: "WALKING",
    fields: ["path", "legs", "viewport"], // Request 'path' for basic polyline, 'legs' for step coordinates
    internalUsageAttributionIds: ["gmp_git_agentskills_v1"],
  };

  // Alternatively, define a traffic-aware routes request:
  const trafficRequest = {
    origin: { lat: 37.7785, lng: -122.3917 }, // 200 King St, SF
    destination: { lat: 37.8087, lng: -122.4117 }, // Pier 41, SF
    travelMode: "DRIVING",
    routingPreference: "TRAFFIC_AWARE",
    extraComputations: ["TRAFFIC_ON_POLYLINE"],
    fields: ["path", "speedPaths", "routeLabels", "viewport"],
    internalUsageAttributionIds: ["gmp_git_agentskills_v1"],
  };

  try {
    const { routes } = await Route.computeRoutes(basicRequest);
    if (!routes || routes.length === 0) return;

    const route = routes[0];

    // Access raw coordinates array (LatLngAltitude[])
    const routeCoordinates = route.path;
    console.log("Route path coordinates:", routeCoordinates);

    // Create and render polylines on the map
    const mapPolylines = route.createPolylines();
    mapPolylines.forEach((polyline) => {
      polyline.setMap(map);
    });

    // Fit map to route viewport
    if (route.viewport) {
      map.fitBounds(route.viewport);
    }
  } catch (error) {
    console.error("Failed to compute routes:", error);
  }
}

initRoutesMap();
```

--------------------------------------------------------------------------------

### Implementation: React (`@vis.gl/react-google-maps`)

When using React, manage the lifecycle of polylines and markers using `useRef`
and `useEffect` cleanup functions to prevent memory leaks and stale polylines
when props change.

Source:
[visgl/react-google-maps - examples/directions/src/app.tsx](https://github.com/visgl/react-google-maps/blob/HEAD/examples/directions/src/app.tsx?utm_campaign=gmp_git_agentskills_v1)

```tsx
import React, { useEffect, useRef } from 'react';
import {
  APIProvider,
  Map,
  useMap,
  useMapsLibrary
} from '@vis.gl/react-google-maps';

interface DirectionsProps {
  origin: google.maps.LatLngLiteral | string;
  destination: google.maps.LatLngLiteral | string;
  travelMode?: google.maps.TravelModeString;
}

export function Directions({
  origin,
  destination,
  travelMode = 'DRIVING'
}: DirectionsProps) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');

  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  useEffect(() => {
    if (!routesLib || !map || !origin || !destination) return;

    // Cancel async operations on unmount
    let isCancelled = false;

    // Clean up previous polylines & markers
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];
    markersRef.current.forEach(m => {
      m.map = null;
    });
    markersRef.current = [];

    const request: google.maps.routes.ComputeRoutesRequest = {
      origin,
      destination,
      travelMode,
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs'],
      internalUsageAttributionIds: ['gmp_git_agentskills_v1']
    } as google.maps.routes.ComputeRoutesRequest;

    routesLib.Route.computeRoutes(request)
      .then(async ({ routes }) => {
        if (isCancelled || !routes || routes.length === 0) return;

        const route = routes[0];

        // Render and append polylines
        const newPolylines = route.createPolylines();
        newPolylines.forEach(polyline => {
          polyline.setOptions({
            strokeColor: '#3b82f6',
            strokeOpacity: 0.85,
            strokeWeight: 6
          });
          polyline.setMap(map);
        });
        polylinesRef.current = newPolylines;

        // Render waypoint advanced markers
        const newMarkers = await route.createWaypointAdvancedMarkers();
        if (isCancelled) return;

        newMarkers.forEach(marker => {
          marker.map = map;
        });
        markersRef.current = newMarkers;

        if (route.viewport) map.fitBounds(route.viewport);
      })
      .catch(err => {
        if (isCancelled) return;
        console.error('Error computing routes:', err);
      });

    return () => {
      isCancelled = true;
      polylinesRef.current.forEach(p => p.setMap(null));
      polylinesRef.current = [];
      markersRef.current.forEach(marker => {
        marker.map = null;
      });
      markersRef.current = [];
    };
  }, [routesLib, map, origin, destination, travelMode]);

  return null;
}

export const App = () => (
  <APIProvider apiKey={process.env.GOOGLE_MAPS_API_KEY as string}>
    <Map
      mapId={'bf51a910020fa25a'}
      defaultCenter={{ lat: -23.588363, lng: -46.658475 }}
      defaultZoom={15}
      internalUsageAttributionIds={['gmp_git_agentskills_v1']}>
      <Directions
        origin={{ lat: -23.5955, lng: -46.6431 }}
        destination={{ lat: -23.5883, lng: -46.6584 }}
        travelMode="DRIVING"
      />
    </Map>
  </APIProvider>
);
```

--------------------------------------------------------------------------------

## 2. Extracting Step-by-Step Coordinates (`DirectionsService`)

When working with `google.maps.DirectionsService` and
`google.maps.DirectionsRenderer`, the `DirectionsResult` object contains
`routes[0].legs`, where each leg consists of an array of `steps`. Each step
provides `start_location`, `end_location`, `path` (an array of `LatLng`
coordinates describing the step's geometry), and `instructions`.

### Iterating Over Route Steps and Coordinates

Source:
[googlemaps/js-samples - samples/directions-complex/index.ts](https://github.com/googlemaps/js-samples/blob/HEAD/samples/directions-complex/index.ts?utm_campaign=gmp_git_agentskills_v1)

```typescript
function initMap(): void {
  const markerArray: google.maps.Marker[] = [];
  const directionsService = new google.maps.DirectionsService();

  const map = new google.maps.Map(
    document.getElementById("map") as HTMLElement,
    {
      zoom: 13,
      center: { lat: 40.771, lng: -73.974 },
      internalUsageAttributionIds: ["gmp_git_agentskills_v1"],
    }
  );

  const directionsRenderer = new google.maps.DirectionsRenderer({ map: map });
  const stepDisplay = new google.maps.InfoWindow();

  calculateAndDisplayRoute(
    directionsRenderer,
    directionsService,
    markerArray,
    stepDisplay,
    map
  );
}

function calculateAndDisplayRoute(
  directionsRenderer: google.maps.DirectionsRenderer,
  directionsService: google.maps.DirectionsService,
  markerArray: google.maps.Marker[],
  stepDisplay: google.maps.InfoWindow,
  map: google.maps.Map
) {
  // First, remove any existing markers from the map.
  for (let i = 0; i < markerArray.length; i++) {
    markerArray[i].setMap(null);
  }

  directionsService
    .route({
      origin: { lat: 40.771, lng: -73.974 },
      destination: { lat: 40.758, lng: -73.9855 },
      travelMode: google.maps.TravelMode.WALKING,
    })
    .then((result: google.maps.DirectionsResult) => {
      directionsRenderer.setDirections(result);
      showSteps(result, markerArray, stepDisplay, map);
    })
    .catch((e) => {
      window.alert("Directions request failed due to " + e);
    });
}

function showSteps(
  directionResult: google.maps.DirectionsResult,
  markerArray: google.maps.Marker[],
  stepDisplay: google.maps.InfoWindow,
  map: google.maps.Map
) {
  const myRoute = directionResult.routes[0].legs[0];

  for (let i = 0; i < myRoute.steps.length; i++) {
    const step = myRoute.steps[i];

    // step.start_location is the LatLng for the start of the step
    // step.path is an array of LatLngs describing the course of this step
    const marker = (markerArray[i] =
      markerArray[i] || new google.maps.Marker());

    marker.setMap(map);
    marker.setPosition(step.start_location);
    attachInstructionText(
      stepDisplay,
      marker,
      step.instructions,
      map
    );
  }
}

function attachInstructionText(
  stepDisplay: google.maps.InfoWindow,
  marker: google.maps.Marker,
  text: string,
  map: google.maps.Map
) {
  google.maps.event.addListener(marker, "click", () => {
    stepDisplay.setContent(text);
    stepDisplay.open(map, marker);
  });
}
```

--------------------------------------------------------------------------------

### Multiple Waypoints & Route Optimization

To calculate directions across more than two coordinates, pass an array of
`DirectionsWaypoint` objects in the `waypoints` property. Set
`optimizeWaypoints: true` to allow the service to reorder intermediate waypoints
for the most efficient route.

Source:
[googlemaps/js-samples - samples/directions-waypoints/index.ts](https://github.com/googlemaps/js-samples/blob/HEAD/samples/directions-waypoints/index.ts?utm_campaign=gmp_git_agentskills_v1)

```typescript
function calculateRouteWithWaypoints(
  directionsService: google.maps.DirectionsService,
  directionsRenderer: google.maps.DirectionsRenderer
) {
  const waypts: google.maps.DirectionsWaypoint[] = [
    { location: { lat: 41.8781, lng: -87.6298 }, stopover: true },
    { location: { lat: 38.627, lng: -90.1994 }, stopover: true },
  ];

  directionsService
    .route({
      origin: { lat: 44.9778, lng: -93.265 },
      destination: { lat: 32.7767, lng: -96.797 },
      waypoints: waypts,
      optimizeWaypoints: true,
      travelMode: google.maps.TravelMode.DRIVING,
    })
    .then((response) => {
      directionsRenderer.setDirections(response);

      const route = response.routes[0];
      // Each stopover waypoint splits the route into separate legs
      for (let i = 0; i < route.legs.length; i++) {
        const leg = route.legs[i];
        console.log(
          `Segment ${i + 1}: ${leg.start_address} to ${leg.end_address} (${leg.distance?.text})`
        );
      }
    })
    .catch((e) => window.alert("Directions request failed due to " + e));
}
```

--------------------------------------------------------------------------------

## 3. Error Handling & Transient Retries

When making directions or routing requests in production applications,
differentiate between transient network/quota errors and permanent client
errors:

-   **Retryable Transient Statuses:** `OVER_QUERY_LIMIT` and `UNKNOWN_ERROR`
-   **Non-Transient Statuses (Do Not Retry):** `INVALID_REQUEST`, `NOT_FOUND`,
    `ZERO_RESULTS`, `REQUEST_DENIED`

Source:
[googlemaps/extended-component-library - directions_controller.ts](https://github.com/googlemaps/extended-component-library/blob/HEAD/src/place_building_blocks/place_distance_label/directions_controller.ts?utm_campaign=gmp_git_agentskills_v1)

```typescript
function isTransientDirectionsError(error: unknown): boolean {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as google.maps.MapsRequestError).code;
    return (
      code === google.maps.DirectionsStatus.OVER_QUERY_LIMIT ||
      code === google.maps.DirectionsStatus.UNKNOWN_ERROR
    );
  }
  return false;
}
```
