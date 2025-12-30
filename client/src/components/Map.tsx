/**
 * GOOGLE MAPS FRONTEND INTEGRATION - ESSENTIAL GUIDE
 *
 * USAGE FROM PARENT COMPONENT:
 * ======
 *
 * const mapRef = useRef<google.maps.Map | null>(null);
 *
 * <MapView
 *   initialCenter={{ lat: 40.7128, lng: -74.0060 }}
 *   initialZoom={15}
 *   onMapReady={(map) => {
 *     mapRef.current = map; // Store to control map from parent anytime, google map itself is in charge of the re-rendering, not react state.
 * </MapView>
 *
 * ======
 * Available Libraries and Core Features:
 * -------------------------------
 * 📍 MARKER (from `marker` library)
 * - Attaches to map using { map, position }
 * new google.maps.marker.AdvancedMarkerElement({
 *   map,
 *   position: { lat: 37.7749, lng: -122.4194 },
 *   title: "San Francisco",
 * });
 *
 * -------------------------------
 * 🏢 PLACES (from `places` library)
 * - Does not attach directly to map; use data with your map manually.
 * const place = new google.maps.places.Place({ id: PLACE_ID });
 * await place.fetchFields({ fields: ["displayName", "location"] });
 * map.setCenter(place.location);
 * new google.maps.marker.AdvancedMarkerElement({ map, position: place.location });
 *
 * -------------------------------
 * 🧭 GEOCODER (from `geocoding` library)
 * - Standalone service; manually apply results to map.
 * const geocoder = new google.maps.Geocoder();
 * geocoder.geocode({ address: "New York" }, (results, status) => {
 *   if (status === "OK" && results[0]) {
 *     map.setCenter(results[0].geometry.location);
 *     new google.maps.marker.AdvancedMarkerElement({
 *       map,
 *       position: results[0].geometry.location,
 *     });
 *   }
 * });
 *
 * -------------------------------
 * 📐 GEOMETRY (from `geometry` library)
 * - Pure utility functions; not attached to map.
 * const dist = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
 *
 * -------------------------------
 * 🛣️ ROUTES (from `routes` library)
 * - Combines DirectionsService (standalone) + DirectionsRenderer (map-attached)
 * const directionsService = new google.maps.DirectionsService();
 * const directionsRenderer = new google.maps.DirectionsRenderer({ map });
 * directionsService.route(
 *   { origin, destination, travelMode: "DRIVING" },
 *   (res, status) => status === "OK" && directionsRenderer.setDirections(res)
 * );
 *
 * -------------------------------
 * 🌦️ MAP LAYERS (attach directly to map)
 * - new google.maps.TrafficLayer().setMap(map);
 * - new google.maps.TransitLayer().setMap(map);
 * - new google.maps.BicyclingLayer().setMap(map);
 *
 * -------------------------------
 * ✅ SUMMARY
 * - "map-attached" → AdvancedMarkerElement, DirectionsRenderer, Layers.
 * - "standalone" → Geocoder, DirectionsService, DistanceMatrixService, ElevationService.
 * - "data-only" → Place, Geometry utilities.
 */

/// <reference types="@types/google.maps" />

import { useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: typeof google;
    __mapsScriptLoading?: Promise<void>;
  }
}

const API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
const FORGE_BASE_URL =
  import.meta.env.VITE_FRONTEND_FORGE_API_URL ||
  "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;

/**
 * Load Google Maps script with singleton pattern to prevent duplicate loads.
 * Uses a global promise to ensure only one script is loaded even with concurrent calls.
 */
function loadMapScript(): Promise<void> {
  // If script is already loaded, return immediately
  if (window.google?.maps) {
    return Promise.resolve();
  }

  // If script is currently loading, return the existing promise
  if (window.__mapsScriptLoading) {
    return window.__mapsScriptLoading;
  }

  // Create a new loading promise
  window.__mapsScriptLoading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${MAPS_PROXY_URL}/maps/api/js?key=${API_KEY}&v=weekly&libraries=marker,places,geocoding,geometry`;
    script.async = true;
    script.crossOrigin = "anonymous";
    
    script.onload = () => {
      resolve();
    };
    
    script.onerror = () => {
      // Clear the loading promise so it can be retried
      window.__mapsScriptLoading = undefined;
      reject(new Error("Failed to load Google Maps script"));
    };
    
    document.head.appendChild(script);
  });

  return window.__mapsScriptLoading;
}

interface MapViewProps {
  className?: string;
  initialCenter?: google.maps.LatLngLiteral;
  initialZoom?: number;
  onMapReady?: (map: google.maps.Map) => void;
}

export function MapView({
  className,
  initialCenter = { lat: 37.7749, lng: -122.4194 },
  initialZoom = 12,
  onMapReady,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const isMountedRef = useRef(true);

  const initMap = useCallback(async () => {
    try {
      await loadMapScript();
      
      // Check if component is still mounted after async operation
      if (!isMountedRef.current) {
        return;
      }
      
      if (!mapContainer.current) {
        console.error("Map container not found");
        return;
      }
      
      // Only create map if not already created
      if (!mapInstance.current) {
        mapInstance.current = new window.google!.maps.Map(mapContainer.current, {
          zoom: initialZoom,
          center: initialCenter,
          mapTypeControl: true,
          fullscreenControl: true,
          zoomControl: true,
          streetViewControl: true,
          mapId: "DEMO_MAP_ID",
        });
        
        // Only call onMapReady if still mounted
        if (isMountedRef.current && onMapReady) {
          onMapReady(mapInstance.current);
        }
      }
    } catch (error) {
      console.error("Error initializing map:", error);
    }
  }, [initialCenter, initialZoom, onMapReady]);

  useEffect(() => {
    isMountedRef.current = true;
    initMap();
    
    return () => {
      isMountedRef.current = false;
      // Clean up map instance on unmount
      if (mapInstance.current) {
        // Google Maps doesn't have a destroy method, but we can clear the reference
        mapInstance.current = null;
      }
    };
  }, [initMap]);

  return (
    <div ref={mapContainer} className={cn("w-full h-[500px]", className)} />
  );
}
