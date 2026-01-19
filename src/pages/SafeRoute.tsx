import { useState, useRef, useEffect } from 'react';
import { Shield, MapPin, Clock, AlertCircle, Users, Sparkles, Loader2, Navigation, Car, Bike, Bus, Footprints, CheckCircle2, XCircle, MapPinned, Eye, Star, Send, Heart } from 'lucide-react';
import { StarRating, SafetyScoreSlider } from '@/components/StarRating';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogOverlay } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { googleMapsService, type RouteData, type TravelMode } from '@/services/googleMaps';
import { mockGoogleMapsService, type MockRouteData } from '@/services/mockGoogleMaps';
import { geminiService, type SafetyAnalysis } from '@/services/gemini';
import {
  safetyScorer,
  parseDistanceToKm,
  parseDurationToMin,
  detectRoadType,
  estimateLightingLevel,
  getCrimeLevelForLocation,
  type RouteInputData,
  type EnvironmentData
} from '@/services/safetyScorer';
import {
  firebaseSafetyService,
  getGridId,
  type AreaReport,
  type SafetyRatings
} from '@/services/firebaseSafety';
import { useToast } from '@/hooks/use-toast';
import { NavigationDialog } from '@/components/NavigationDialog';
import { MockMap } from '@/components/MockMap';

// ============== SOS FEATURE TYPES AND CONSTANTS ==============
type SosSettings = {
  police: string;
  ambulance: string;
  whatsapp1: string;
  whatsapp2: string;
  whatsapp3: string;
  email1: string;
  email2: string;
  email3: string;
  messageTemplate: string;
  enableQuickSend: boolean;
  holdDuration: number;
  useNominatim: boolean;
  nominatimEmail: string;
};

const SOS_SETTINGS_KEY = 'sos_settings';

const DEFAULT_SOS_SETTINGS: SosSettings = {
  police: '100',
  ambulance: '102',
  whatsapp1: '',
  whatsapp2: '',
  whatsapp3: '',
  email1: '',
  email2: '',
  email3: '',
  messageTemplate: 'Emergency! I need help. My location: {maps}',
  enableQuickSend: false,
  holdDuration: 1500,
  useNominatim: false,
  nominatimEmail: ''
};

export default function SafeRoute() {
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [safetyAnalyses, setSafetyAnalyses] = useState<Map<string, SafetyAnalysis>>(new Map());
  const [showSOS, setShowSOS] = useState(false);
  const [startLocation, setStartLocation] = useState('');
  const [destination, setDestination] = useState('');
  const [travelTime, setTravelTime] = useState('21:00');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'safe' | 'unsafe' | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Safety ratings state
  const [lightingRating, setLightingRating] = useState(0);
  const [crowdednessRating, setCrowdednessRating] = useState(0);
  const [roadConditionRating, setRoadConditionRating] = useState(0);
  const [visibilityRating, setVisibilityRating] = useState(0);
  const [publicTransportRating, setPublicTransportRating] = useState(0);
  const [emergencyAccessRating, setEmergencyAccessRating] = useState(0);
  const [overallSafetyScore, setOverallSafetyScore] = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [areaReports, setAreaReports] = useState<AreaReport[]>([]);
  const [currentAreaScore, setCurrentAreaScore] = useState<number | null>(null);
  const [showNavigation, setShowNavigation] = useState(false);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [mapInitialized, setMapInitialized] = useState(false);
  const [useDemoMode, setUseDemoMode] = useState(false);
  const [travelMode, setTravelMode] = useState<TravelMode>('WALKING');
  const [showVision, setShowVision] = useState(false);
  const [appRating, setAppRating] = useState(0);
  const [appFeedback, setAppFeedback] = useState('');
  const [hasSubmittedAppFeedback, setHasSubmittedAppFeedback] = useState(false);
  const [isLoadingAppFeedback, setIsLoadingAppFeedback] = useState(false);
  const [isSubmittingAppFeedback, setIsSubmittingAppFeedback] = useState(false);
  const [showThankYou, setShowThankYou] = useState(false);

  // SOS Feature State
  const [sosSettings, setSosSettings] = useState<SosSettings>(() => {
    const savedSettings = localStorage.getItem(SOS_SETTINGS_KEY);
    return savedSettings ? JSON.parse(savedSettings) : DEFAULT_SOS_SETTINGS;
  });
  const [lastCoords, setLastCoords] = useState<GeolocationCoordinates | null>(null);
  const [lastAddress, setLastAddress] = useState<string | null>(null);
  const [sosMenuOpen, setSosMenuOpen] = useState(false);
  const [sosSettingsOpen, setSosSettingsOpen] = useState(false);
  const holdTimerRef = useRef<number | null>(null);

  const mapSectionRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Check if user has already submitted app feedback
  useEffect(() => {
    const checkExistingFeedback = async () => {
      setIsLoadingAppFeedback(true);
      try {
        const existing = await firebaseSafetyService.getExistingAppFeedback();
        if (existing) {
          setAppRating(existing.rating);
          setAppFeedback(existing.feedbackText || '');
          setHasSubmittedAppFeedback(true);
        }
      } catch (error) {
        console.error('Error checking existing feedback:', error);
      } finally {
        setIsLoadingAppFeedback(false);
      }
    };
    checkExistingFeedback();
  }, [showVision]);

  // Initialize map when component mounts
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (mapContainerRef.current && !mapInitialized && !useDemoMode && mounted) {
        await initializeMap();
      }
    };

    init();

    // Cleanup function - but don't remove the map or script
    return () => {
      mounted = false;
    };
  }, [useDemoMode]); // Re-run if demo mode changes

  const initializeMap = async () => {
    if (!mapContainerRef.current) return;

    try {
      await googleMapsService.initMap(mapContainerRef.current);
      setMapInitialized(true);
      setUseDemoMode(false);
    } catch (error) {
      console.error('Error initializing map:', error);

      // Automatically switch to demo mode
      setUseDemoMode(true);
      setMapInitialized(true); // Mark as initialized so we don't retry

      toast({
        title: 'Demo Mode Activated',
        description: 'Using mock map for demonstration. Set up Google Maps API key for full functionality.',
        variant: 'default'
      });
    }
  };

  const handleGetCurrentLocation = async () => {
    setIsLoadingLocation(true);
    try {
      if (useDemoMode) {
        const location = await mockGoogleMapsService.getCurrentLocation();
        setStartLocation(location.address);
        toast({
          title: 'Location Found (Demo)',
          description: 'Using mock location for demonstration'
        });
      } else {
        const location = await googleMapsService.getCurrentLocation();
        setStartLocation(location.address);
        toast({
          title: 'Location Found',
          description: 'Current location set successfully'
        });
      }
    } catch (error) {
      console.error('Error getting location:', error);
      toast({
        title: 'Location Error',
        description: 'Could not get current location. Please enter manually.',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleFindRoutes = async () => {
    if (!destination.trim()) {
      toast({
        title: 'Missing Destination',
        description: 'Please enter a destination address',
        variant: 'destructive'
      });
      return;
    }

    if (!startLocation.trim()) {
      toast({
        title: 'Missing Start Location',
        description: 'Please enter a start location or use current location',
        variant: 'destructive'
      });
      return;
    }

    setIsLoadingRoutes(true);

    try {
      let fetchedRoutes: RouteData[];

      if (useDemoMode) {
        // Use mock service in demo mode
        const mockRoutes = await mockGoogleMapsService.calculateRoutes(startLocation, destination, travelMode);
        // Convert mock routes to RouteData format
        fetchedRoutes = mockRoutes.map((route: MockRouteData, index: number) => ({
          id: route.id,
          name: route.name,
          distance: route.distance,
          duration: route.duration,
          safetyScore: route.safetyScore,
          polyline: route.polyline,
          steps: route.steps as any, // Mock steps compatible with navigation
          type: (index === 0 ? 'safe' : index === 1 ? 'balanced' : 'fastest') as 'safe' | 'balanced' | 'fastest',
          color: route.safetyScore >= 85 ? '#2EC4B6' : route.safetyScore >= 70 ? '#F4D35E' : '#999999',
          legs: [],
          warnings: [],
          summary: route.name
        }));
      } else {
        // Ensure map is initialized before fetching routes
        if (!mapInitialized) {
          console.log('🗺️ Map not initialized, initializing now...');
          await initializeMap();
        }

        // Fetch routes from Google Maps
        fetchedRoutes = await googleMapsService.getRoutes(
          startLocation,
          destination,
          travelTime,
          travelMode
        );

        // If Google Maps returns fewer than 3 routes, we still show what we have
        // We DON'T create fake duplicates - that would be misleading
        // Google Maps returns alternative routes only when they are genuinely different
        console.log(`📍 Google Maps returned ${fetchedRoutes.length} route(s)`);

        // Rename routes based on their position if needed
        fetchedRoutes = fetchedRoutes.map((route, index) => ({
          ...route,
          name: index === 0 ? 'Recommended Route' : index === 1 ? 'Alternative Route' : 'Quick Route',
          type: (index === 0 ? 'safe' : index === 1 ? 'balanced' : 'fastest') as 'safe' | 'balanced' | 'fastest'
        }));
      }

      if (fetchedRoutes.length === 0) {
        throw new Error('No routes found');
      }

      console.log('📍 Total routes fetched:', fetchedRoutes.length);
      console.log('📍 Routes:', fetchedRoutes.map(r => r.name));

      // ============== SAFETY SCORING ENGINE ==============
      // Calculate safety scores using our custom formula
      // Use selected travel time instead of device time
      const selectedHour = parseInt(travelTime.split(':')[0], 10);
      const environment: EnvironmentData = {
        currentHour: selectedHour,
        weatherCondition: 'clear', // TODO: Integrate weather API
      };

      // Convert routes to input format for safety scorer
      const routeInputs: RouteInputData[] = fetchedRoutes.map(route => {
        const distanceKm = parseDistanceToKm(route.distance);
        const durationMin = parseDurationToMin(route.duration);
        const turnCount = route.steps?.length || 5;

        // Detect road type from route summary/steps
        const routeSummary = route.summary || route.name || '';
        const roadType = detectRoadType(routeSummary);

        // Get crime level for destination area
        const crimeLevel = getCrimeLevelForLocation(destination);

        // Estimate lighting based on road type and SELECTED time
        const lightingLevel = estimateLightingLevel(roadType, selectedHour);

        return {
          routeId: route.id,
          distanceKm,
          durationMin,
          turnCount,
          roadType,
          crimeLevel,
          lightingLevel,
        };
      });

      // Calculate safety scores for all routes
      const safetyResults = safetyScorer.calculateMultipleRoutesSafety(routeInputs, environment);
      console.log('🛡️ Safety scores calculated:', safetyResults.map(r => ({ id: r.routeId, score: r.safetyScore })));

      // Update routes with calculated safety scores
      const scoredRoutes = fetchedRoutes.map((route, index) => {
        const result = safetyResults[index];
        return {
          ...route,
          safetyScore: result.safetyScore,
          name: index === 0 ? 'Recommended Route' : index === 1 ? 'Alternative Route' : 'Quick Route',
        };
      });

      // Convert safety results to SafetyAnalysis format for UI
      const analysesMap = new Map<string, SafetyAnalysis>();
      safetyResults.forEach(result => {
        analysesMap.set(result.routeId, {
          description: result.explanation,
          highlights: result.highlights,
          safetyScore: result.safetyScore,
          recommendations: result.recommendations,
          riskFactors: result.riskFactors,
          rank: result.rank,
          rawRiskScore: result.rawRiskScore,
        });
      });

      setRoutes(scoredRoutes);
      setSelectedRoute(scoredRoutes[0]);
      setSafetyAnalyses(analysesMap);

      toast({
        title: 'Routes Found & Analyzed',
        description: `Found ${fetchedRoutes.length} route${fetchedRoutes.length > 1 ? 's' : ''} with safety scores`
      });

      // Optionally also run Gemini analysis for enhanced descriptions (non-blocking)
      if (geminiService.isConfigured()) {
        console.log('🚀 Starting Gemini analysis in the background for enhanced descriptions');
        geminiService.analyzeMultipleRoutes(fetchedRoutes, travelTime, 8000)
          .then(geminiAnalyses => {
            console.log('✅ Gemini analysis completed');
            // Merge Gemini descriptions with our safety scores - KEEP riskFactors!
            const mergedAnalyses = new Map<string, SafetyAnalysis>();
            safetyResults.forEach(result => {
              const geminiAnalysis = geminiAnalyses.get(result.routeId);
              mergedAnalyses.set(result.routeId, {
                // Keep our calculated safety score and risk factors
                safetyScore: result.safetyScore,
                riskFactors: result.riskFactors,  // IMPORTANT: Keep risk factors!
                rank: result.rank,                 // IMPORTANT: Keep rank!
                rawRiskScore: result.rawRiskScore, // IMPORTANT: Keep raw score!
                // Use Gemini description if available, otherwise our explanation
                description: geminiAnalysis?.description || result.explanation,
                // Merge highlights
                highlights: geminiAnalysis?.highlights || result.highlights,
                recommendations: geminiAnalysis?.recommendations || result.recommendations,
              });
            });
            setSafetyAnalyses(mergedAnalyses);
          })
          .catch(error => {
            console.error('❌ Gemini analysis failed:', error);
            // Safety scores are already calculated, so no impact on user
          });
      }

    } catch (error) {
      console.error('Error finding routes:', error);
      toast({
        title: 'Route Error',
        description: error instanceof Error ? error.message : 'Failed to find routes. Please check your addresses.',
        variant: 'destructive'
      });
    } finally {
      setIsLoadingRoutes(false);
    }
  };

  const handleRouteSelect = (route: RouteData) => {
    try {
      setSelectedRoute(route);
      const routeIndex = routes.findIndex(r => r.id === route.id);
      // Only highlight route on Google Maps if not in demo mode
      if (routeIndex !== -1 && !useDemoMode && mapInitialized) {
        googleMapsService.highlightRoute(routeIndex);
      }
    } catch (error) {
      console.error('Error selecting route:', error);
    }
  };

  // ============== COMMUNITY FEEDBACK HANDLERS ==============

  const [feedbackEligibility, setFeedbackEligibility] = useState<{ canSubmit: boolean; hoursRemaining?: number; message?: string } | null>(null);

  const handleOpenFeedback = async (type: 'safe' | 'unsafe') => {
    setFeedbackType(type);
    setFeedbackText('');
    // Reset all ratings
    setLightingRating(0);
    setCrowdednessRating(0);
    setRoadConditionRating(0);
    setVisibilityRating(0);
    setPublicTransportRating(0);
    setEmergencyAccessRating(0);
    setOverallSafetyScore(0);

    setIsGettingLocation(true);
    setShowFeedback(true);
    setFeedbackEligibility(null);

    try {
      // Get user's current location
      const location = await firebaseSafetyService.getCurrentLocation();
      setUserLocation(location);

      // Get current area safety score
      const gridId = getGridId(location.lat, location.lng);
      const score = await firebaseSafetyService.getAreaSafetyScore(gridId);
      setCurrentAreaScore(score);

      // Check if user can submit feedback (24-hour cooldown)
      const eligibility = await firebaseSafetyService.checkFeedbackEligibility(gridId);
      setFeedbackEligibility(eligibility);

      // Get recent reports for this area
      const reports = await firebaseSafetyService.getAreaReports(gridId, 5);
      setAreaReports(reports);

    } catch (error) {
      console.error('Error getting location:', error);
      toast({
        title: 'Location Error',
        description: error instanceof Error ? error.message : 'Failed to get your location. Please enable location access.',
        variant: 'destructive'
      });
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!userLocation || feedbackType === null) {
      toast({
        title: 'Error',
        description: 'Location not available. Please try again.',
        variant: 'destructive'
      });
      return;
    }

    // Validate compulsory ratings
    if (lightingRating === 0 || crowdednessRating === 0 || roadConditionRating === 0) {
      toast({
        title: 'Missing Required Ratings',
        description: 'Please rate Lighting, Crowdedness, and Road Condition (required fields).',
        variant: 'destructive'
      });
      return;
    }

    // Validate overall safety score
    if (overallSafetyScore === 0) {
      toast({
        title: 'Missing Safety Score',
        description: 'Please provide your overall safety score for this area.',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmittingFeedback(true);

    try {
      // Prepare ratings object
      const ratings: SafetyRatings = {
        lighting: lightingRating,
        crowdedness: crowdednessRating,
        roadCondition: roadConditionRating,
        visibility: visibilityRating,
        publicTransport: publicTransportRating,
        emergencyAccess: emergencyAccessRating,
        overallSafetyScore: overallSafetyScore,
      };

      const result = await firebaseSafetyService.submitSafetyFeedback(
        userLocation.lat,
        userLocation.lng,
        feedbackType === 'safe',
        feedbackText.trim() || undefined,
        ratings
      );

      if (result.success) {
        toast({
          title: feedbackType === 'safe' ? '✓ Area Marked Safe' : '⚠ Area Reported',
          description: result.message,
        });

        // Update local state with new score
        if (result.newSafetyScore !== undefined) {
          setCurrentAreaScore(result.newSafetyScore);
        }

        // Close dialog and reset all states
        setShowFeedback(false);
        setFeedbackType(null);
        setFeedbackText('');
        setUserLocation(null);
        setLightingRating(0);
        setCrowdednessRating(0);
        setRoadConditionRating(0);
        setVisibilityRating(0);
        setPublicTransportRating(0);
        setEmergencyAccessRating(0);
        setOverallSafetyScore(0);

      } else {
        toast({
          title: 'Feedback Error',
          description: result.message,
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit feedback. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleCloseFeedback = () => {
    setShowFeedback(false);
    setFeedbackType(null);
    setFeedbackText('');
    setUserLocation(null);
    setAreaReports([]);
    setCurrentAreaScore(null);
    setFeedbackEligibility(null);
    // Reset all ratings
    setLightingRating(0);
    setCrowdednessRating(0);
    setRoadConditionRating(0);
    setVisibilityRating(0);
    setPublicTransportRating(0);
    setEmergencyAccessRating(0);
    setOverallSafetyScore(0);
  };

  // ============== SOS FEATURE HELPER FUNCTIONS ==============
  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }

  function buildWhatsAppAppUrl(phone: string, text?: string) {
    const encoded = encodeURIComponent(text || '');
    return `whatsapp://send?phone=${phone}&text=${encoded}`;
  }

  function buildWhatsAppWebUrl(phone: string, text?: string) {
    const encoded = encodeURIComponent(text || '');
    return `https://web.whatsapp.com/send?phone=${phone}&text=${encoded}`;
  }

  function buildWhatsAppWaMeUrl(phone: string, text?: string) {
    const encoded = encodeURIComponent(text || '');
    return `https://wa.me/${phone}?text=${encoded}`;
  }

  function openWhatsAppAppWithFallback(phone: string | undefined, text?: string) {
    if (!phone) {
      window.alert('No WhatsApp phone number provided');
      return;
    }

    const appUrl = buildWhatsAppAppUrl(phone, text);
    const webUrl = buildWhatsAppWebUrl(phone, text);

    // Mobile Logic: Force Native App immediately
    // Do NOT open a new window/tab for mobile, as it breaks custom scheme opening
    if (isMobileDevice()) {
      // "whatsapp://" scheme works for both Standard and Business apps on Android/iOS
      // The OS will prompt the user or open their default choice
      window.location.href = appUrl;
      return;
    }

    let win: Window | null = null;
    try {
      win = window.open('', '_blank');
    } catch (e) {
      win = null;
    }

    // Mobile Logic: Force Native App
    if (isMobileDevice()) {
      const isAndroid = /Android/i.test(navigator.userAgent);

      // Android: Use Intent Scheme which is more robust
      // This tries WhatsApp first, then Business, then falls back to browser ONLY if both missing (but user said force app)
      if (isAndroid) {
        // Intent scheme for Android - tries to open WhatsApp or Business
        // S.browser_fallback_url param prevents it from going to random places if app missing
        // Removed 'package=com.whatsapp' to allow WhatsApp Business (com.whatsapp.w4b) to handle it too
        const intentUrl = `intent://send?phone=${phone}&text=${encodeURIComponent(text || '')}#Intent;scheme=whatsapp;S.browser_fallback_url=https://www.whatsapp.com/download;end`;

        if (win) {
          win.location.href = intentUrl;
        } else {
          window.location.href = intentUrl;
        }
        return;
      }

      // iOS / Other Mobile: Use Custom Scheme
      if (win) {
        win.location.href = appUrl;
      } else {
        window.location.href = appUrl;
      }
      return;
    }

    // Desktop Logic
    if (!win) {
      window.location.href = appUrl;
      setTimeout(() => {
        window.location.href = webUrl;
      }, 1000);
      return;
    }

    try {
      win.location.href = appUrl;
    } catch (e) {
      win.location.href = webUrl;
    }

    setTimeout(() => {
      try { win!.location.href = webUrl; } catch { }
    }, 2000);
  }

  function openDial(phone?: string) {
    if (!phone) {
      alert('Phone number not set in Settings');
      return;
    }
    window.location.href = `tel:${phone}`;
  }

  async function copyToClipboard(text: string) {
    return navigator.clipboard?.writeText(text);
  }

  function parseWhatsappList(listStr?: string) {
    if (!listStr) return [];
    return listStr
      .split(',')
      .map((s) => s.trim())
      .map((s) => s.replace(/\D/g, ''))
      .filter(Boolean);
  }

  function getWhatsappNumbers(): string[] {
    return [sosSettings.whatsapp1, sosSettings.whatsapp2, sosSettings.whatsapp3]
      .map(s => s?.trim().replace(/\D/g, ''))
      .filter(Boolean);
  }

  function getEmails(): string[] {
    return [sosSettings.email1, sosSettings.email2, sosSettings.email3]
      .map(s => s?.trim())
      .filter(Boolean);
  }

  function hasMinimumSosContacts(): boolean {
    return getWhatsappNumbers().length > 0 || getEmails().length > 0;
  }

  function getSosLocation(): Promise<GeolocationCoordinates | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos.coords),
        () => resolve(null),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    });
  }

  async function tryReverseGeocode(lat: number, lon: number) {
    if (!sosSettings.useNominatim) return null;
    try {
      const emailParam = sosSettings.nominatimEmail ? `&email=${encodeURIComponent(sosSettings.nominatimEmail)}` : '';
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}${emailParam}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return null;
      const j = await res.json();
      return j.display_name || null;
    } catch (e) {
      console.warn('Reverse geocode failed', e);
      return null;
    }
  }

  function mapsLink(lat: number, lon: number) {
    return `https://maps.google.com/?q=${lat},${lon}`;
  }

  function buildMessageFrom(coords: GeolocationCoordinates | null, addressOrNull?: string | null) {
    const maps = coords ? mapsLink(coords.latitude, coords.longitude) : '';
    const address = addressOrNull || null;
    let msg = sosSettings.messageTemplate || DEFAULT_SOS_SETTINGS.messageTemplate;
    msg = msg.replace('{maps}', maps);
    msg = msg.replace('{address}', address || (lastAddress || ''));
    if (!coords && !address) {
      msg += " (Location unavailable)";
    }
    return msg;
  }

  function buildSosMessage(addressOrNull?: string | null) {
    return buildMessageFrom(lastCoords, addressOrNull);
  }

  async function handleSosClick() {
    // Open the SOS menu IMMEDIATELY - don't wait for location
    setSosMenuOpen(true);

    // Fetch location in the background
    getSosLocation().then((coords) => {
      setLastCoords(coords);
      if (coords && sosSettings.useNominatim) {
        tryReverseGeocode(coords.latitude, coords.longitude).then((addr) => {
          setLastAddress(addr);
        });
      } else {
        setLastAddress(null);
      }
    });
  }

  async function handleQuickSend() {
    const needsLocation = !lastCoords && navigator.geolocation;
    let tempWin: Window | null = null;

    if (needsLocation) {
      try {
        tempWin = window.open('', '_blank');
      } catch (e) {
        tempWin = null;
      }
      if (!tempWin) {
        alert('Please allow popups or use the normal flow (open menu and tap WhatsApp).');
        return;
      }
    }

    let coords = lastCoords;
    let addr = lastAddress;
    if (!coords) {
      // Force fetch location for quick send
      coords = await getSosLocation();
      if (coords) {
        setLastCoords(coords);
        if (sosSettings.useNominatim) {
          addr = await tryReverseGeocode(coords.latitude, coords.longitude);
          setLastAddress(addr);
        }
      }
    }

    const text = buildMessageFrom(coords, addr);

    if (navigator.share && isMobileDevice()) {
      try {
        await navigator.share({ text });
        if (tempWin) tempWin.close();
        return;
      } catch (e) {
        // fall back to app
      }
    }

    const numbers = getWhatsappNumbers();
    const phone = numbers.length ? numbers[0] : '';

    if (phone) {
      if (tempWin) {
        try {
          tempWin.location.href = buildWhatsAppAppUrl(phone, text);
        } catch (e) {
          try { tempWin.location.href = buildWhatsAppWebUrl(phone, text); } catch { }
        }
        setTimeout(() => {
          try { tempWin!.location.href = buildWhatsAppWebUrl(phone, text); } catch { }
        }, 900);
        return;
      }
      openWhatsAppAppWithFallback(phone, text);
      return;
    }

    if (tempWin) tempWin.close();
    if (sosSettings.police) {
      openDial(sosSettings.police);
      return;
    }
    alert('No quick action configured (set Emergency WhatsApp or Police number in Settings).');
  }

  function actionCallPolice() {
    openDial(sosSettings.police);
  }

  function actionCallAmbulance() {
    openDial(sosSettings.ambulance);
  }

  async function actionWhatsApp(specificNumber?: string) {
    let coords = lastCoords;
    if (!coords) {
      toast({ title: "Locating...", description: "Getting your precise location." });
      coords = await getSosLocation();
      if (coords) setLastCoords(coords);
    }

    // Refresh address if we have coords but no address
    let address = lastAddress;
    if (coords && !address && sosSettings.useNominatim) {
      address = await tryReverseGeocode(coords.latitude, coords.longitude);
      if (address) setLastAddress(address);
    }

    const text = buildMessageFrom(coords, address);

    if (navigator.share && isMobileDevice() && !specificNumber) {
      try {
        await navigator.share({ text });
        return;
      } catch (e) {
        // fallback
      }
    }

    const numbers = getWhatsappNumbers();
    if (numbers.length === 0) {
      alert('No Emergency WhatsApp contact configured. Add contact in Settings.');
      return;
    }

    // If a specific number is requested (e.g. from the list buttons)
    if (specificNumber) {
      openWhatsAppAppWithFallback(specificNumber, text);
      return;
    }

    // "Send to all" logic
    if (numbers.length === 1) {
      openWhatsAppAppWithFallback(numbers[0], text);
      return;
    }

    if (!window.confirm(`Open WhatsApp chats for ${numbers.length} emergency contacts in new tabs/windows? Your browser may block popups.`)) return;

    // sequential open
    for (let i = 0; i < numbers.length; i++) {
      openWhatsAppAppWithFallback(numbers[i], text);
      // Wait a bit longer between opens to help with browser throttling
      await new Promise((res) => setTimeout(res, 1000));
    }
  }

  async function actionEmail() {
    const subject = 'Emergency Help Needed';

    let coords = lastCoords;
    if (!coords) {
      coords = await getSosLocation();
      if (coords) setLastCoords(coords);
    }

    // Refresh address
    let address = lastAddress;
    if (coords && !address && sosSettings.useNominatim) {
      address = await tryReverseGeocode(coords.latitude, coords.longitude);
      if (address) setLastAddress(address);
    }

    const body = buildMessageFrom(coords, address);
    const emails = getEmails();
    if (emails.length === 0) {
      alert('No Emergency Email configured. Add in Settings');
      return;
    }
    const to = emails.join(',');

    // On mobile, prioritize native app (faster and more reliable)
    const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    if (isMobileDevice()) {
      window.location.href = mailto;
      return;
    }

    // On desktop, try Gmail web first as it's often preferred
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

    const win = window.open(gmailUrl, '_blank');
    if (!win) {
      window.location.href = mailto;
    }
  }

  async function actionSMS() {
    let coords = lastCoords;
    if (!coords) {
      coords = await getSosLocation();
      if (coords) setLastCoords(coords);
    }

    // Refresh address if needed
    let address = lastAddress;
    if (coords && !address && sosSettings.useNominatim) {
      address = await tryReverseGeocode(coords.latitude, coords.longitude);
      if (address) setLastAddress(address);
    }

    const text = buildMessageFrom(coords, address);
    const numbers = getWhatsappNumbers(); // reuse whatsapp numbers for SMS

    if (numbers.length === 0) {
      alert('No contacts configured. Add specific numbers in Settings.');
      return;
    }

    const separator = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? '&' : '?';
    // Most modern phones accept comma for multiple recipients in sms: protocol
    const allNumbers = numbers.join(',');

    window.location.href = `sms:${allNumbers}${separator}body=${encodeURIComponent(text)}`;
  }

  async function actionCopyLocation() {
    if (!lastCoords) {
      alert('No location available');
      return;
    }
    const text = `${buildSosMessage(lastAddress)}\nCoordinates: ${lastCoords.latitude},${lastCoords.longitude}\n${mapsLink(lastCoords.latitude, lastCoords.longitude)}`;
    try {
      await copyToClipboard(text);
      alert('Location copied to clipboard');
    } catch (e) {
      alert('Copy failed; try manually: ' + text);
    }
  }

  function actionOpenMaps() {
    if (!lastCoords) {
      alert('No location available');
      return;
    }
    window.open(mapsLink(lastCoords.latitude, lastCoords.longitude), '_blank');
  }

  // hold-to-quick-send helpers
  const startHold = () => {
    if (!sosSettings.enableQuickSend) return;
    if (holdTimerRef.current) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(() => {
      handleQuickSend();
    }, sosSettings.holdDuration || DEFAULT_SOS_SETTINGS.holdDuration);
  };

  const cancelHold = () => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  function handleSosSettingsChange<K extends keyof SosSettings>(key: K, value: SosSettings[K]) {
    const updatedSettings = { ...sosSettings, [key]: value };
    setSosSettings(updatedSettings);
    localStorage.setItem(SOS_SETTINGS_KEY, JSON.stringify(updatedSettings));
  }

  function resetSosSettings() {
    if (!window.confirm('Reset settings to defaults?')) return;
    localStorage.removeItem(SOS_SETTINGS_KEY);
    setSosSettings(DEFAULT_SOS_SETTINGS);
  }

  const whatsappCount = getWhatsappNumbers().length;
  const emailCount = getEmails().length;
  // ============== END SOS FEATURE HELPER FUNCTIONS ==============

  const scrollToMap = () => {
    mapSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToTop = () => {
    heroRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const currentAnalysis = selectedRoute ? safetyAnalyses.get(selectedRoute.id) : null;

  return (
    <div className="min-h-screen bg-gradient-navy">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-secondary/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 xl:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 xl:w-7 xl:h-7 text-primary" />
            <h1 className="text-xl xl:text-2xl font-bold text-foreground">SafeRoute</h1>
          </div>
          <div className="flex items-center gap-2 xl:gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowVision(true)}
              className="text-xs xl:text-sm gap-1"
            >
              <Eye className="w-4 h-4" />
              <span className="hidden sm:inline">Our Vision</span>
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => { handleSosClick(); }}
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              title="SOS - Hold for quick send"
              className="text-xs xl:text-sm"
            >
              SOS
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section ref={heroRef} className="container mx-auto px-4 xl:px-8 py-12 xl:py-20 text-center">
        <div className="max-w-3xl mx-auto space-y-4 xl:space-y-6">
          <h2 className="text-3xl xl:text-5xl font-bold text-foreground">
            Travel Safer at Night
          </h2>
          <p className="text-base xl:text-xl text-muted-foreground">
            AI-powered route guidance designed with women's safety first.
          </p>
          <p className="text-sm xl:text-base text-primary font-medium">
            Your safety is our priority. Navigate with confidence.
          </p>
          <Button
            size="lg"
            onClick={scrollToMap}
            className="bg-primary hover:bg-primary/90 text-primary-foreground mt-4 xl:mt-6 text-sm xl:text-base"
          >
            Start Safe Navigation
          </Button>
        </div>
      </section>

      {/* Route Selection & Map Section */}
      <section ref={mapSectionRef} className="container mx-auto px-4 xl:px-8 py-8 xl:py-12">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-8">
          {/* Left Panel - Route Input */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg xl:text-xl">Plan Your Safe Journey</CardTitle>
              <CardDescription>Enter your destination to find the safest route</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="start" className="flex items-center gap-2 text-sm xl:text-base">
                  <MapPin className="w-4 h-4" />
                  Start Location
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="start"
                    value={startLocation}
                    onChange={(e) => setStartLocation(e.target.value)}
                    placeholder="Your current location"
                    className="bg-input border-border text-sm xl:text-base flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleGetCurrentLocation}
                    disabled={isLoadingLocation}
                    title="Use current location"
                  >
                    {isLoadingLocation ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Navigation className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination" className="flex items-center gap-2 text-sm xl:text-base">
                  <MapPin className="w-4 h-4" />
                  Destination
                </Label>
                <Input
                  id="destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Enter destination"
                  className="bg-input border-border text-sm xl:text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time" className="flex items-center gap-2 text-sm xl:text-base">
                  <Clock className="w-4 h-4" />
                  Travel Time
                </Label>
                <Input
                  id="time"
                  type="time"
                  value={travelTime}
                  onChange={(e) => setTravelTime(e.target.value)}
                  className="bg-input border-border text-sm xl:text-base"
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm xl:text-base">
                  <Car className="w-4 h-4" />
                  Travel Mode
                </Label>
                <Select value={travelMode} onValueChange={(value) => setTravelMode(value as TravelMode)}>
                  <SelectTrigger className="bg-input border-border text-sm xl:text-base">
                    <SelectValue placeholder="Select travel mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WALKING">
                      <div className="flex items-center gap-2">
                        <Footprints className="w-4 h-4" />
                        Walking
                      </div>
                    </SelectItem>
                    <SelectItem value="TWO_WHEELER">
                      <div className="flex items-center gap-2">
                        <Bike className="w-4 h-4" />
                        Two Wheeler (Bike/Scooter)
                      </div>
                    </SelectItem>
                    <SelectItem value="DRIVING">
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4" />
                        Four Wheeler (Car)
                      </div>
                    </SelectItem>
                    <SelectItem value="TRANSIT">
                      <div className="flex items-center gap-2">
                        <Bus className="w-4 h-4" />
                        Public Transport (Bus/Toto)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleFindRoutes}
                disabled={!destination.trim() || !startLocation.trim() || isLoadingRoutes}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground text-sm xl:text-base"
              >
                {isLoadingRoutes ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Finding Routes...
                  </>
                ) : (
                  'Find Safe Routes'
                )}
              </Button>

              {!geminiService.isConfigured() && (
                <p className="text-xs text-muted-foreground text-center">
                  ⚠️ Gemini API not configured. Using fallback analysis.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Right Panel - Map View */}
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              <div className="relative w-full h-[400px] xl:h-[500px] rounded-lg overflow-hidden" style={{ minHeight: '400px' }}>
                {/* Loading overlay - positioned absolutely so it doesn't interfere with map */}
                {!mapInitialized && (
                  <div className="absolute inset-0 bg-muted flex items-center justify-center z-10">
                    <div className="text-center space-y-2">
                      <Loader2 className="w-12 h-12 xl:w-16 xl:h-16 text-primary mx-auto animate-spin" />
                      <p className="text-muted-foreground text-sm xl:text-base">Loading map...</p>
                    </div>
                  </div>
                )}
                {/* Map container - show MockMap in demo mode, Google Maps otherwise */}
                {useDemoMode ? (
                  <MockMap routes={routes} selectedRoute={selectedRoute} />
                ) : (
                  <div
                    ref={mapContainerRef}
                    className="w-full h-full"
                    key="google-map-container"
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Safety Analysis Panel */}
      {selectedRoute && currentAnalysis && (
        <section className="container mx-auto px-4 xl:px-8 py-6 xl:py-8">
          <Card className="bg-card border-border">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg xl:text-xl">Safety Score Breakdown</CardTitle>
                  <CardDescription className="mt-2 text-sm xl:text-base">
                    See exactly how this route's safety score is calculated
                  </CardDescription>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {(() => {
                    const score = currentAnalysis.safetyScore || 70;
                    const category = score >= 75 ? { label: 'Safest Option', color: 'bg-green-500/20 text-green-400 border-green-500/50' }
                      : score >= 58 ? { label: 'Moderate Option', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' }
                        : { label: 'Least Safe Option', color: 'bg-orange-500/20 text-orange-400 border-orange-500/50' };
                    return (
                      <>
                        <Badge className={`${category.color} border text-sm xl:text-base font-bold px-3 py-1`}>
                          {score}/100
                        </Badge>
                        <span className={`text-xs xl:text-sm font-medium ${score >= 75 ? 'text-green-400' : score >= 58 ? 'text-yellow-400' : 'text-orange-400'}`}>
                          {category.label}
                        </span>
                        {currentAnalysis.rank && (
                          <span className="text-xs text-muted-foreground">Rank #{currentAnalysis.rank} of {routes.length}</span>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Score Calculation Breakdown */}
                {currentAnalysis.riskFactors && (() => {
                  const rf = currentAnalysis.riskFactors;

                  // Get selected hour for display
                  const selectedHour = parseInt(travelTime.split(':')[0], 10);
                  const timeLabel = selectedHour >= 22 || selectedHour <= 5
                    ? `Late night (${travelTime})`
                    : selectedHour >= 19 || selectedHour <= 7
                      ? `Evening/morning (${travelTime})`
                      : `Daytime (${travelTime})`;

                  // Calculate actual points for each factor (points = (1 - risk) * weight * 100)
                  const factors = [
                    {
                      name: 'Crime Risk',
                      emoji: '🚨',
                      weight: 25,
                      risk: rf.crimeRisk,
                      points: Math.round((1 - rf.crimeRisk) * 25),
                      description: rf.crimeRisk <= 0.3 ? 'Low crime area' : rf.crimeRisk <= 0.6 ? 'Moderate crime area' : 'Higher crime area'
                    },
                    {
                      name: 'Lighting',
                      emoji: '💡',
                      weight: 15,
                      risk: rf.lightingRisk,
                      points: Math.round((1 - rf.lightingRisk) * 15),
                      description: rf.lightingRisk <= 0.3 ? 'Well-lit streets' : rf.lightingRisk <= 0.6 ? 'Partially lit' : 'Limited lighting'
                    },
                    {
                      name: 'Time of Day',
                      emoji: '🌙',
                      weight: 15,
                      risk: rf.timeRisk,
                      points: Math.round((1 - rf.timeRisk) * 15),
                      description: timeLabel
                    },
                    {
                      name: 'Road Type',
                      emoji: '🛣️',
                      weight: 10,
                      risk: rf.roadTypeRisk,
                      points: Math.round((1 - rf.roadTypeRisk) * 10),
                      description: rf.roadTypeRisk <= 0.4 ? 'Main roads/highways' : rf.roadTypeRisk <= 0.6 ? 'Residential streets' : 'Narrow lanes/alleys'
                    },
                    {
                      name: 'Distance',
                      emoji: '📏',
                      weight: 10,
                      risk: rf.distanceRisk,
                      points: Math.round((1 - rf.distanceRisk) * 10),
                      description: rf.distanceRisk <= 0.3 ? 'Short distance (<3km)' : rf.distanceRisk <= 0.6 ? 'Moderate distance' : 'Long distance (>6km)'
                    },
                    {
                      name: 'Duration',
                      emoji: '⏱️',
                      weight: 10,
                      risk: rf.durationRisk,
                      points: Math.round((1 - rf.durationRisk) * 10),
                      description: rf.durationRisk <= 0.3 ? 'Quick trip (<10min)' : rf.durationRisk <= 0.6 ? 'Moderate duration' : 'Long duration (>20min)'
                    },
                    {
                      name: 'Weather',
                      emoji: '🌦️',
                      weight: 10,
                      risk: rf.weatherRisk,
                      points: Math.round((1 - rf.weatherRisk) * 10),
                      description: rf.weatherRisk <= 0.3 ? 'Clear weather' : rf.weatherRisk <= 0.6 ? 'Cloudy/light rain' : 'Poor visibility'
                    },
                    {
                      name: 'Route Complexity',
                      emoji: '🔄',
                      weight: 5,
                      risk: rf.turnRisk,
                      points: Math.round((1 - rf.turnRisk) * 5),
                      description: rf.turnRisk <= 0.3 ? 'Straightforward route' : rf.turnRisk <= 0.6 ? 'Some turns' : 'Complex route'
                    },
                  ];

                  const totalPoints = factors.reduce((sum, f) => sum + f.points, 0);

                  return (
                    <div className="space-y-4">
                      {/* Total Score Summary */}
                      <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                        <h4 className="font-semibold text-base xl:text-lg mb-2 flex items-center gap-2">
                          <Shield className="w-5 h-5 text-primary" />
                          Total Score Calculation
                        </h4>
                        <div className="flex flex-wrap gap-2 text-sm">
                          {factors.map((f, i) => (
                            <span key={f.name} className="inline-flex items-center">
                              <span className={`font-bold ${f.points >= f.weight * 0.7 ? 'text-green-400' : f.points >= f.weight * 0.4 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {f.points}
                              </span>
                              {i < factors.length - 1 && <span className="text-muted-foreground mx-1">+</span>}
                            </span>
                          ))}
                          <span className="text-muted-foreground mx-1">=</span>
                          <span className="font-bold text-primary text-base">{totalPoints} points</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Raw score: {totalPoints}/100 → Relative score: {currentAnalysis.safetyScore}/100 (adjusted based on route comparison)
                        </p>
                      </div>

                      {/* Individual Factor Breakdown */}
                      <h4 className="font-medium text-sm xl:text-base flex items-center gap-2 pt-2">
                        <AlertCircle className="w-4 h-4 text-muted-foreground" />
                        Factor-by-Factor Breakdown
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {factors.map((factor) => {
                          const percentage = (factor.points / factor.weight) * 100;
                          const colorClass = percentage >= 70 ? 'text-green-400' : percentage >= 40 ? 'text-yellow-400' : 'text-red-400';
                          const bgColorClass = percentage >= 70 ? 'bg-green-500' : percentage >= 40 ? 'bg-yellow-500' : 'bg-red-500';

                          return (
                            <div key={factor.name} className="bg-secondary/50 rounded-lg p-3">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs xl:text-sm font-medium">
                                  {factor.emoji} {factor.name}
                                </span>
                                <div className="text-right">
                                  <span className={`text-sm xl:text-base font-bold ${colorClass}`}>
                                    {factor.points}/{factor.weight}
                                  </span>
                                  <span className="text-xs text-muted-foreground ml-1">pts</span>
                                </div>
                              </div>

                              {/* Progress bar */}
                              <div className="w-full bg-gray-700 rounded-full h-2.5 mb-2">
                                <div
                                  className={`h-2.5 rounded-full ${bgColorClass} transition-all`}
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>

                              {/* Description and weight info */}
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">
                                  {factor.description}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Weight: {factor.weight}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Color Legend */}
                      <div className="flex flex-wrap items-center gap-4 pt-2 text-xs">
                        <span className="text-muted-foreground font-medium">Score Guide:</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                          <span className="text-muted-foreground">70%+ of max points (Good)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                          <span className="text-muted-foreground">40-69% (Moderate)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <span className="text-muted-foreground">&lt;40% (Needs attention)</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Key Highlights */}
                {currentAnalysis.highlights && currentAnalysis.highlights.length > 0 && (
                  <div className="space-y-2 pt-4 border-t border-border">
                    <h4 className="font-medium text-sm xl:text-base">Key Highlights:</h4>
                    <ul className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                      {currentAnalysis.highlights.map((highlight, index) => (
                        <li key={index} className="flex items-center gap-2 text-muted-foreground text-sm xl:text-base">
                          <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendations */}
                {currentAnalysis.recommendations && currentAnalysis.recommendations.length > 0 && (
                  <div className="space-y-2 pt-4 border-t border-border">
                    <h4 className="font-medium text-sm xl:text-base">Safety Recommendations:</h4>
                    <ul className="space-y-1">
                      {currentAnalysis.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-center gap-2 text-muted-foreground text-sm xl:text-base">
                          <div className="w-1.5 h-1.5 bg-accent rounded-full" />
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-xs xl:text-sm text-muted-foreground">
                    Transparency first: Every point is calculated and shown • Final score is relative to available alternatives
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Route Comparison Section */}
      {routes.length > 0 && (
        <section className="container mx-auto px-4 xl:px-8 py-6 xl:py-8">
          <div className="flex flex-col gap-4 mb-4 xl:mb-6">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
              <h3 className="text-xl xl:text-2xl font-bold text-foreground">
                Compare Routes
                {routes.length < 3 && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({routes.length} route{routes.length > 1 ? 's' : ''} available)
                  </span>
                )}
              </h3>

              {/* Relative Score Legend */}
              <div className="flex flex-wrap items-center gap-3 text-xs xl:text-sm">
                <span className="text-muted-foreground font-medium">Relative Score:</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-muted-foreground">75-92 Safest</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <span className="text-muted-foreground">58-74 Moderate</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                  <span className="text-muted-foreground">42-57 Least Safe</span>
                </div>
              </div>
            </div>

            {/* Relative Scoring Notice */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs xl:text-sm text-blue-300">
                <span className="font-semibold">Relative Safety Scoring:</span> Scores are calculated by comparing routes against each other.
                The safest route among alternatives gets the highest score. This is <span className="font-semibold">NOT</span> an absolute safety rating of the road.
              </div>
            </div>
          </div>

          <div className={`grid grid-cols-1 gap-4 xl:gap-6 ${routes.length === 1 ? 'xl:grid-cols-1 max-w-md mx-auto' :
            routes.length === 2 ? 'xl:grid-cols-2 max-w-2xl mx-auto' :
              'xl:grid-cols-3'
            }`}>
            {routes.map((route) => {
              const analysis = safetyAnalyses.get(route.id);
              const score = analysis?.safetyScore || route.safetyScore;

              // Get safety category based on score
              // Get safety category based on relative score ranges
              const getSafetyCategory = (s: number) => {
                if (s >= 75) return { label: 'Safest Option', color: 'bg-green-500/20 text-green-400 border-green-500/50' };
                if (s >= 58) return { label: 'Moderate Option', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' };
                return { label: 'Least Safe', color: 'bg-orange-500/20 text-orange-400 border-orange-500/50' };
              };
              const safetyCategory = getSafetyCategory(score);

              return (
                <Card
                  key={route.id}
                  className={`bg-card border-2 transition-all cursor-pointer hover:shadow-lg ${selectedRoute?.id === route.id ? 'border-primary' : 'border-border'
                    }`}
                  onClick={() => handleRouteSelect(route)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base xl:text-lg">{route.name}</CardTitle>
                      <div className="flex flex-col items-end gap-1">
                        <Badge className={`${safetyCategory.color} border text-xs font-bold px-2 py-0.5`}>
                          {score}/100
                        </Badge>
                        <span className={`text-xs ${score >= 75 ? 'text-green-400' : score >= 58 ? 'text-yellow-400' : 'text-orange-400'}`}>
                          {safetyCategory.label}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between text-sm xl:text-base">
                      <span className="text-muted-foreground">Distance:</span>
                      <span className="font-medium">{route.distance}</span>
                    </div>
                    <div className="flex justify-between text-sm xl:text-base">
                      <span className="text-muted-foreground">Duration:</span>
                      <span className="font-medium">{route.duration}</span>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRouteSelect(route);
                        }}
                        variant={selectedRoute?.id === route.id ? "default" : "outline"}
                        className="flex-1 text-xs xl:text-sm"
                      >
                        {selectedRoute?.id === route.id ? 'Selected' : 'Select'}
                      </Button>
                      {selectedRoute?.id === route.id && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowNavigation(true);
                          }}
                          className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 text-xs xl:text-sm"
                        >
                          <Navigation className="w-3 h-3 xl:w-4 xl:h-4 mr-1" />
                          Start
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* Community Safety Feedback Section */}
      <section className="container mx-auto px-4 xl:px-8 py-6 xl:py-8">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg xl:text-xl">
              <Users className="w-5 h-5" />
              Community Safety Feedback
            </CardTitle>
            <CardDescription className="text-sm xl:text-base">
              Help others by sharing your experience. Your feedback improves route safety for everyone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* How it works */}
              <div className="bg-secondary/50 rounded-lg p-3 text-xs xl:text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">How it works:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Your current location is converted to an area grid (~200m radius)</li>
                  <li>Feedback is aggregated with other users in the same area</li>
                  <li>You can submit feedback once per area every 24 hours</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col xl:flex-row gap-3 xl:gap-4">
                <Button
                  onClick={() => handleOpenFeedback('safe')}
                  variant="outline"
                  className="flex-1 text-sm xl:text-base border-green-500/50 hover:bg-green-500/10 hover:text-green-400"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                  Mark Area Safe
                </Button>
                <Button
                  onClick={() => handleOpenFeedback('unsafe')}
                  variant="outline"
                  className="flex-1 text-sm xl:text-base border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
                >
                  <XCircle className="w-4 h-4 mr-2 text-red-500" />
                  Report Unsafe Area
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Community Feedback Dialog */}
      <Dialog open={showFeedback} onOpenChange={handleCloseFeedback}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {feedbackType === 'safe' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Mark Area as Safe
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-500" />
                  Report Unsafe Area
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              Rate this area to help others stay safe
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Location Status - Full width loading state */}
            {isGettingLocation ? (
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-2" />
                <p className="text-sm font-medium">Detecting your location...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Please allow location access if prompted by your browser
                </p>
              </div>
            ) : !userLocation ? (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
                <XCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-red-400">Location unavailable</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Please enable location access in your browser settings
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => handleOpenFeedback(feedbackType || 'safe')}
                >
                  Try Again
                </Button>
              </div>
            ) : (
              <>
                {/* Location Successfully Detected */}
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium text-green-400">Location Detected</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPinned className="w-4 h-4" />
                    <span>Area Grid: {getGridId(userLocation.lat, userLocation.lng)}</span>
                  </div>

                  {/* Current Area Score */}
                  {currentAreaScore !== null && (
                    <div className="mt-2 flex items-center gap-2 text-sm">
                      <Shield className="w-4 h-4 text-primary" />
                      <span>Community score for this area:</span>
                      <Badge className={`${currentAreaScore >= 70 ? 'bg-green-500/20 text-green-400' :
                        currentAreaScore >= 40 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                        {currentAreaScore}/100
                      </Badge>
                    </div>
                  )}
                </div>

                {/* 24-Hour Cooldown Warning */}
                {feedbackEligibility && !feedbackEligibility.canSubmit && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-yellow-500" />
                      <span className="font-medium text-yellow-400">Cooldown Active</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {feedbackEligibility.message}
                    </p>
                  </div>
                )}

                {/* Rating Section - Only show if eligible */}
                {(!feedbackEligibility || feedbackEligibility.canSubmit) && (
                  <>
                    {/* Star Ratings Section */}
                    <div className="space-y-4 bg-secondary/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Star className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm font-semibold">Rate This Area</span>
                      </div>

                      {/* Compulsory Ratings */}
                      <div className="space-y-3">
                        <p className="text-xs text-muted-foreground border-b border-border pb-2">Required Ratings</p>

                        <StarRating
                          rating={lightingRating}
                          onRatingChange={setLightingRating}
                          label="Street Lighting"
                          required={true}
                          size="md"
                        />

                        <StarRating
                          rating={crowdednessRating}
                          onRatingChange={setCrowdednessRating}
                          label="Area Crowdedness"
                          required={true}
                          size="md"
                        />

                        <StarRating
                          rating={roadConditionRating}
                          onRatingChange={setRoadConditionRating}
                          label="Road/Sidewalk Condition"
                          required={true}
                          size="md"
                        />
                      </div>

                      {/* Optional Ratings */}
                      <div className="space-y-3 pt-2">
                        <p className="text-xs text-muted-foreground border-b border-border pb-2">Optional Ratings</p>

                        <StarRating
                          rating={visibilityRating}
                          onRatingChange={setVisibilityRating}
                          label="Visibility (Clear Sightlines)"
                          required={false}
                          size="md"
                        />

                        <StarRating
                          rating={publicTransportRating}
                          onRatingChange={setPublicTransportRating}
                          label="Public Transport Access"
                          required={false}
                          size="md"
                        />

                        <StarRating
                          rating={emergencyAccessRating}
                          onRatingChange={setEmergencyAccessRating}
                          label="Emergency Access Points"
                          required={false}
                          size="md"
                        />
                      </div>
                    </div>

                    {/* Overall Safety Score */}
                    <div className="bg-secondary/30 rounded-lg p-4">
                      <SafetyScoreSlider
                        value={overallSafetyScore}
                        onChange={setOverallSafetyScore}
                        label="Your Overall Safety Score"
                        required={true}
                      />
                    </div>

                    {/* Experience Text (Optional) */}
                    <div className="space-y-2">
                      <Label htmlFor="experience" className="text-sm flex items-center gap-1">
                        Share your experience
                        <span className="text-muted-foreground text-xs">(optional)</span>
                      </Label>
                      <Textarea
                        id="experience"
                        placeholder={
                          feedbackType === 'safe'
                            ? "e.g., Well-lit streets, police patrol visible, busy area..."
                            : "e.g., Poor lighting, isolated area, suspicious activity..."
                        }
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        className="min-h-[80px] text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Your detailed feedback helps others understand the area better.
                      </p>
                    </div>
                  </>
                )}

                {/* Recent Reports in this Area */}
                {areaReports.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm">Recent reports in this area:</Label>
                    <div className="max-h-32 overflow-y-auto space-y-2">
                      {areaReports.slice(0, 3).map((report, index) => (
                        <div
                          key={report.id || index}
                          className={`text-xs p-2 rounded ${report.isSafe
                            ? 'bg-green-500/10 border border-green-500/30'
                            : 'bg-red-500/10 border border-red-500/30'
                            }`}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            {report.isSafe ? (
                              <CheckCircle2 className="w-3 h-3 text-green-400" />
                            ) : (
                              <XCircle className="w-3 h-3 text-red-400" />
                            )}
                            <span className={report.isSafe ? 'text-green-400' : 'text-red-400'}>
                              {report.isSafe ? 'Safe' : 'Unsafe'}
                            </span>
                            {report.ratings && (
                              <span className="ml-auto text-muted-foreground">
                                Score: {report.ratings.overallSafetyScore}/10
                              </span>
                            )}
                          </div>
                          {report.experienceText && (
                            <p className="text-muted-foreground">{report.experienceText}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2 border-t border-border">
            <Button
              variant="outline"
              onClick={handleCloseFeedback}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitFeedback}
              disabled={!userLocation || isSubmittingFeedback || isGettingLocation || (feedbackEligibility !== null && !feedbackEligibility.canSubmit)}
              className={`flex-1 ${feedbackEligibility && !feedbackEligibility.canSubmit
                ? 'bg-gray-600 cursor-not-allowed'
                : feedbackType === 'safe'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
                }`}
            >
              {isSubmittingFeedback ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : feedbackEligibility && !feedbackEligibility.canSubmit ? (
                <>Wait {feedbackEligibility.hoursRemaining}h</>
              ) : (
                <>Submit Feedback</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="container mx-auto px-4 xl:px-8 py-8 xl:py-12 border-t border-border mt-8 xl:mt-12">
        <div className="text-center space-y-2">
          <p className="text-foreground font-semibold text-sm xl:text-base">SafeRoute</p>
          <p className="text-muted-foreground text-xs xl:text-sm">Hackathon Prototype 2025</p>
          <p className="text-muted-foreground text-xs">Prototype for demonstration only</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={scrollToTop}
            className="mt-4 text-xs xl:text-sm"
          >
            Back to Top
          </Button>
        </div>
      </footer>

      {/* SOS Emergency Modal */}
      <Dialog open={showSOS} onOpenChange={setShowSOS}>
        <DialogContent className="bg-card border-destructive border-2">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2 text-lg xl:text-xl">
              <AlertCircle className="w-6 h-6" />
              Emergency Alert Triggered
            </DialogTitle>
            <DialogDescription className="text-sm xl:text-base">
              Your emergency contacts have been notified with your live location.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="font-medium text-sm xl:text-base">Current Location:</p>
              <p className="text-muted-foreground text-xs xl:text-sm">{startLocation}</p>
            </div>
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="font-medium text-sm xl:text-base">Selected Route:</p>
              <p className="text-muted-foreground text-xs xl:text-sm">{selectedRoute?.name}</p>
            </div>
            <div className="bg-primary/10 p-4 rounded-lg border border-primary">
              <p className="text-primary font-medium text-center text-sm xl:text-base">
                Help has been notified. Stay where you are. We're with you.
              </p>
            </div>
          </div>
          <Button onClick={() => setShowSOS(false)} className="w-full text-sm xl:text-base">
            Close
          </Button>
        </DialogContent>
      </Dialog>

      {/* Our Vision & App Feedback Dialog */}
      <Dialog open={showVision} onOpenChange={setShowVision}>
        <DialogContent className="bg-card border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg xl:text-xl">
              <Heart className="w-5 h-5 text-primary" />
              Our Vision
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Vision Statement */}
            <div className="space-y-3">
              <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
                <p className="text-sm xl:text-base leading-relaxed text-foreground">
                  <strong>SafeRoute</strong> is built with one mission: <span className="text-primary">to help women travel safer at night</span>.
                </p>
              </div>

              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">Safety First</strong> — We prioritize the safest route, not the fastest one</span>
                </div>
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">AI-Powered</strong> — Smart analysis of lighting, crime data, foot traffic & more</span>
                </div>
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">Community Driven</strong> — Real feedback from real users improves safety scores</span>
                </div>
                <div className="flex items-start gap-2">
                  <Eye className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span><strong className="text-foreground">Transparent</strong> — Every safety score is explained with full breakdown</span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground italic text-center pt-2 border-t border-border">
                "Not the fastest route. The safest one."
              </p>
            </div>

            {/* App Feedback Section */}
            <div className="border-t border-border pt-4 space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                Rate & Send Feedback
              </h4>

              {isLoadingAppFeedback ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
                </div>
              ) : hasSubmittedAppFeedback ? (
                /* Already submitted - show locked rating */
                <div className="space-y-3">
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-medium text-green-400">Feedback Submitted</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      You have already given your feedback. Thank you for your support!
                    </p>
                  </div>

                  {/* Show their rating (locked) */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Your Rating:</Label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-6 h-6 ${star <= appRating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-600'
                            }`}
                        />
                      ))}
                      <span className="ml-2 text-sm text-muted-foreground">({appRating}/5)</span>
                    </div>
                  </div>

                  {/* Show their feedback if any */}
                  {appFeedback && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Your Feedback:</Label>
                      <p className="text-sm text-foreground bg-secondary/50 rounded p-2 italic">
                        "{appFeedback}"
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Not yet submitted - show form */
                <>
                  {/* Star Rating */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">How would you rate SafeRoute?</Label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setAppRating(star)}
                          className="focus:outline-none transition-transform hover:scale-110"
                        >
                          <Star
                            className={`w-7 h-7 ${star <= appRating
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-500 hover:text-yellow-400'
                              }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Feedback Text */}
                  <div className="space-y-2">
                    <Label htmlFor="appFeedback" className="text-xs text-muted-foreground">
                      Your feedback helps us improve (optional)
                    </Label>
                    <Textarea
                      id="appFeedback"
                      placeholder="What do you like? What can we improve?"
                      value={appFeedback}
                      onChange={(e) => setAppFeedback(e.target.value)}
                      className="min-h-[60px] text-sm"
                    />
                  </div>

                  {/* Submit Button */}
                  <Button
                    onClick={async () => {
                      if (appRating === 0) {
                        toast({
                          title: 'Please select a rating',
                          description: 'Tap the stars to rate SafeRoute',
                          variant: 'destructive'
                        });
                        return;
                      }

                      setIsSubmittingAppFeedback(true);
                      try {
                        const result = await firebaseSafetyService.submitAppFeedback(appRating, appFeedback);

                        if (result.success) {
                          setHasSubmittedAppFeedback(true);
                          setShowVision(false);
                          setShowThankYou(true);
                        } else {
                          toast({
                            title: 'Error',
                            description: result.message,
                            variant: 'destructive'
                          });
                        }
                      } catch (error) {
                        toast({
                          title: 'Error',
                          description: 'Failed to submit feedback. Please try again.',
                          variant: 'destructive'
                        });
                      } finally {
                        setIsSubmittingAppFeedback(false);
                      }
                    }}
                    disabled={isSubmittingAppFeedback}
                    className="w-full"
                  >
                    {isSubmittingAppFeedback ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Submit Feedback
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Thank You Dialog */}
      <Dialog open={showThankYou} onOpenChange={setShowThankYou}>
        <DialogContent className="bg-card border-primary/50 max-w-sm text-center">
          <div className="py-6 space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
              <Heart className="w-8 h-8 text-green-500" />
            </div>
            <DialogTitle className="text-xl">Thank You! 🙏</DialogTitle>
            <DialogDescription className="text-base">
              Your valuable feedback means a lot to us. We really appreciate you taking the time to help us improve SafeRoute.
            </DialogDescription>
            <div className="flex justify-center gap-1 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-6 h-6 ${star <= appRating
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-600'
                    }`}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Your rating: <strong className="text-foreground">{appRating}/5 stars</strong>
            </p>
            <Button onClick={() => setShowThankYou(false)} className="w-full mt-4">
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* SOS Emergency Menu Dialog */}
      <Dialog open={sosMenuOpen} onOpenChange={setSosMenuOpen}>
        <DialogOverlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg xl:text-xl">
              <AlertCircle className="w-6 h-6 text-destructive" />
              Emergency Options
            </DialogTitle>
            <DialogDescription className="text-sm xl:text-base">
              {hasMinimumSosContacts()
                ? 'Choose an action to notify help.'
                : '⚠️ Please add at least 1 Emergency WhatsApp or 1 Emergency Email in Settings before using SOS.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
            {!hasMinimumSosContacts() && (
              <div className="bg-destructive/10 border border-destructive/30 p-4 rounded-lg">
                <div className="text-sm text-destructive font-medium">Setup Required</div>
                <div className="text-xs text-muted-foreground mt-1">Add at least 1 Emergency WhatsApp or 1 Emergency Email to use SOS features. You can add up to 3 of each for added safety.</div>
              </div>
            )}

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="font-medium text-sm xl:text-base">Call for emergency help</div>
              <div className="flex gap-2 mt-2">
                <Button onClick={actionCallPolice} className="flex-1">Call Police</Button>
                <Button onClick={actionCallAmbulance} className="flex-1">Call Ambulance</Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium">Emergency WhatsApp</div>
              <div className="text-sm text-muted-foreground">{whatsappCount > 0 ? `${whatsappCount} contact(s) configured` : '(not set)'}</div>

              <div className="space-y-2 mt-2">
                {getWhatsappNumbers().map((num, idx) => (
                  <Button key={idx} variant="outline" className="w-full justify-start" onClick={() => actionWhatsApp(num)}>
                    <Send className="w-4 h-4 mr-2 text-green-500" />
                    Send to Contact {idx + 1} ({num})
                  </Button>
                ))}

                {whatsappCount > 1 && (
                  <Button onClick={() => actionWhatsApp()} className="w-full mt-2" variant="default">
                    Send to All ({whatsappCount})
                  </Button>
                )}
                {whatsappCount === 0 && (
                  <Button disabled className="w-full">Configure in Settings</Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-medium">Emergency SMS</div>
              <div className="text-sm text-muted-foreground">Send standard SMS to all emergency contacts instantly.</div>
              <Button onClick={() => actionSMS()} className="w-full" disabled={whatsappCount === 0} variant="secondary">
                <Send className="w-4 h-4 mr-2" />
                Send SMS to All
              </Button>
            </div>

            <div className="space-y-2">
              <div className="font-medium">Emergency Email</div>
              <div className="text-sm text-muted-foreground">{emailCount > 0 ? `${emailCount} email(s) configured` : '(not set)'}</div>
              <Button onClick={async () => { await actionEmail(); }} className="w-full" disabled={emailCount === 0}>Send Emergency Email</Button>
            </div>

            <div className="space-y-2">
              <div className="font-medium">Copy Location</div>
              <div className="text-sm text-muted-foreground">Copy coordinates / link to clipboard</div>
              <Button onClick={() => { actionCopyLocation(); }} className="w-full">Copy</Button>
            </div>

            <div className="flex gap-3 mt-4">
              <Button variant="outline" onClick={() => setSosMenuOpen(false)} className="flex-1">Close</Button>
              <Button onClick={() => actionOpenMaps()} className="flex-1">Open in Maps</Button>
              <Button variant="ghost" onClick={() => setSosSettingsOpen(true)} className="flex-1">Settings</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* SOS Settings Dialog */}
      <Dialog open={sosSettingsOpen} onOpenChange={setSosSettingsOpen}>
        <DialogContent className="bg-card max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg xl:text-xl">Emergency Settings</DialogTitle>
            <DialogDescription className="text-sm xl:text-base">
              Add at least 1 Emergency WhatsApp or 1 Emergency Email. Up to 3 of each recommended for added safety.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Helper for rendering phone inputs with country code */}
            {(() => {
              const renderPhoneInput = (label: string, field: keyof SosSettings, placeholder: string) => {
                const fullValue = sosSettings[field] as string || '';
                let code = '91';
                let number = fullValue;

                // Simple heuristic to split existing numbers
                if (fullValue.startsWith('91') && fullValue.length > 5) {
                  code = '91';
                  number = fullValue.slice(2);
                } else if (fullValue.length > 0 && !fullValue.startsWith('91')) {
                  // If it doesn't start with 91, keep it all in number for safety, defaulting code to 91
                  number = fullValue;
                }

                return (
                  <div className="space-y-1">
                    {label && <Label>{label}</Label>}
                    <div className="flex gap-2">
                      {/* Country Code */}
                      <div className="w-20 flex-shrink-0">
                        <Input
                          value={code}
                          onChange={(e) => {
                            const newCode = e.target.value.replace(/\D/g, '');
                            handleSosSettingsChange(field, newCode + number);
                          }}
                          placeholder="Code"
                          className="text-center"
                        />
                      </div>
                      {/* Phone Number */}
                      <div className="flex-1">
                        <Input
                          value={number}
                          onChange={(e) => {
                            const newNumber = e.target.value.replace(/\D/g, '');
                            handleSosSettingsChange(field, code + newNumber); // Always unite with current/default code
                          }}
                          placeholder={placeholder}
                        />
                      </div>
                    </div>
                  </div>
                );
              };

              return (
                <>
                  {renderPhoneInput('Police phone number', 'police', 'e.g. 100')}
                  {renderPhoneInput('Ambulance phone number', 'ambulance', 'e.g. 102')}

                  <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                    <div className="font-medium text-sm">Emergency WhatsApp Numbers</div>
                    <div className="text-xs text-muted-foreground">Country code + Number required. We auto-add the code for you.</div>

                    {renderPhoneInput('', 'whatsapp1', 'WhatsApp 1 (required)')}
                    {renderPhoneInput('', 'whatsapp2', 'WhatsApp 2 (optional)')}
                    {renderPhoneInput('', 'whatsapp3', 'WhatsApp 3 (optional)')}
                  </div>
                </>
              );
            })()}

            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
              <div className="font-medium text-sm">Emergency Email Addresses</div>
              <div className="text-xs text-muted-foreground">At least 1 required if no WhatsApp. Add up to 3 for added safety.</div>
              <div className="space-y-2">
                <Input placeholder="Email 1 (required)" type="email" value={sosSettings.email1} onChange={(e) => handleSosSettingsChange('email1', e.target.value)} />
                <Input placeholder="Email 2 (optional)" type="email" value={sosSettings.email2} onChange={(e) => handleSosSettingsChange('email2', e.target.value)} />
                <Input placeholder="Email 3 (optional)" type="email" value={sosSettings.email3} onChange={(e) => handleSosSettingsChange('email3', e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Default message template. For providing location use {'{maps}'}</Label>
              <Textarea rows={3} value={sosSettings.messageTemplate} onChange={(e) => handleSosSettingsChange('messageTemplate', e.target.value)} />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setSosSettingsOpen(false); toast({ title: 'Settings saved', description: 'Saved locally in your browser.' }); }} className="flex-1">Save</Button>
              <Button onClick={() => setSosSettingsOpen(false)} className="flex-1">Close</Button>
              <Button variant="outline" onClick={() => { resetSosSettings(); toast({ title: 'Settings reset', description: 'Reset to defaults.' }); }} className="flex-1">Reset</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Navigation Dialog */}
      <NavigationDialog
        open={showNavigation}
        onOpenChange={setShowNavigation}
        route={selectedRoute}
      />
    </div>
  );
}
