"use client";

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// Dynamically import the RideMap to avoid SSR issues with Google Maps
const RideMap = dynamic(() => import('@/components/RideMap'), { 
    ssr: false,
    loading: () => <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading Navigation...</div>
});

export default function RidePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RideMap height="100vh" />
    </Suspense>
  );
}
