/// <reference types="@types/google.maps" />

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Travel mode type - includes our custom TWO_WHEELER
export type TravelMode = 'WALKING' | 'DRIVING' | 'TRANSIT' | 'TWO_WHEELER';

export interface RouteData {
  id: string;
  name: string;
  type: 'safe' | 'balanced' | 'fastest';
  distance: string;
  duration: string;
  safetyScore: number;
  color: string;
  polyline: string;
  legs: google.maps.DirectionsLeg[];
  warnings: string[];
  summary: string;
  steps: google.maps.DirectionsStep[]; // Added for turn-by-turn navigation
}

export interface Location {
  lat: number;
  lng: number;
  address: string;
}

export interface NavigationStep {
  instruction: string;
  distance: string;
  duration: string;
  maneuver?: string;
  location: {
    lat: number;
    lng: number;
  };
}

// Declare google as a global variable
declare global {
  interface Window {
    google: typeof google;
    __googleMapsScriptLoading?: Promise<void>;
  }
}

// Load Google Maps script dynamically
function loadGoogleMapsScript(): Promise<void> {
  console.log('🚀 Initiating Google Maps script loading...');
  // Return existing promise if script is already being loaded
  if (window.__googleMapsScriptLoading) {
    console.log('🔄 Google Maps script is already loading. Returning existing promise.');
    return window.__googleMapsScriptLoading;
  }

  const promise = new Promise<void>((resolve, reject) => {
    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      console.log('✅ Google Maps already loaded. Resolving immediately.');
      resolve();
      return;
    }

    // Validate API key
    if (!GOOGLE_MAPS_API_KEY || GOOGLE_MAPS_API_KEY === 'your_google_maps_api_key_here') {
      console.error('❌ Google Maps API key is not configured. Please set VITE_GOOGLE_MAPS_API_KEY in .env file');
      reject(new Error('Google Maps API key is not configured'));
      return;
    }

    console.log('🗺️ Loading Google Maps with API key:', GOOGLE_MAPS_API_KEY.substring(0, 10) + '...');
    console.log('📏 Key length:', GOOGLE_MAPS_API_KEY.length, '(should be 39)');
    console.log('✓ Key format valid:', GOOGLE_MAPS_API_KEY.startsWith('AIza'));

    // Check if script is already being loaded
    const existingScript = document.querySelector(
      `script[src*="maps.googleapis.com/maps/api/js"]`
    ) as HTMLScriptElement;
    
    if (existingScript) {
      console.log('🔍 Google Maps script already exists. Waiting for it to load...');
      // Script exists, wait for it to load
      if (window.google && window.google.maps) {
        resolve();
      } else {
        const onLoad = () => {
          console.log('✅ Google Maps script loaded successfully.');
          resolve();
        };
        existingScript.addEventListener('load', onLoad);
        existingScript.addEventListener('error', (e) => {
          console.error('❌ Error loading Google Maps script:', e);
          reject(e);
        });
      }
      return;
    }

    // Create and load the script
    const script = document.createElement('script');
    // Note: "directions" is not a library, it's part of the Maps service
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places,geometry&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    script.referrerPolicy = 'no-referrer-when-downgrade';
    
    // Add global callback for Google Maps
    (window as any).initGoogleMaps = () => {
      console.log('✅ Google Maps loaded successfully');
      delete (window as any).initGoogleMaps;
      script.removeEventListener('error', onError);
      resolve();
    };
    
    const onError = (error: Event) => {
      script.removeEventListener('error', onError);
      delete (window as any).initGoogleMaps;
      console.error('❌ Failed to load Google Maps script:', error);
      console.error('🔍 Troubleshooting:');
      console.error('1. Check if API key is valid');
      console.error('2. Go to Google Cloud Console and enable:');
      console.error('   - Maps JavaScript API');
      console.error('   - Geocoding API');
      console.error('   - Places API');
      console.error('3. **IMPORTANT**: Enable Billing on your project!');
      console.error('4. Check if domain is authorized (or allow all domains)');
      console.error('5. Current URL:', window.location.href);
      reject(new Error('Failed to load Google Maps script'));
    };
    
    script.addEventListener('error', onError);
    document.head.appendChild(script);
  });

  // Store the promise globally to prevent duplicate loading
  window.__googleMapsScriptLoading = promise;
  
  // Clean up the promise after it resolves or rejects
  promise.finally(() => {
    delete window.__googleMapsScriptLoading;
  });

  return promise;
}

class GoogleMapsService {
  private map: google.maps.Map | null = null;
  private directionsService: google.maps.DirectionsService | null = null;
  private directionsRenderers: google.maps.DirectionsRenderer[] = [];
  private isLoaded = false;

  async ensureLoaded(): Promise<void> {
    if (!this.isLoaded) {
      await loadGoogleMapsScript();
      this.isLoaded = true;
    }
  }

  async initMap(mapElement: HTMLElement, center?: { lat: number; lng: number }): Promise<google.maps.Map> {
    console.log('🗺️ initMap called with element:', mapElement?.id);
    
    // Validate map element
    if (!mapElement) {
      throw new Error('Map element is not provided');
    }

    if (!mapElement.offsetParent && mapElement.offsetWidth === 0) {
      console.warn('⚠️ Map container might be hidden or has no size');
    }
    
    console.log('⏳ Ensuring Google Maps script is loaded...');
    await this.ensureLoaded();
    
    // Verify Google Maps is available
    if (!window.google || !window.google.maps) {
      const error = new Error('Google Maps API not available after loading script');
      console.error('❌ ' + error.message);
      throw error;
    }
    
    // If map is already initialized, return it
    if (this.map) {
      console.log('✓ Map already initialized, returning existing instance');
      return this.map;
    }
    
    console.log('🚀 Creating new Google Maps instance...');
    this.map = new google.maps.Map(mapElement, {
      center: center || { lat: 40.7128, lng: -74.0060 }, // Default to NYC
      zoom: 13,
      styles: [
        {
          featureType: 'all',
          elementType: 'geometry',
          stylers: [{ color: '#1a2332' }]
        },
        {
          featureType: 'all',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#8ec3b9' }]
        },
        {
          featureType: 'all',
          elementType: 'labels.text.stroke',
          stylers: [{ color: '#1a2332' }]
        },
        {
          featureType: 'road',
          elementType: 'geometry',
          stylers: [{ color: '#2c3e50' }]
        },
        {
          featureType: 'road',
          elementType: 'geometry.stroke',
          stylers: [{ color: '#1a2332' }]
        },
        {
          featureType: 'water',
          elementType: 'geometry',
          stylers: [{ color: '#0f1821' }]
        }
      ],
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true
    });

    this.directionsService = new google.maps.DirectionsService();
    
    console.log('✅ Map initialized successfully');
    console.log('📍 Map center:', center || { lat: 40.7128, lng: -74.0060 });
    
    return this.map;
  }

  async geocodeAddress(address: string): Promise<Location> {
    await this.ensureLoaded();
    const geocoder = new google.maps.Geocoder();

    return new Promise((resolve, reject) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === 'OK' && results && results[0]) {
          const location = results[0].geometry.location;
          resolve({
            lat: location.lat(),
            lng: location.lng(),
            address: results[0].formatted_address
          });
        } else {
          reject(new Error(`Geocoding failed: ${status}`));
        }
      });
    });
  }

  async getRoutes(
    origin: string,
    destination: string,
    travelTime?: string,
    travelMode: TravelMode = 'WALKING'
  ): Promise<RouteData[]> {
    console.log('🛣️ Getting routes from:', origin, 'to:', destination, 'via:', travelMode);
    
    await this.ensureLoaded();
    
    if (!this.directionsService) {
      throw new Error('Directions service not initialized. Please ensure Google Maps API is loaded.');
    }

    if (!this.map) {
      throw new Error('Map not initialized. Please initialize the map first.');
    }

    // Clear previous route renderers
    this.directionsRenderers.forEach(renderer => renderer.setMap(null));
    this.directionsRenderers = [];

    const routes: RouteData[] = [];

    // Convert our travel mode to Google Maps travel mode
    // Note: TWO_WHEELER uses DRIVING mode but we'll adjust the duration estimate
    const googleTravelMode = this.getGoogleTravelMode(travelMode);

    // Request routes with alternatives
    const request: google.maps.DirectionsRequest = {
      origin,
      destination,
      travelMode: googleTravelMode,
      provideRouteAlternatives: true,
      unitSystem: google.maps.UnitSystem.METRIC
    };

    console.log('📡 Sending directions request to Google Maps API...');
    
    return new Promise((resolve, reject) => {
      this.directionsService!.route(request, (result, status) => {
        console.log('📨 Directions API response status:', status);
        
        if (status === 'OK' && result) {
          console.log('✅ Directions API returned', result.routes.length, 'routes');
          const routesData = result.routes.slice(0, 3); // Get up to 3 routes

          try {
            routesData.forEach((route, index) => {
              const leg = route.legs[0];
              const distance = leg.distance?.text || 'N/A';
              const duration = leg.duration?.text || 'N/A';

              // Calculate a base safety score (will be enhanced by Gemini AI)
              const safetyScore = this.calculateBaseSafetyScore(route, index);

              const routeData: RouteData = {
                id: `route-${index}`,
                name: index === 0 ? 'Safest Route' : index === 1 ? 'Balanced Route' : 'Fastest Route',
                type: index === 0 ? 'safe' : index === 1 ? 'balanced' : 'fastest',
                distance,
                duration,
                safetyScore,
                color: index === 0 ? 'safe' : index === 1 ? 'caution' : 'unsafe',
                polyline: route.overview_polyline,
                legs: route.legs,
                warnings: route.warnings || [],
                summary: route.summary,
                steps: leg.steps || [] // Include steps for turn-by-turn navigation
              };

              routes.push(routeData);
              console.log(`✓ Route ${index + 1}: ${distance}, ${duration}`);

              // Render route on map
              if (this.map) {
                try {
                  const renderer = new google.maps.DirectionsRenderer({
                    map: this.map,
                    directions: result,
                    routeIndex: index,
                    polylineOptions: {
                      strokeColor: this.getRouteColor(index),
                      strokeWeight: index === 0 ? 6 : 4,
                      strokeOpacity: index === 0 ? 0.8 : 0.6
                    },
                    suppressMarkers: false,
                    markerOptions: {
                      visible: index === 0 // Only show markers for the first route
                    }
                  });

                  this.directionsRenderers.push(renderer);
                  console.log(`✓ Route ${index + 1} rendered on map`);
                } catch (renderError) {
                  console.warn(`⚠️ Failed to render route ${index + 1}:`, renderError);
                }
              }
            });

            // Fit map to show all routes
            if (this.map && result.routes[0]) {
              try {
                const bounds = new google.maps.LatLngBounds();
                result.routes[0].legs[0].steps.forEach(step => {
                  bounds.extend(step.start_location);
                  bounds.extend(step.end_location);
                });
                this.map.fitBounds(bounds);
                console.log('✓ Map fitted to show all routes');
              } catch (boundsError) {
                console.warn('⚠️ Failed to fit map bounds:', boundsError);
              }
            }

            console.log('✅ Successfully processed', routes.length, 'routes');
            resolve(routes);
          } catch (processingError) {
            console.error('❌ Error processing routes:', processingError);
            reject(new Error(`Failed to process routes: ${processingError}`));
          }
        } else {
          const statusMessage = `Directions API error: ${status}`;
          console.error('❌ ' + statusMessage);
          
          if (status === 'ZERO_RESULTS') {
            reject(new Error('No routes found. Please check your origin and destination.'));
          } else if (status === 'NOT_FOUND') {
            reject(new Error('Origin or destination not found. Please check your addresses.'));
          } else if (status === 'REQUEST_DENIED') {
            reject(new Error('Google Maps request denied. Check your API key and permissions.'));
          } else {
            reject(new Error(statusMessage));
          }
        }
      });
    });
  }

  // Convert our travel mode to Google Maps travel mode
  private getGoogleTravelMode(travelMode: TravelMode): google.maps.TravelMode {
    switch (travelMode) {
      case 'WALKING':
        return google.maps.TravelMode.WALKING;
      case 'DRIVING':
        return google.maps.TravelMode.DRIVING;
      case 'TWO_WHEELER':
        // Google Maps doesn't have a specific two-wheeler mode
        // We use DRIVING and adjust speed estimates
        return google.maps.TravelMode.DRIVING;
      case 'TRANSIT':
        return google.maps.TravelMode.TRANSIT;
      default:
        return google.maps.TravelMode.WALKING;
    }
  }

  private calculateBaseSafetyScore(route: google.maps.DirectionsRoute, index: number): number {
    // Base score calculation (simplified)
    // In a real app, this would consider:
    // - Street lighting data
    // - Crime statistics
    // - Foot traffic patterns
    // - Time of day
    
    let score = 70; // Base score

    // Prefer routes with more steps (more populated areas)
    const steps = route.legs[0].steps.length;
    score += Math.min(steps / 2, 15);

    // Penalize routes with warnings
    score -= (route.warnings?.length || 0) * 5;

    // First route gets bonus (Google's recommended)
    if (index === 0) score += 10;
    if (index === 2) score -= 15; // Fastest route penalty

    return Math.max(50, Math.min(95, Math.round(score)));
  }

  private getRouteColor(index: number): string {
    const colors = [
      '#2EC4B6', // Safe - Teal
      '#F4D35E', // Caution - Yellow
      '#999999'  // Unsafe - Gray
    ];
    return colors[index] || colors[2];
  }

  highlightRoute(routeIndex: number) {
    if (!this.directionsRenderers || this.directionsRenderers.length === 0) {
      return; // No renderers to highlight (e.g., in demo mode)
    }
    
    this.directionsRenderers.forEach((renderer, index) => {
      try {
        const polylineOptions = renderer.getDirections()?.routes[index] ? {
          strokeColor: this.getRouteColor(index),
          strokeWeight: index === routeIndex ? 6 : 3,
          strokeOpacity: index === routeIndex ? 0.9 : 0.4
        } : undefined;

        if (polylineOptions) {
          renderer.setOptions({ polylineOptions });
        }
      } catch (error) {
        console.warn('Failed to highlight route:', error);
      }
    });
  }

  async getCurrentLocation(): Promise<Location> {
    await this.ensureLoaded();
    
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          // Reverse geocode to get address
          const geocoder = new google.maps.Geocoder();

          geocoder.geocode(
            { location: { lat, lng } },
            (results, status) => {
              if (status === 'OK' && results && results[0]) {
                resolve({
                  lat,
                  lng,
                  address: results[0].formatted_address
                });
              } else {
                resolve({
                  lat,
                  lng,
                  address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`
                });
              }
            }
          );
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`));
        }
      );
    });
  }

  clearRoutes() {
    this.directionsRenderers.forEach(renderer => renderer.setMap(null));
    this.directionsRenderers = [];
  }

  // Get turn-by-turn navigation steps for a route
  getNavigationSteps(route: RouteData): NavigationStep[] {
    const steps: NavigationStep[] = [];
    
    // Check if route has steps
    if (!route || !route.steps || !Array.isArray(route.steps)) {
      console.warn('Route has no steps or steps is not an array');
      return steps;
    }
    
    try {
      route.steps.forEach((step: any) => {
        // Handle both Google Maps DirectionsStep and mock step formats
        const instruction = step.instructions 
          ? step.instructions.replace(/<[^>]*>/g, '') // Remove HTML tags from Google Maps
          : step.instruction || 'Continue';
        
        const distance = step.distance?.text || step.distance || '';
        const duration = step.duration?.text || step.duration || '';
        
        // Handle location - Google Maps uses methods, mock uses plain objects
        let lat: number;
        let lng: number;
        
        if (step.start_location) {
          // Google Maps format - start_location has lat() and lng() methods
          lat = typeof step.start_location.lat === 'function' 
            ? step.start_location.lat() 
            : step.start_location.lat;
          lng = typeof step.start_location.lng === 'function' 
            ? step.start_location.lng() 
            : step.start_location.lng;
        } else if (step.location) {
          // Mock format - location is a plain object
          lat = step.location.lat;
          lng = step.location.lng;
        } else {
          // Fallback
          lat = 0;
          lng = 0;
        }
        
        steps.push({
          instruction,
          distance,
          duration,
          maneuver: step.maneuver,
          location: { lat, lng }
        });
      });
    } catch (error) {
      console.error('Error processing navigation steps:', error);
    }

    return steps;
  }

  // Start navigation mode with live tracking
  startNavigation(route: RouteData, onLocationUpdate?: (location: Location, nextStep: NavigationStep | null) => void): () => void {
    let watchId: number | null = null;
    let currentStepIndex = 0;
    const steps = this.getNavigationSteps(route);

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        async (position) => {
          const currentLat = position.coords.latitude;
          const currentLng = position.coords.longitude;

          // Get address for current location
          const geocoder = new google.maps.Geocoder();
          geocoder.geocode(
            { location: { lat: currentLat, lng: currentLng } },
            (results, status) => {
              const address = status === 'OK' && results && results[0]
                ? results[0].formatted_address
                : `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`;

              const currentLocation: Location = {
                lat: currentLat,
                lng: currentLng,
                address
              };

              // Find the next step based on current location
              let nextStep: NavigationStep | null = null;
              
              if (currentStepIndex < steps.length) {
                nextStep = steps[currentStepIndex];
                
                // Calculate distance to next step
                const stepLat = nextStep.location.lat;
                const stepLng = nextStep.location.lng;
                const distance = this.calculateDistance(
                  currentLat,
                  currentLng,
                  stepLat,
                  stepLng
                );

                // If within 20 meters of the step, move to next step
                if (distance < 0.02) { // ~20 meters
                  currentStepIndex++;
                  if (currentStepIndex < steps.length) {
                    nextStep = steps[currentStepIndex];
                  } else {
                    nextStep = null; // Reached destination
                  }
                }
              }

              // Update map center to current location
              if (this.map) {
                this.map.setCenter({ lat: currentLat, lng: currentLng });
                
                // Add a marker for current location
                new google.maps.Marker({
                  position: { lat: currentLat, lng: currentLng },
                  map: this.map,
                  icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#4285F4',
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2
                  },
                  title: 'Your Location'
                });
              }

              // Call the callback with current location and next step
              if (onLocationUpdate) {
                onLocationUpdate(currentLocation, nextStep);
              }
            }
          );
        },
        (error) => {
          console.error('Navigation error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );
    }

    // Return a function to stop navigation
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }

  // Calculate distance between two points in kilometers
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

export const googleMapsService = new GoogleMapsService();
