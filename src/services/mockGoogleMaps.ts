// Mock Google Maps Service for Demo Mode
// This allows the app to work without a valid Google Maps API key

import type { TravelMode } from './googleMaps';

export interface MockLocation {
  lat: number;
  lng: number;
  address: string;
}

export interface MockRouteData {
  id: string;
  name: string;
  distance: string;
  duration: string;
  safetyScore: number;
  polyline: string;
  steps: MockNavigationStep[];
}

export interface MockNavigationStep {
  instruction: string;
  distance: string;
  duration: string;
  location: MockLocation;
}

class MockGoogleMapsService {
  private mockLocations = [
    { lat: 40.7589, lng: -73.9851, address: 'Times Square, New York, NY' },
    { lat: 40.7614, lng: -73.9776, address: 'Rockefeller Center, New York, NY' },
    { lat: 40.7484, lng: -73.9857, address: 'Empire State Building, New York, NY' },
    { lat: 40.7829, lng: -73.9654, address: 'Central Park, New York, NY' },
    { lat: 40.7580, lng: -73.9855, address: 'Broadway Theater District, New York, NY' },
  ];

  async getCurrentLocation(): Promise<MockLocation> {
    // Simulate API delay
    await this.delay(500);
    
    // Try to get real location if available
    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 5000,
            enableHighAccuracy: false
          });
        });
        
        return {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: 'Current Location'
        };
      } catch (error) {
        console.log('Geolocation not available, using mock location');
      }
    }
    
    // Return mock location
    return this.mockLocations[0];
  }

  async geocodeAddress(address: string): Promise<MockLocation> {
    await this.delay(300);
    
    // Simple mock geocoding
    const lowerAddress = address.toLowerCase();
    
    if (lowerAddress.includes('times square') || lowerAddress.includes('broadway')) {
      return this.mockLocations[0];
    } else if (lowerAddress.includes('rockefeller') || lowerAddress.includes('rock center')) {
      return this.mockLocations[1];
    } else if (lowerAddress.includes('empire')) {
      return this.mockLocations[2];
    } else if (lowerAddress.includes('central park') || lowerAddress.includes('park')) {
      return this.mockLocations[3];
    } else if (lowerAddress.includes('theater')) {
      return this.mockLocations[4];
    }
    
    // Return a random location for unknown addresses
    return {
      lat: 40.7589 + (Math.random() - 0.5) * 0.02,
      lng: -73.9851 + (Math.random() - 0.5) * 0.02,
      address: address
    };
  }

  // Get speed multiplier based on travel mode (minutes per km)
  private getSpeedMultiplier(travelMode: TravelMode): number {
    switch (travelMode) {
      case 'WALKING':
        return 12; // ~5 km/h = 12 min per km
      case 'TWO_WHEELER':
        return 2; // ~30 km/h = 2 min per km
      case 'DRIVING':
        return 2.5; // ~24 km/h in city traffic = 2.5 min per km
      case 'TRANSIT':
        return 4; // ~15 km/h average with stops = 4 min per km
      default:
        return 12;
    }
  }

  // Get travel mode display name
  private getTravelModeName(travelMode: TravelMode): string {
    switch (travelMode) {
      case 'WALKING':
        return 'walking';
      case 'TWO_WHEELER':
        return 'by two-wheeler';
      case 'DRIVING':
        return 'by car';
      case 'TRANSIT':
        return 'by public transport';
      default:
        return '';
    }
  }

  async calculateRoutes(start: string, destination: string, travelMode: TravelMode = 'WALKING'): Promise<MockRouteData[]> {
    await this.delay(800);
    
    const startLoc = await this.geocodeAddress(start);
    const destLoc = await this.geocodeAddress(destination);
    
    // Calculate approximate distance
    const distance = this.calculateDistance(startLoc, destLoc);
    const speedMultiplier = this.getSpeedMultiplier(travelMode);
    const baseTime = Math.round(distance * speedMultiplier);
    
    const modeName = this.getTravelModeName(travelMode);
    
    // Generate 3 routes with different characteristics
    const routes: MockRouteData[] = [
      {
        id: 'route-1',
        name: 'Safest Route',
        distance: `${(distance * 1.15).toFixed(1)} km`,
        duration: `${Math.round(baseTime * 1.15)} min ${modeName}`,
        safetyScore: Math.floor(85 + Math.random() * 10), // 85-95
        polyline: this.generateMockPolyline(startLoc, destLoc, 0.15),
        steps: this.generateMockSteps(startLoc, destLoc, Math.round(baseTime * 1.15))
      },
      {
        id: 'route-2',
        name: 'Balanced Route',
        distance: `${(distance * 1.05).toFixed(1)} km`,
        duration: `${Math.round(baseTime * 1.05)} min ${modeName}`,
        safetyScore: Math.floor(70 + Math.random() * 14), // 70-84
        polyline: this.generateMockPolyline(startLoc, destLoc, 0.05),
        steps: this.generateMockSteps(startLoc, destLoc, Math.round(baseTime * 1.05))
      },
      {
        id: 'route-3',
        name: 'Fastest Route',
        distance: `${distance.toFixed(1)} km`,
        duration: `${baseTime} min ${modeName}`,
        safetyScore: Math.floor(50 + Math.random() * 19), // 50-69
        polyline: this.generateMockPolyline(startLoc, destLoc, 0),
        steps: this.generateMockSteps(startLoc, destLoc, baseTime)
      }
    ];
    
    return routes;
  }

  private calculateDistance(loc1: MockLocation, loc2: MockLocation): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(loc2.lat - loc1.lat);
    const dLng = this.toRad(loc2.lng - loc1.lng);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRad(loc1.lat)) * Math.cos(this.toRad(loc2.lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private generateMockPolyline(start: MockLocation, end: MockLocation, deviation: number): string {
    // Generate a simple encoded polyline (not real encoding, just for demo)
    return `${start.lat},${start.lng}|${end.lat},${end.lng}|${deviation}`;
  }

  private generateMockSteps(start: MockLocation, end: MockLocation, totalMinutes: number): MockNavigationStep[] {
    const numSteps = Math.floor(3 + Math.random() * 4); // 3-6 steps
    const steps: MockNavigationStep[] = [];
    
    const directions = [
      'Head north on Main St',
      'Turn right onto Broadway',
      'Continue straight for 3 blocks',
      'Turn left onto Park Ave',
      'Walk through the well-lit plaza',
      'Turn right onto 5th Avenue',
      'Continue past the shopping district',
      'Turn left onto your destination street'
    ];
    
    const minutesPerStep = Math.floor(totalMinutes / numSteps);
    const distancePerStep = this.calculateDistance(start, end) / numSteps;
    
    for (let i = 0; i < numSteps; i++) {
      const progress = i / numSteps;
      steps.push({
        instruction: directions[i % directions.length],
        distance: `${(distancePerStep * 1000).toFixed(0)} m`,
        duration: `${minutesPerStep} min`,
        location: {
          lat: start.lat + (end.lat - start.lat) * progress,
          lng: start.lng + (end.lng - start.lng) * progress,
          address: `Step ${i + 1}`
        }
      });
    }
    
    // Add final step
    steps.push({
      instruction: 'Arrive at destination',
      distance: '0 m',
      duration: '0 min',
      location: end
    });
    
    return steps;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const mockGoogleMapsService = new MockGoogleMapsService();
