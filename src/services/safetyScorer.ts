/**
 * Road Safety Scoring Engine
 * 
 * ⚠️ IMPORTANT: This engine uses RELATIVE SAFETY SCORING
 * 
 * Similar to JEE Main examination's relative grading system:
 * - Routes are compared against each other
 * - The safest route among alternatives gets the highest score
 * - The riskiest route gets the lowest score
 * - Scores are distributed relative to the available options
 * 
 * This is NOT an absolute safety score of the road.
 * The same road may have different scores depending on the alternatives available.
 */

// ============== TYPE DEFINITIONS ==============

export type WeatherCondition = 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog';
export type CrimeLevel = 'low' | 'medium' | 'high';
export type LightingLevel = 'well_lit' | 'partially_lit' | 'dark';
export type RoadType = 'highway' | 'main_road' | 'residential' | 'alley';
export type SafetyCategory = 'Safest Option' | 'Moderate Option' | 'Least Safe Option';

export interface RouteInputData {
  routeId: string;
  distanceKm: number;
  durationMin: number;
  turnCount: number;
  roadType?: RoadType;
  crimeLevel?: CrimeLevel;
  lightingLevel?: LightingLevel;
}

export interface EnvironmentData {
  currentHour: number; // 0-23
  weatherCondition: WeatherCondition;
}

export interface RiskFactors {
  distanceRisk: number;
  durationRisk: number;
  turnRisk: number;
  timeRisk: number;
  weatherRisk: number;
  crimeRisk: number;
  lightingRisk: number;
  roadTypeRisk: number;
  totalRawRisk: number; // Raw risk score before relative adjustment
}

export interface SafetyResult {
  routeId: string;
  safetyScore: number;           // Relative score (0-100)
  rawRiskScore: number;          // Absolute risk score for transparency
  safetyCategory: SafetyCategory;
  explanation: string;
  riskFactors: RiskFactors;
  highlights: string[];
  recommendations: string[];
  rank: number;                  // 1 = safest, 2 = middle, 3 = riskiest
  isRelativeScore: boolean;      // Always true - indicates relative scoring
}

// ============== WEIGHTS CONFIGURATION ==============

const WEIGHTS = {
  crime: 0.25,
  lighting: 0.15,
  time: 0.15,
  distance: 0.10,
  duration: 0.10,
  roadType: 0.10,
  weather: 0.10,
  turn: 0.05,
} as const;

// ============== RELATIVE SCORE RANGES ==============
// These define the score ranges for each rank position

const RELATIVE_SCORE_RANGES = {
  // Best route (Rank 1): Gets score between 75-92
  safest: { min: 75, max: 92 },
  // Middle route (Rank 2): Gets score between 58-74
  moderate: { min: 58, max: 74 },
  // Worst route (Rank 3): Gets score between 42-57
  riskiest: { min: 42, max: 57 },
} as const;

// ============== RISK CALCULATION FUNCTIONS ==============

/**
 * Distance Risk: Longer distance increases exposure
 * Formula: min(distance_km / 10, 1)
 */
function calculateDistanceRisk(distanceKm: number): number {
  return Math.min(distanceKm / 10, 1);
}

/**
 * Duration Risk: Slower routes may indicate congestion or isolation
 * Formula: min(duration_min / 30, 1)
 */
function calculateDurationRisk(durationMin: number): number {
  return Math.min(durationMin / 30, 1);
}

/**
 * Turn Risk: More turns reduce visibility and predictability
 * Formula: min(turnCount / 20, 1)
 */
function calculateTurnRisk(turnCount: number): number {
  return Math.min(turnCount / 20, 1);
}

/**
 * Time of Day Risk
 * Night (22:00-05:00) → 1.0
 * Evening/Morning (19:00-22:00, 05:00-07:00) → 0.6
 * Day (07:00-19:00) → 0.2
 */
function calculateTimeRisk(hour: number): number {
  if (hour >= 22 || hour <= 5) return 1.0;
  if (hour >= 19 || hour <= 7) return 0.6;
  return 0.2;
}

/**
 * Weather Risk
 * clear → 0.1, cloudy → 0.3, rain → 0.6, storm → 0.9, fog → 0.9
 */
function calculateWeatherRisk(weather: WeatherCondition): number {
  const weatherRiskMap: Record<WeatherCondition, number> = {
    clear: 0.1,
    cloudy: 0.3,
    rain: 0.6,
    storm: 0.9,
    fog: 0.9,
  };
  return weatherRiskMap[weather] ?? 0.3;
}

/**
 * Crime Risk
 * low → 0.2, medium → 0.5, high → 0.9
 */
function calculateCrimeRisk(crimeLevel: CrimeLevel): number {
  const crimeRiskMap: Record<CrimeLevel, number> = {
    low: 0.2,
    medium: 0.5,
    high: 0.9,
  };
  return crimeRiskMap[crimeLevel] ?? 0.5;
}

/**
 * Lighting Risk
 * well_lit → 0.2, partially_lit → 0.5, dark → 0.9
 */
function calculateLightingRisk(lightingLevel: LightingLevel): number {
  const lightingRiskMap: Record<LightingLevel, number> = {
    well_lit: 0.2,
    partially_lit: 0.5,
    dark: 0.9,
  };
  return lightingRiskMap[lightingLevel] ?? 0.5;
}

/**
 * Road Type Risk
 * highway → 0.3, main_road → 0.4, residential → 0.6, alley → 0.8
 */
function calculateRoadTypeRisk(roadType: RoadType): number {
  const roadTypeRiskMap: Record<RoadType, number> = {
    highway: 0.3,
    main_road: 0.4,
    residential: 0.6,
    alley: 0.8,
  };
  return roadTypeRiskMap[roadType] ?? 0.5;
}

// ============== HELPER FUNCTIONS ==============

/**
 * Get safety category based on rank (relative scoring)
 */
function getSafetyCategory(rank: number, totalRoutes: number): SafetyCategory {
  if (totalRoutes === 1) return 'Safest Option';
  if (rank === 1) return 'Safest Option';
  if (rank === totalRoutes) return 'Least Safe Option';
  return 'Moderate Option';
}

/**
 * Generate human-readable explanation for relative scoring
 */
function generateExplanation(
  riskFactors: RiskFactors,
  rank: number,
  totalRoutes: number,
  _environment: EnvironmentData
): string {
  const parts: string[] = [];

  // Rank-based intro
  if (rank === 1) {
    parts.push('This is the SAFEST option among available routes');
  } else if (rank === totalRoutes) {
    parts.push('This route has the highest relative risk among alternatives');
  } else {
    parts.push('This route offers a balanced option between safety and convenience');
  }

  // Key factors affecting this route
  const keyFactors: string[] = [];
  
  if (riskFactors.crimeRisk >= 0.7) keyFactors.push('higher crime area');
  else if (riskFactors.crimeRisk <= 0.3) keyFactors.push('lower crime area');
  
  if (riskFactors.lightingRisk >= 0.7) keyFactors.push('limited lighting');
  else if (riskFactors.lightingRisk <= 0.3) keyFactors.push('well-lit streets');
  
  if (riskFactors.timeRisk >= 0.8) keyFactors.push('late night travel');
  else if (riskFactors.timeRisk <= 0.3) keyFactors.push('daytime travel');

  if (riskFactors.distanceRisk >= 0.7) keyFactors.push('longer distance');
  else if (riskFactors.distanceRisk <= 0.3) keyFactors.push('shorter distance');

  if (keyFactors.length > 0) {
    parts.push(`Key factors: ${keyFactors.join(', ')}`);
  }

  return parts.join('. ') + '.';
}

/**
 * Generate safety highlights based on risk factors and rank
 */
function generateHighlights(riskFactors: RiskFactors, rank: number, totalRoutes: number, environment: EnvironmentData): string[] {
  const highlights: string[] = [];

  // Rank-based highlight
  if (rank === 1) {
    highlights.push('✓ Safest among all alternatives');
  } else if (rank === totalRoutes && totalRoutes > 1) {
    highlights.push('⚠ Highest risk among alternatives');
  }

  // Positive highlights (low risk factors)
  if (riskFactors.crimeRisk <= 0.3) highlights.push('Lower crime area');
  if (riskFactors.lightingRisk <= 0.3) highlights.push('Well-lit streets');
  if (riskFactors.timeRisk <= 0.3) highlights.push('Safe travel time');
  if (riskFactors.roadTypeRisk <= 0.4) highlights.push('Main roads preferred');
  if (riskFactors.weatherRisk <= 0.2) highlights.push('Clear weather conditions');
  if (riskFactors.turnRisk <= 0.3) highlights.push('Straightforward route');
  if (riskFactors.distanceRisk <= 0.3) highlights.push('Short distance');

  // Negative highlights (high risk factors)
  if (riskFactors.crimeRisk >= 0.7) highlights.push('Higher crime area - stay alert');
  if (riskFactors.lightingRisk >= 0.7) highlights.push('Limited street lighting');
  if (riskFactors.timeRisk >= 0.8) highlights.push('Late night travel');
  if (riskFactors.roadTypeRisk >= 0.7) highlights.push('Includes narrow streets/alleys');
  if (riskFactors.weatherRisk >= 0.7) highlights.push(`${environment.weatherCondition} weather advisory`);

  // Ensure at least 3 highlights
  if (highlights.length < 3) {
    if (!highlights.some(h => h.includes('traffic'))) highlights.push('Moderate traffic expected');
    if (!highlights.some(h => h.includes('conditions'))) highlights.push('Standard route conditions');
  }

  return highlights.slice(0, 5);
}

/**
 * Generate safety recommendations based on rank and risk factors
 */
function generateRecommendations(riskFactors: RiskFactors, rank: number, totalRoutes: number): string[] {
  const recommendations: string[] = [];

  // Always include basic recommendation
  recommendations.push('Share your live location with trusted contacts');

  // Rank-based recommendations
  if (rank === 1) {
    recommendations.push('This is your safest option - recommended');
  } else if (rank === totalRoutes && totalRoutes > 1) {
    recommendations.push('Consider the safest alternative if possible');
  }

  // Time-based recommendations
  if (riskFactors.timeRisk >= 0.8) {
    recommendations.push('Consider traveling with a companion at night');
    recommendations.push('Keep your phone charged and accessible');
  }

  // Crime-based recommendations
  if (riskFactors.crimeRisk >= 0.7) {
    recommendations.push('Stay on well-populated streets');
  }

  // Lighting-based recommendations
  if (riskFactors.lightingRisk >= 0.7) {
    recommendations.push('Stay aware of your surroundings');
  }

  return recommendations.slice(0, 4);
}

// ============== MAIN SCORING FUNCTION ==============

/**
 * Calculate RAW risk score for a route (internal use)
 * Returns a risk value between 0-1 (higher = more risky)
 */
function calculateRawRiskScore(
  route: RouteInputData,
  environment: EnvironmentData
): { riskFactors: RiskFactors; totalRisk: number } {
  // Apply default values for missing data
  const crimeLevel = route.crimeLevel ?? 'medium';
  const lightingLevel = route.lightingLevel ?? 'partially_lit';
  const roadType = route.roadType ?? 'residential';

  // Calculate all risk factors (0-1 scale)
  const riskFactors: RiskFactors = {
    distanceRisk: calculateDistanceRisk(route.distanceKm),
    durationRisk: calculateDurationRisk(route.durationMin),
    turnRisk: calculateTurnRisk(route.turnCount),
    timeRisk: calculateTimeRisk(environment.currentHour),
    weatherRisk: calculateWeatherRisk(environment.weatherCondition),
    crimeRisk: calculateCrimeRisk(crimeLevel),
    lightingRisk: calculateLightingRisk(lightingLevel),
    roadTypeRisk: calculateRoadTypeRisk(roadType),
    totalRawRisk: 0, // Will be calculated below
  };

  // Apply weights and calculate total risk score
  const totalRisk =
    riskFactors.crimeRisk * WEIGHTS.crime +
    riskFactors.lightingRisk * WEIGHTS.lighting +
    riskFactors.timeRisk * WEIGHTS.time +
    riskFactors.distanceRisk * WEIGHTS.distance +
    riskFactors.durationRisk * WEIGHTS.duration +
    riskFactors.roadTypeRisk * WEIGHTS.roadType +
    riskFactors.weatherRisk * WEIGHTS.weather +
    riskFactors.turnRisk * WEIGHTS.turn;

  riskFactors.totalRawRisk = totalRisk;

  return { riskFactors, totalRisk };
}

/**
 * Calculate RELATIVE safety score based on position among alternatives
 * Uses JEE Main-style relative grading
 */
function calculateRelativeScore(
  rank: number,
  totalRoutes: number,
  rawRisk: number,
  allRawRisks: number[]
): number {
  // If only one route, give it a good score based on its raw risk
  if (totalRoutes === 1) {
    // Single route: Use modified absolute scoring (more lenient)
    return Math.round(Math.max(55, Math.min(90, (1 - rawRisk) * 100 + 15)));
  }

  // Get the score range based on rank
  let scoreRange: { min: number; max: number };
  if (rank === 1) {
    scoreRange = RELATIVE_SCORE_RANGES.safest;
  } else if (rank === totalRoutes) {
    scoreRange = RELATIVE_SCORE_RANGES.riskiest;
  } else {
    scoreRange = RELATIVE_SCORE_RANGES.moderate;
  }

  // Calculate position within the score range based on how different this route is
  // from the best/worst routes
  const minRisk = Math.min(...allRawRisks);
  const maxRisk = Math.max(...allRawRisks);
  const riskSpread = maxRisk - minRisk;

  let positionInRange: number;
  if (riskSpread < 0.01) {
    // All routes have similar risk - give them all good scores
    positionInRange = 0.7; // Upper part of range
  } else {
    // Normalize position: 0 = lowest risk, 1 = highest risk
    const normalizedRisk = (rawRisk - minRisk) / riskSpread;
    // Invert for score (lower risk = higher position in range)
    positionInRange = 1 - normalizedRisk;
  }

  // Calculate final score within the range
  const score = scoreRange.min + (scoreRange.max - scoreRange.min) * positionInRange;
  
  return Math.round(score);
}

/**
 * Calculate safety scores for multiple routes using RELATIVE SCORING
 * 
 * This is the main function to use - it compares routes against each other
 * similar to JEE Main's relative grading system.
 */
export function calculateMultipleRoutesSafety(
  routes: RouteInputData[],
  environment: EnvironmentData
): SafetyResult[] {
  if (routes.length === 0) return [];

  // Step 1: Calculate raw risk scores for all routes
  const routeRisks = routes.map(route => ({
    route,
    ...calculateRawRiskScore(route, environment),
  }));

  // Step 2: Rank routes by risk (lower risk = better rank)
  const sortedByRisk = [...routeRisks].sort((a, b) => a.totalRisk - b.totalRisk);
  const allRawRisks = routeRisks.map(r => r.totalRisk);

  // Step 3: Assign ranks and calculate relative scores
  const results: SafetyResult[] = routeRisks.map(({ route, riskFactors, totalRisk }) => {
    // Find rank (1 = safest)
    const rank = sortedByRisk.findIndex(r => r.route.routeId === route.routeId) + 1;
    
    // Calculate relative safety score
    const safetyScore = calculateRelativeScore(rank, routes.length, totalRisk, allRawRisks);
    
    // Generate category and explanations
    const safetyCategory = getSafetyCategory(rank, routes.length);
    const explanation = generateExplanation(riskFactors, rank, routes.length, environment);
    const highlights = generateHighlights(riskFactors, rank, routes.length, environment);
    const recommendations = generateRecommendations(riskFactors, rank, routes.length);

    return {
      routeId: route.routeId,
      safetyScore,
      rawRiskScore: Math.round(totalRisk * 100), // Convert to 0-100 for display
      safetyCategory,
      explanation,
      riskFactors,
      highlights,
      recommendations,
      rank,
      isRelativeScore: true,
    };
  });

  return results;
}

/**
 * @deprecated Use calculateMultipleRoutesSafety instead for relative scoring
 * This function is kept for backward compatibility but now redirects to relative scoring
 */
export function calculateRouteSafetyScore(
  route: RouteInputData,
  environment: EnvironmentData
): SafetyResult {
  // Single route - use the multi-route function
  const results = calculateMultipleRoutesSafety([route], environment);
  return results[0];
}

// ============== UTILITY FUNCTIONS ==============

/**
 * Parse distance string to kilometers
 * Examples: "2.5 km" → 2.5, "500 m" → 0.5
 */
export function parseDistanceToKm(distanceStr: string): number {
  const lower = distanceStr.toLowerCase();
  const num = parseFloat(distanceStr.replace(/[^\d.]/g, ''));
  
  if (isNaN(num)) return 1; // Default 1 km
  
  if (lower.includes('km')) {
    return num;
  } else if (lower.includes('m')) {
    return num / 1000;
  }
  
  return num;
}

/**
 * Parse duration string to minutes
 * Examples: "15 min" → 15, "1 hour 30 min" → 90
 */
export function parseDurationToMin(durationStr: string): number {
  const lower = durationStr.toLowerCase();
  let totalMinutes = 0;
  
  // Extract hours
  const hourMatch = lower.match(/(\d+)\s*(?:hour|hr|h)/);
  if (hourMatch) {
    totalMinutes += parseInt(hourMatch[1]) * 60;
  }
  
  // Extract minutes
  const minMatch = lower.match(/(\d+)\s*(?:min|m(?!ile))/);
  if (minMatch) {
    totalMinutes += parseInt(minMatch[1]);
  }
  
  return totalMinutes || 10; // Default 10 minutes
}

/**
 * Detect road type from step instructions
 */
export function detectRoadType(instructions: string): RoadType {
  const lower = instructions.toLowerCase();
  
  if (lower.includes('highway') || lower.includes('expressway') || lower.includes('motorway')) {
    return 'highway';
  }
  if (lower.includes('main') || lower.includes('national') || lower.includes('state road') || lower.includes('avenue')) {
    return 'main_road';
  }
  if (lower.includes('alley') || lower.includes('gali') || lower.includes('lane') || lower.includes('path')) {
    return 'alley';
  }
  
  return 'residential';
}

/**
 * Estimate lighting level based on road type and time
 */
export function estimateLightingLevel(roadType: RoadType, hour: number): LightingLevel {
  const isNight = hour >= 19 || hour <= 6;
  
  if (!isNight) return 'well_lit'; // Daytime
  
  // Night time lighting estimation
  switch (roadType) {
    case 'highway':
    case 'main_road':
      return 'well_lit';
    case 'residential':
      return 'partially_lit';
    case 'alley':
      return 'dark';
    default:
      return 'partially_lit';
  }
}

// ============== CRIME DATA (Sample for demonstration) ==============

// This can be replaced with actual API data
const CRIME_DATA_BY_AREA: Record<string, CrimeLevel> = {
  // Add known areas with their crime levels
  // Format: 'area_name': crime_level
  'connaught place': 'medium',
  'karol bagh': 'medium',
  'chandni chowk': 'high',
  'saket': 'low',
  'vasant kunj': 'low',
  'dwarka': 'low',
  'rohini': 'medium',
  'nehru place': 'medium',
  'lajpat nagar': 'medium',
  'greater kailash': 'low',
  // Add more areas as needed
};

/**
 * Get crime level for a location (from dataset or API)
 */
export function getCrimeLevelForLocation(address: string): CrimeLevel {
  const lowerAddress = address.toLowerCase();
  
  for (const [area, level] of Object.entries(CRIME_DATA_BY_AREA)) {
    if (lowerAddress.includes(area)) {
      return level;
    }
  }
  
  // Default to medium if area not found
  return 'medium';
}

// ============== WEATHER INTEGRATION ==============

/**
 * Fetch current weather (placeholder - implement with actual API)
 * Free APIs: OpenWeatherMap, WeatherAPI.com
 */
export async function getCurrentWeather(_lat: number, _lng: number): Promise<WeatherCondition> {
  // TODO: Implement actual weather API call
  // For now, return clear as default
  
  // Example implementation with OpenWeatherMap:
  // const API_KEY = import.meta.env.VITE_OPENWEATHERMAP_API_KEY;
  // if (!API_KEY) return 'clear';
  // 
  // try {
  //   const response = await fetch(
  //     `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${API_KEY}`
  //   );
  //   const data = await response.json();
  //   const main = data.weather[0].main.toLowerCase();
  //   
  //   if (main.includes('rain')) return 'rain';
  //   if (main.includes('storm') || main.includes('thunder')) return 'storm';
  //   if (main.includes('fog') || main.includes('mist')) return 'fog';
  //   if (main.includes('cloud')) return 'cloudy';
  //   return 'clear';
  // } catch {
  //   return 'clear';
  // }
  
  return 'clear';
}

// ============== EXPORT SERVICE ==============

export const safetyScorer = {
  calculateRouteSafetyScore,
  calculateMultipleRoutesSafety,
  parseDistanceToKm,
  parseDurationToMin,
  detectRoadType,
  estimateLightingLevel,
  getCrimeLevelForLocation,
  getCurrentWeather,
};

export default safetyScorer;
