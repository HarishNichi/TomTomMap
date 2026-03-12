"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import axios from 'axios';

const LIBRARIES = ['places', 'geometry'];

const RideMap = ({ height = '100vh' }) => {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Parse destination from URL
  const destLat = parseFloat(searchParams.get('destLat'));
  const destLng = parseFloat(searchParams.get('destLng'));
  const shelterName = searchParams.get('name') || "Destination";

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES
  });

  const [map, setMap] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [routeData, setRouteData] = useState({ points: [], instructions: [], summary: null });
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  
  // Simulation state
  const [simulatedLocation, setSimulatedLocation] = useState(null);
  const [pointIndex, setPointIndex] = useState(0);
  const [isSimulating, setIsSimulating] = useState(false);

  const onLoad = useCallback(function callback(map) {
    setMap(map);
  }, []);

  const onUnmount = useCallback(function callback(map) {
    setMap(map);
  }, []);

  // 1. Get initial User Location
  useEffect(() => {
    if (navigator.geolocation && !userLocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
            const loc = { lat: position.coords.latitude, lng: position.coords.longitude };
            setUserLocation(loc);
            setSimulatedLocation(loc); // Start simulation here
        },
        (err) => {
            console.warn("Geolocation denied, using default");
            const defLoc = { lat: 12.9756, lng: 77.6067 };
            setUserLocation(defLoc);
            setSimulatedLocation(defLoc);
        },
        { enableHighAccuracy: true }
      );
    }
  }, [userLocation]);

  // 2. Fetch TomTom Route once we have start and end
  useEffect(() => {
    const fetchRoute = async () => {
      if (!userLocation || !destLat || !destLng) return;
      
      try {
        const apiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
        const start = `${userLocation.lat},${userLocation.lng}`;
        const end = `${destLat},${destLng}`;
        
        // Request route with turn-by-turn guidance
        const url = `https://api.tomtom.com/routing/1/calculateRoute/${start}:${end}/json?key=${apiKey}&routeType=fastest&instructionsType=text&language=en-GB`;
        
        const response = await axios.get(url);
        if (response.data?.routes?.[0]) {
          const route = response.data.routes[0];
          const points = route.legs?.[0]?.points.map(p => ({ lat: p.latitude, lng: p.longitude })) || [];
          const instructions = route.guidance?.instructions || [];
          
          setRouteData({ 
              points, 
              instructions,
              summary: route.summary
          });

          // Ensure map bounds cover the whole route initially
          if (map && points.length > 0) {
            const bounds = new window.google.maps.LatLngBounds();
            points.forEach(p => bounds.extend(p));
            map.fitBounds(bounds, { padding: 50 });
            
            // Auto tilt for 3D navigation feel after a tiny delay
            setTimeout(() => {
               map.setZoom(18);
               map.setTilt(45);
               map.setHeading(calculateHeading(points[0], points[1] || points[0]));
               map.panTo(points[0]);
            }, 1500);
          }
        }
      } catch (error) {
        console.error("Routing error:", error);
      }
    };

    fetchRoute();
  }, [userLocation, destLat, destLng, map]);

  // Helper: Calculate bearing between two points for map rotation
  const calculateHeading = (p1, p2) => {
      if(!p1 || !p2) return 0;
      const lat1 = p1.lat * Math.PI / 180;
      const lat2 = p2.lat * Math.PI / 180;
      const dlng = (p2.lng - p1.lng) * Math.PI / 180;
      const y = Math.sin(dlng) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dlng);
      let brng = Math.atan2(y, x);
      brng = brng * 180 / Math.PI;
      return (brng + 360) % 360;
  };

  // 3. Navigation Simulation Loop
  useEffect(() => {
      if (!isSimulating || routeData.points.length === 0) return;

      const interval = setInterval(() => {
          setPointIndex((prevIndex) => {
              const nextIndex = prevIndex + 1;
              if (nextIndex >= routeData.points.length) {
                  setIsSimulating(false);
                  return prevIndex; // Reached destination
              }
              
              const currentP = routeData.points[prevIndex];
              const nextP = routeData.points[nextIndex];
              
              setSimulatedLocation(nextP);
              
              // Update map camera tightly to car
              if (map) {
                  map.setHeading(calculateHeading(currentP, nextP));
                  map.panTo(nextP);
              }

              // Advance instructions if we passed the designated point
              if (routeData.instructions[currentStepIndex + 1]) {
                 const nextInstruction = routeData.instructions[currentStepIndex + 1];
                 // A real app uses a distance threshold, here we simplify by matching index
                 if (nextIndex >= nextInstruction.pointIndex) {
                     setCurrentStepIndex(currentStepIndex + 1);
                 }
              }

              return nextIndex;
          });
      }, 1000); // Move to next coordinate every 1 second (fast simulation)

      return () => clearInterval(interval);
  }, [isSimulating, routeData, map, currentStepIndex]);

  const currentInstruction = routeData.instructions[currentStepIndex];
  const formatDistance = (meters) => {
      if (!meters) return "0 m";
      return meters > 1000 ? (meters/1000).toFixed(1) + ' km' : meters + ' m';
  };

  const formatTime = (seconds) => {
      if (!seconds) return "0 min";
      const m = Math.ceil(seconds / 60);
      return m > 60 ? `${Math.floor(m/60)} hr ${m%60} min` : `${m} min`;
  };

  if (!isLoaded || !destLat) return <div className="p-4 flex h-screen items-center justify-center font-bold text-gray-700">Loading Navigation Engine...</div>;

  return (
    <div style={{ position: 'relative', height, width: '100%', overflow: 'hidden', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        
        {/* TOP HEADER: Turn-by-Turn Instruction Panel */}
        <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
                onClick={() => router.push('/')}
                style={{ alignSelf: 'flex-start', background: 'rgba(255,255,255,0.9)', border: 'none', padding: '8px 16px', borderRadius: '20px', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
                🔙 Exit Navigation
            </button>
            
            {currentInstruction && (
                <div style={{ background: '#1e293b', color: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ fontSize: '32px' }}>
                        {currentInstruction.instructionType === 'TURN' && currentInstruction.message.toLowerCase().includes('left') ? '↖' : 
                         currentInstruction.instructionType === 'TURN' && currentInstruction.message.toLowerCase().includes('right') ? '↗' : '⬆'}
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '24px', fontWeight: '800', lineHeight: '1.2' }}>{currentInstruction.message}</div>
                        {currentInstruction.routeOffsetInMeters > 0 && (
                            <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '4px', fontWeight: '600' }}>
                                In {formatDistance(currentInstruction.routeOffsetInMeters)}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* MAP CONTAINER */}
        <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={userLocation || { lat: 12.9756, lng: 77.6067 }}
            zoom={18}
            options={{
                disableDefaultUI: true, // Hide all google controls for clean UI
                keyboardShortcuts: false,
                clickableIcons: false,
                styles: [ // Dark mode driving theme
                    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
                    { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] },
                    { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }] },
                    { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }] },
                    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }] },
                    { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }] },
                    { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }] },
                    { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }] },
                ]
            }}
            onLoad={onLoad}
            onUnmount={onUnmount}
        >
            {/* The Route Path */}
            {routeData.points.length > 0 && (
                <Polyline
                    path={routeData.points}
                    options={{ strokeColor: '#3b82f6', strokeOpacity: 0.8, strokeWeight: 8, zIndex: 10 }}
                />
            )}

            {/* The "Car" / User Simulated Location */}
            {simulatedLocation && (
                <Marker
                    position={simulatedLocation}
                    icon={{
                        // A simplified car arrow icon
                        path: "M 0,-15 L 10,10 L 0,5 L -10,10 Z",
                        fillColor: '#ffffff',
                        fillOpacity: 1,
                        strokeColor: '#2563eb',
                        strokeWeight: 2,
                        scale: 1.5,
                        rotation: map ? map.getHeading() : 0 
                    }}
                    zIndex={100}
                />
            )}
            
            {/* Destination Marker */}
            <Marker
                position={{ lat: destLat, lng: destLng }}
                label={"🏁"}
                zIndex={50}
            />
        </GoogleMap>

        {/* BOTTOM DASHBOARD: ETA & Controls */}
        <div style={{ position: 'absolute', bottom: '0', left: '0', right: '0', background: 'white', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '20px', paddingBottom: '30px', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end' }}>
                <div>
                    <div style={{ fontSize: '32px', fontWeight: '800', color: '#16a34a', lineHeight: '1' }}>
                        {routeData.summary ? formatTime(routeData.summary.travelTimeInSeconds) : '...'}
                    </div>
                    <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '600', marginTop: '4px' }}>
                        {routeData.summary ? formatDistance(routeData.summary.lengthInMeters) : ''} • ETA {routeData.summary?.arrivalTime ? new Date(routeData.summary.arrivalTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                    </div>
                </div>
                
                <button 
                    onClick={() => setIsSimulating(!isSimulating)}
                    style={{ background: isSimulating ? '#ef4444' : '#2563eb', color: 'white', border: 'none', padding: '14px 32px', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.3)', transition: 'all 0.2s' }}
                >
                    {isSimulating ? 'Stop Sim' : 'Simulator'}
                </button>
            </div>
            
            <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                Driving to <span style={{ color: '#3b82f6' }}>{shelterName}</span>
            </div>
        </div>

    </div>
  );
};

export default RideMap;
