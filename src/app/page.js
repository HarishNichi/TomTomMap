"use client";

import React from 'react';
import EvacuationMap from '@/components/EvacuationMap';

export default function Home() {
  return (
    <main className="h-screen w-screen overflow-hidden">
      <EvacuationMap height="100vh" />
    </main>
  );
}
