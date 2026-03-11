"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow, TrafficLayer } from '@react-google-maps/api';
import axios from 'axios';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { ScrollPanel } from 'primereact/scrollpanel';

const mapContainerStyle = { width: '100%', height: '100%' };
const BENGALURU_CENTER = { lat: 12.9716, lng: 77.5946 };
const LIBRARIES = ['places', 'geometry'];

const EvacuationMap = ({ height = '100vh' }) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES
  });

  const [map, setMap] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [shelters] = useState([
    { id: 1, name: "Chinnaswamy Stadium Shelter", location: "Cubbon Road, Bengaluru", position: { lat: 12.9784, lng: 77.5983 }, status: "open", capacity: "250/5000", image: "https://images.unsplash.com/photo-1540749969246-3359ff9e82c5?auto=format&fit=crop&w=400&q=80", type: "Mass Shelter" },
    { id: 2, name: "Kanteerava Indoor Stadium", location: "Kasturba Road, Bengaluru", position: { lat: 12.9696, lng: 77.5925 }, status: "crowded", capacity: "1800/2000", image: "https://images.unsplash.com/photo-1577416414302-f36809918231?auto=format&fit=crop&w=400&q=80", type: "Emergency Shelter" },
    { id: 3, name: "Bangalore Football Stadium", location: "Ashok Nagar, Bengaluru", position: { lat: 12.9701, lng: 77.6101 }, status: "closed", capacity: "Full", image: "https://images.unsplash.com/photo-1599153066743-08810dc8a419?auto=format&fit=crop&w=400&q=80", type: "Out of Service" },
    { id: 4, name: "Victoria Hospital Annex", location: "Kalasipalyam, Bengaluru", position: { lat: 12.9622, lng: 77.5756 }, status: "open", capacity: "50/300", image: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=400&q=80", type: "Medical Shelter" },
    { id: 5, name: "Bowring Hospital", location: "Shivajinagar, Bengaluru", position: { lat: 12.9841, lng: 77.6033 }, status: "open", capacity: "120/400", image: "https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=400&q=80", type: "Medical Shelter" },
    { id: 6, name: "Cubbon Park Refuge", location: "Seshadri Road, Bengaluru", position: { lat: 12.9754, lng: 77.5912 }, status: "open", capacity: "15/500", image: "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=400&q=80", type: "Outdoor Refuge" },
    { id: 7, name: "Lalbagh West Gate", location: "Jayanagar, Bengaluru", position: { lat: 12.9461, lng: 77.5851 }, status: "open", capacity: "45/400", image: "https://images.unsplash.com/photo-1596464716127-f2a82984de30?auto=format&fit=crop&w=400&q=80", type: "Safe Zone" },
    { id: 8, name: "Jayanagar Complex", location: "Jayanagar, Bengaluru", position: { lat: 12.9284, lng: 77.5828 }, status: "crowded", capacity: "145/150", image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=80", type: "Urban Shelter" },
    { id: 9, name: "Malleshwaram Sports Club", location: "Malleshwaram, Bengaluru", position: { lat: 12.9922, lng: 77.5714 }, status: "open", capacity: "80/1000", image: "https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=400&q=80", type: "Community Shelter" },
    { id: 10, name: "Indiranagar Colony Hall", location: "Indiranagar, Bengaluru", position: { lat: 12.9772, lng: 77.6433 }, status: "closed", capacity: "Full", image: "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=400&q=80", type: "Private Refuge" }
  ]);
  
  // State for active route segments and directions
  const [routeData, setRouteData] = useState({ id: 0, segments: [], instructions: [] });
  const [selectedShelter, setSelectedShelter] = useState(null);
  const [hoveredMarker, setHoveredMarker] = useState(null);
  const [hoveredIncident, setHoveredIncident] = useState(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [activeFilters, setActiveFilters] = useState([0,1,2,3,4,5,6,7,8,9,10,11,14]); // All incident categories on by default
  
  // Ref for AbortController
  const abortControllerRef = React.useRef(null);

  const onLoad = useCallback((map) => { setMap(map); }, []);
  const onUnmount = useCallback(() => { setMap(null); }, []);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
        (err) => console.warn("Geolocation denied:", err),
        { enableHighAccuracy: true }
      );
    }
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // TomTom iconCategory to icon/color mapping
  const INCIDENT_ICONS = {
    0: { label: 'Unknown', color: '#6b7280', icon: '❓' },
    1: { label: 'Accident', color: '#dc2626', icon: '🚨' },
    2: { label: 'Fog', color: '#9ca3af', icon: '🌫️' },
    3: { label: 'Dangerous', color: '#dc2626', icon: '⚠️' },
    4: { label: 'Rain', color: '#3b82f6', icon: '🌧️' },
    5: { label: 'Ice', color: '#60a5fa', icon: '🧊' },
    6: { label: 'Jam', color: '#f59e0b', icon: '🚗' },
    7: { label: 'Lane Closed', color: '#f97316', icon: '🚧' },
    8: { label: 'Road Closed', color: '#dc2626', icon: '⛔' },
    9: { label: 'Road Works', color: '#f97316', icon: '🔧' },
    10: { label: 'Wind', color: '#6366f1', icon: '💨' },
    11: { label: 'Flooding', color: '#2563eb', icon: '🌊' },
    14: { label: 'Broken Vehicle', color: '#eab308', icon: '🚙' },
  };

  const fetchIncidents = useCallback(async () => {
    try {
      const apiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
      // Fixed Bengaluru-wide bounding box
      const bbox = '77.4,12.8,77.8,13.1';
      const fields = encodeURIComponent('{incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code},from,to}}}');
      
      const url = `https://api.tomtom.com/traffic/services/5/incidentDetails?key=${apiKey}&bbox=${bbox}&fields=${fields}&language=en-GB&timeValidityFilter=present`;
      const response = await axios.get(url);
      
      const fetched = response.data?.incidents || [];
      console.log(`Fetched ${fetched.length} incidents from TomTom v5`);
      setIncidents(fetched);
    } catch (error) {
      console.error("Traffic update error:", error);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 600000);
    return () => clearInterval(interval);
  }, [fetchIncidents]);

  const calculateRoute = async (shelter) => {
    const startPos = userLocation || { lat: 12.9756, lng: 77.6067 };
    
    // Abort previous request if any
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    setLoadingRoute(true);
    setSelectedShelter(shelter);
    // Explicitly clear current route to ensure no overlap if next one fails
    setRouteData({ id: 0, segments: [], instructions: [] });

    try {
      const apiKey = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
      const start = `${startPos.lat},${startPos.lng}`;
      const end = `${shelter.position.lat},${shelter.position.lng}`;
      
      // Request detailed traffic and incident sections, plus turn-by-turn text guidance
      const url = `https://api.tomtom.com/routing/1/calculateRoute/${start}:${end}/json?key=${apiKey}&traffic=true&routeType=fastest&sectionType=traffic&instructionsType=text&language=en-GB`;
      
      const response = await axios.get(url, { signal: abortControllerRef.current.signal });
      if (response.data?.routes?.[0]) {
        const route = response.data.routes[0];
        const points = route.legs?.[0]?.points || [];
        const sections = route.sections || [];
        let segments = [];

        // Always draw the base route (Clear/Blue) beneath everything
        if (points.length > 0) {
            segments.push({ 
                id: `seg-base`,
                path: points.map(p => ({ lat: p.latitude, lng: p.longitude })), 
                color: "#3b82f6" 
            });
        }

        if (sections.length > 0) {
            sections.forEach((sec, idx) => {
                const sectionPoints = points.slice(sec.startPointIndex, sec.endPointIndex + 1).map(p => ({ lat: p.latitude, lng: p.longitude }));
                let color = "transparent"; // Default no overlay unless traffic
                
                // Color based on traffic magnitude/delay
                if (sec.sectionType === "TRAFFIC" || (sec.delayInSeconds && sec.delayInSeconds > 0)) {
                    if (sec.delayInSeconds > 60) color = "#dc2626"; // Red (Critical)
                    else if (sec.delayInSeconds > 10) color = "#f59e0b"; // Orange (Moderate)
                }
                
                if(color !== "transparent") {
                    segments.push({ 
                        id: `seg-${idx}`,
                        path: sectionPoints, 
                        color 
                    });
                }
            });
        }

        const instructions = route.guidance?.instructions || [];
        setRouteData({ id: 1, segments, instructions });
        if (map) {
            const bounds = new window.google.maps.LatLngBounds();
            points.forEach(p => bounds.extend({ lat: p.latitude, lng: p.longitude }));
            map.fitBounds(bounds, { padding: 50 });
        }
      }
    } catch (error) {
      if (axios.isCancel(error)) {
        console.log("Request cancelled");
      } else {
        console.error("Routing error:", error);
      }
    } finally {
      setLoadingRoute(false);
    }
  };

  useEffect(() => {
    if (routeData.segments.length > 0) {
      console.log(`Rendering route with ${routeData.segments.length} segments`);
    }
  }, [routeData]);

  const filteredShelters = useMemo(() => 
    shelters.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.location.toLowerCase().includes(searchQuery.toLowerCase())),
    [searchQuery, shelters]
  );

  // Helper: get incident position from GeoJSON
  const getIncidentPosition = (incident) => {
    const geom = incident.geometry;
    if (geom.type === 'Point') {
      return { lat: geom.coordinates[1], lng: geom.coordinates[0] };
    } else if (geom.type === 'LineString') {
      // Use midpoint of LineString for marker
      const mid = Math.floor(geom.coordinates.length / 2);
      return { lat: geom.coordinates[mid][1], lng: geom.coordinates[mid][0] };
    }
    return null;
  };

  // Helper: get incident description
  const getIncidentLabel = (incident) => {
    const props = incident.properties;
    const cat = INCIDENT_ICONS[props.iconCategory] || INCIDENT_ICONS[0];
    const desc = props.events?.[0]?.description || cat.label;
    const road = [props.from, props.to].filter(Boolean).join(' → ');
    return { category: cat, description: desc, road };
  };

  if (!isLoaded) return <div className="p-4">Loading Map...</div>;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden', fontFamily:'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', background:'#eef1f6' }}>
      
      {/* ═══ HEADER (full width) ═══ */}
      <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 16px', background:'#fff', borderBottom:'1px solid rgba(0,0,0,0.06)', zIndex:10, flexShrink:0, boxShadow:'0 1px 4px rgba(0,0,0,0.03)' }}>
        {/* Sidebar Toggle */}
        <button 
          onClick={() => setIsSidebarVisible(!isSidebarVisible)} 
          title={isSidebarVisible ? 'Hide sidebar' : 'Show sidebar'}
          style={{ width:'36px', height:'36px', borderRadius:'10px', border:'1px solid rgba(0,0,0,0.08)', background:'#f8f9fb', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'15px', flexShrink:0 }}
        >
          {isSidebarVisible ? '◀' : '☰'}
        </button>

        {/* App Title */}
        <div style={{ fontWeight:'800', fontSize:'14px', color:'#1e293b', flexShrink:0, letterSpacing:'-0.3px' }}>
          🗺️ Evacuation Map
        </div>

        {/* Divider */}
        <div style={{ width:'1px', height:'24px', background:'rgba(0,0,0,0.08)', flexShrink:0 }}></div>

        {/* Incident Filters */}
        <div style={{ display:'flex', gap:'5px', flex:1, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontSize:'11px', fontWeight:'600', color:'#64748b', flexShrink:0, marginRight:'2px' }}>Incidents:</span>
          {[
            { id: 1, icon: '🚨', label: 'Accident' },
            { id: 6, icon: '🚗', label: 'Jam' },
            { id: 8, icon: '⛔', label: 'Closed' },
            { id: 9, icon: '🔧', label: 'Works' },
            { id: 7, icon: '🚧', label: 'Lane' },
            { id: 3, icon: '⚠️', label: 'Danger' },
          ].map(f => {
            const isActive = activeFilters.includes(f.id);
            return (
              <button
                key={f.id}
                onClick={() => setActiveFilters(prev => isActive ? prev.filter(x => x !== f.id) : [...prev, f.id])}
                style={{ 
                  padding:'4px 10px', borderRadius:'20px', border: isActive ? '1.5px solid #3b82f6' : '1px solid rgba(0,0,0,0.08)', 
                  background: isActive ? 'rgba(59,130,246,0.08)' : '#f8f9fb', cursor:'pointer', fontSize:'11px', fontWeight:'600', 
                  color: isActive ? '#2563eb' : '#94a3b8', display:'flex', alignItems:'center', gap:'4px', whiteSpace:'nowrap',
                  transition:'all 0.2s'
                }}
              >
                <span style={{ fontSize:'12px' }}>{f.icon}</span> {f.label}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ width:'1px', height:'24px', background:'rgba(0,0,0,0.08)', flexShrink:0 }}></div>

        {/* Zoom Controls */}
        <div style={{ display:'flex', gap:'4px', flexShrink:0 }}>
          <button onClick={() => map && map.setZoom(map.getZoom() + 1)} title="Zoom In" style={{ width:'32px', height:'32px', borderRadius:'8px', border:'1px solid rgba(0,0,0,0.08)', background:'#f8f9fb', cursor:'pointer', fontSize:'16px', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center', color:'#374151' }}>+</button>
          <button onClick={() => map && map.setZoom(map.getZoom() - 1)} title="Zoom Out" style={{ width:'32px', height:'32px', borderRadius:'8px', border:'1px solid rgba(0,0,0,0.08)', background:'#f8f9fb', cursor:'pointer', fontSize:'16px', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center', color:'#374151' }}>−</button>
        </div>

        {/* Refresh */}
        <button onClick={fetchIncidents} title="Refresh" style={{ width:'36px', height:'36px', borderRadius:'10px', border:'1px solid rgba(0,0,0,0.08)', background:'#f8f9fb', cursor:'pointer', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>🔄</button>
      </div>

      {/* ═══ BODY (sidebar + map) ═══ */}
      <div style={{ display:'flex', flex:1, overflow:'hidden', padding:'10px', gap:'10px' }}>
        
        {/* Sidebar */}
        <div 
          className={`evac-sidebar ${!isSidebarVisible ? 'collapsed' : ''}`}
          style={{ 
            display:'flex', flexDirection:'column', background:'#fff', borderRadius:'14px', 
            boxShadow:'0 2px 12px rgba(0,0,0,0.04)', border:'1px solid rgba(0,0,0,0.05)', overflow:'hidden'
          }}
        >
          {/* Search Header */}
          <div style={{ padding: '14px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#1a1a2e', marginBottom: '10px', letterSpacing: '-0.3px' }}>
              🏠 Shelters
            </div>
            <input 
              className="search-modern"
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              placeholder="Search shelters..." 
              style={{ width: '100%', outline: 'none' }}
            />
          </div>

          {/* Sidebar Content Switcher */}
          <ScrollPanel style={{ width: '100%', height: 'calc(100vh - 150px)' }} className="custom-scrollbar">
            {routeData.instructions && routeData.instructions.length > 0 ? (
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button 
                  onClick={() => { setRouteData({ id: 0, segments: [], instructions: [] }); setSelectedShelter(null); }}
                  style={{ background: 'transparent', border: 'none', color: '#3b82f6', fontWeight: '600', cursor: 'pointer', textAlign: 'left', padding: '4px 0', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginBottom: '4px' }}
                >
                  <span style={{ fontSize: '14px' }}>←</span> Back to Shelters
                </button>
                <div style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', letterSpacing: '-0.2px' }}>
                  Directions to {selectedShelter?.name}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                  Step-by-step guidance
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {routeData.instructions.map((inst, idx) => (
                    <div key={idx} style={{ padding: '12px', background: '#f8f9fb', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.04)', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{ background: '#e0e7ff', color: '#3b82f6', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>
                        {idx + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12.5px', color: '#334155', fontWeight: '500', lineHeight: '1.4' }}>
                          {inst.message}
                        </div>
                        {inst.routeOffsetInMeters > 0 && (
                          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', fontWeight: '600' }}>
                            Distance to next step: {inst.routeOffsetInMeters > 1000 ? (inst.routeOffsetInMeters/1000).toFixed(1) + ' km' : inst.routeOffsetInMeters + ' m'}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredShelters.map(shelter => {
                  const isSelected = selectedShelter?.id === shelter.id;
                  return (
                    <div 
                      key={shelter.id}
                      className={`shelter-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => calculateRoute(shelter)}
                      style={{ padding: '10px', cursor: 'pointer', display: 'flex', gap: '10px' }}
                    >
                      <div style={{ width: '64px', height: '64px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: '#f1f5f9' }}>
                        <img src={shelter.image} alt={shelter.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.src = 'https://placehold.co/400x400?text=Shelter'; }} />
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflow: 'hidden', minWidth: 0 }}>
                        <div>
                          <div style={{ fontSize: '9px', fontWeight: '600', textTransform: 'uppercase', color: isSelected ? '#2563eb' : '#94a3b8', letterSpacing: '0.5px', marginBottom: '1px' }}>{shelter.type}</div>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: isSelected ? '#1e3a8a' : '#1e293b', lineHeight: '1.3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shelter.name}</div>
                          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                            <span style={{ fontSize: '9px' }}>📍</span> {shelter.location}
                          </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                          <span className={`status-badge ${shelter.status === 'open' ? 'status-open' : (shelter.status === 'crowded' ? 'status-limited' : 'status-closed')}`}>
                            {shelter.status === 'open' ? '● Available' : (shelter.status === 'crowded' ? '● Limited' : '● Closed')}
                          </span>
                          <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600' }}>{shelter.capacity}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollPanel>
        </div>

        {/* Map Container */}
        <div style={{ flex:1, position:'relative', borderRadius:'14px', overflow:'hidden', boxShadow:'0 2px 12px rgba(0,0,0,0.04)', border:'1px solid rgba(0,0,0,0.05)' }}>
          {/* Loading Overlay */}
          {loadingRoute && (
            <div style={{ position:'absolute', inset:0, zIndex:4, background:'rgba(255,255,255,0.4)', backdropFilter:'blur(2px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ background:'#fff', padding:'14px 24px', borderRadius:'12px', boxShadow:'0 4px 20px rgba(0,0,0,0.1)', display:'flex', alignItems:'center', gap:'10px' }}>
                <span style={{ fontSize:'18px' }}>⏳</span>
                <span style={{ fontWeight:'700', color:'#1e293b', fontSize:'13px' }}>Calculating Safest Route...</span>
              </div>
            </div>
          )}

          <GoogleMap
            key={routeData.id || 'initial-map'}
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={userLocation || BENGALURU_CENTER}
            zoom={13}
            onLoad={onLoad}
            onUnmount={onUnmount}
            options={{
              disableDefaultUI: false,
              zoomControl: false,
              fullscreenControl: true,
              streetViewControl: true,
              mapTypeControl: false,
              gestureHandling: 'greedy',
              styles: [
                { "featureType": "poi", "stylers": [{ "visibility": "off" }] },
                { "featureType": "transit", "stylers": [{ "visibility": "off" }] }
            ]
          }}
        >
          <TrafficLayer />

          {/* User Marker */}
          <Marker 
            position={userLocation || { lat: 12.9756, lng: 77.6067 }} 
            icon={{ url: 'https://maps.google.com/mapfiles/kml/pal4/icon62.png', scaledSize: new window.google.maps.Size(42, 42) }}
            zIndex={200}
            title="Your Location"
          />

          {/* Shelters */}
          {shelters.map(shelter => (
            <React.Fragment key={shelter.id}>
              {/* Pulse effect for selected shelter */}
              {selectedShelter?.id === shelter.id && (
                <Marker 
                  position={shelter.position}
                  zIndex={150}
                  icon={{
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 25,
                    fillColor: "#3b82f6",
                    fillOpacity: 0.2,
                    strokeWeight: 2,
                    strokeColor: "#3b82f6"
                  }}
                />
              )}
              <Marker
                position={shelter.position}
                label={shelter.status === 'closed' ? "CLOSED" : ""}
                icon={{
                    url: shelter.status === 'closed' ? 'https://maps.google.com/mapfiles/kml/pal2/icon11.png' : 'https://maps.google.com/mapfiles/kml/pal2/icon10.png',
                    scaledSize: new window.google.maps.Size(35, 35)
                }}
                zIndex={selectedShelter?.id === shelter.id ? 160 : 120}
                onClick={() => {
                    setHoveredMarker(shelter);
                    calculateRoute(shelter);
                }}
              />
            </React.Fragment>
          ))}

          {/* Shelter InfoWindow - click-based, no flicker */}
          {hoveredMarker && (
            <InfoWindow 
              position={hoveredMarker.position} 
              onCloseClick={() => setHoveredMarker(null)}
              options={{ pixelOffset: new window.google.maps.Size(0, -35) }}
            >
              <div className="p-1 min-w-8rem text-center">
                <div className="font-bold text-sm text-gray-900">{hoveredMarker.name}</div>
                <div className="text-xs text-500 mt-1">{hoveredMarker.capacity} capacity</div>
              </div>
            </InfoWindow>
          )}

          {/* Incident InfoWindow */}
          {hoveredIncident && (() => {
            const pos = getIncidentPosition(hoveredIncident);
            const info = getIncidentLabel(hoveredIncident);
            return pos ? (
              <InfoWindow position={pos} onCloseClick={() => setHoveredIncident(null)}>
                <div style={{ padding: '4px', maxWidth: '220px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '11px', color: info.category.color, textTransform: 'uppercase', marginBottom: '4px' }}>
                    {info.category.icon} {info.category.label}
                  </div>
                  <div style={{ fontSize: '11px', color: '#374151', lineHeight: '1.4' }}>{info.description}</div>
                  {info.road && <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>📍 {info.road}</div>}
                </div>
              </InfoWindow>
            ) : null;
          })()}

          {/* ACTIVE ROUTE SEGMENTS - Multi-colored for traffic */}
          <React.Fragment key={routeData.id || 'no-route'}>
            {routeData.segments && routeData.segments.map((seg) => (
              <Polyline
                key={seg.id}
                path={seg.path}
                options={{
                  strokeColor: seg.color,
                  strokeOpacity: 1,
                  strokeWeight: 10,
                  zIndex: 145,
                  geodesic: true
                }}
              />
            ))}
          </React.Fragment>

          {/* TomTom v5 Incidents - Filtered by activeFilters */}
          {incidents.filter(inc => activeFilters.includes(inc.properties?.iconCategory)).map((incident, idx) => {
            const pos = getIncidentPosition(incident);
            if (!pos) return null;
            const cat = INCIDENT_ICONS[incident.properties?.iconCategory] || INCIDENT_ICONS[0];
            const geom = incident.geometry;

            // Render LineString as colored polyline + marker
            if (geom.type === 'LineString') {
                const path = geom.coordinates.map(c => ({ lat: c[1], lng: c[0] }));
                return (
                  <React.Fragment key={`inc-${idx}`}>
                    <Polyline 
                      path={path}
                      options={{ strokeColor: cat.color, strokeOpacity: 0.8, strokeWeight: 5, zIndex: 130 }}
                    />
                    <Marker
                      position={pos}
                      label={{ text: cat.icon, fontSize: '16px' }}
                      icon={{
                        path: window.google.maps.SymbolPath.CIRCLE,
                        fillColor: cat.color, fillOpacity: 0.9,
                        strokeWeight: 2, strokeColor: '#ffffff',
                        scale: 14
                      }}
                      zIndex={140}
                      onClick={() => setHoveredIncident(incident)}
                    />
                  </React.Fragment>
                );
            }

            // Render Point as icon marker
            return (
              <Marker
                key={`inc-${idx}`}
                position={pos}
                label={{ text: cat.icon, fontSize: '14px' }}
                icon={{
                  path: window.google.maps.SymbolPath.CIRCLE,
                  fillColor: cat.color, fillOpacity: 0.9,
                  strokeWeight: 2, strokeColor: '#ffffff',
                  scale: 12
                }}
                zIndex={140}
                onClick={() => setHoveredIncident(incident)}
              />
            );
          })}
        </GoogleMap>
        
        {/* Legend */}
        <div style={{ position:'absolute', bottom:'12px', left:'12px', zIndex:3, padding:'10px 12px', borderRadius:'10px', background:'rgba(255,255,255,0.92)', backdropFilter:'blur(12px)', boxShadow:'0 4px 16px rgba(0,0,0,0.06)', border:'1px solid rgba(0,0,0,0.05)', fontSize:'11px', display:'flex', flexDirection:'column', gap:'2px' }}>
            <div style={{ fontWeight:'700', color:'#1e293b', marginBottom:'3px', fontSize:'11px' }}>Legend</div>
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}><span style={{display:'inline-block', width:'14px', height:'4px', borderRadius:'2px', background:'#dc2626'}}></span> Heavy</div>
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}><span style={{display:'inline-block', width:'14px', height:'4px', borderRadius:'2px', background:'#f59e0b'}}></span> Moderate</div>
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}><span style={{display:'inline-block', width:'14px', height:'4px', borderRadius:'2px', background:'#3b82f6'}}></span> Clear</div>
        </div>
        </div>
      </div>
    </div>
  );
};

export default EvacuationMap;
