/**
 * Firebase Location-based Safety Feedback System
 * 
 * This service handles:
 * - Area-based safety feedback (not point-based)
 * - Grid ID generation from GPS coordinates
 * - Aggregated safety counts per area
 * - Optional user experience reports
 * - Abuse prevention (1 feedback per user per grid per 24 hours)
 */

import { 
  doc, 
  getDoc, 
  setDoc, 
  addDoc,
  collection, 
  runTransaction,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';
// @ts-ignore - Firebase config is a JS file
import app, { auth, db } from '@/config/firebase';

// ============== TYPE DEFINITIONS ==============

export interface AreaSafetyData {
  safeCount: number;
  unsafeCount: number;
  lastUpdated: Timestamp | null;
}

export interface SafetyRatings {
  // Compulsory ratings (out of 5)
  lighting: number;        // Street lighting quality
  crowdedness: number;     // How crowded/populated the area is
  roadCondition: number;   // Road/sidewalk condition
  
  // Optional ratings (out of 5, 0 means not rated)
  visibility: number;      // Clear sightlines, no hidden corners
  publicTransport: number; // Availability of public transport
  emergencyAccess: number; // Access to help points/police stations
  
  // Overall safety score given by user (out of 10)
  overallSafetyScore: number;
}

export interface AreaReport {
  id?: string;
  gridId: string;
  userId: string;
  isSafe: boolean;
  experienceText: string;
  timestamp: Timestamp;
  ratings?: SafetyRatings; // New: detailed ratings
}

export interface UserGridFeedback {
  lastSubmittedAt: Timestamp;
}

export interface FeedbackResult {
  success: boolean;
  message: string;
  gridId?: string;
  newSafetyScore?: number;
}

// ============== GRID ID GENERATION ==============

/**
 * Generate a grid ID from latitude and longitude
 * Rounds to 2 decimal places (~200-300 meter grid cells)
 * 
 * @param latitude - GPS latitude
 * @param longitude - GPS longitude
 * @returns Grid ID string in format "lat_lng"
 */
export function getGridId(latitude: number, longitude: number): string {
  // Round to 2 decimal places
  const lat = Math.round(latitude * 100) / 100;
  const lng = Math.round(longitude * 100) / 100;
  
  // Format with fixed decimals to ensure consistency
  return `${lat.toFixed(2)}_${lng.toFixed(2)}`;
}

/**
 * Parse grid ID back to coordinates (for display purposes)
 */
export function parseGridId(gridId: string): { lat: number; lng: number } | null {
  const parts = gridId.split('_');
  if (parts.length !== 2) return null;
  
  const lat = parseFloat(parts[0]);
  const lng = parseFloat(parts[1]);
  
  if (isNaN(lat) || isNaN(lng)) return null;
  
  return { lat, lng };
}

// ============== SAFETY SCORE CALCULATION ==============

/**
 * Calculate area safety score from counts
 * Returns 50 (neutral) if no data exists
 * 
 * @param safeCount - Number of safe reports
 * @param unsafeCount - Number of unsafe reports
 * @returns Safety score (0-100)
 */
export function calculateAreaSafetyScore(safeCount: number, unsafeCount: number): number {
  const total = safeCount + unsafeCount;
  
  if (total === 0) {
    return 50; // Neutral score when no data
  }
  
  return Math.round((safeCount / total) * 100);
}

// ============== ABUSE PREVENTION ==============

/**
 * Check if user can submit feedback for a grid
 * Enforces 24-hour cooldown per user per grid
 */
async function canUserSubmitFeedback(userId: string, gridId: string): Promise<{ canSubmit: boolean; hoursRemaining?: number }> {
  const feedbackDocId = `${userId}_${gridId}`;
  const feedbackRef = doc(db, 'userGridFeedbacks', feedbackDocId);
  
  try {
    const feedbackSnap = await getDoc(feedbackRef);
    
    if (!feedbackSnap.exists()) {
      return { canSubmit: true }; // No previous feedback
    }
    
    const data = feedbackSnap.data() as UserGridFeedback;
    const lastSubmitted = data.lastSubmittedAt.toDate();
    const now = new Date();
    const hoursSinceLastSubmit = (now.getTime() - lastSubmitted.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceLastSubmit >= 24) {
      return { canSubmit: true };
    }
    
    return { 
      canSubmit: false, 
      hoursRemaining: Math.ceil(24 - hoursSinceLastSubmit) 
    };
  } catch (error) {
    console.error('Error checking feedback eligibility:', error);
    return { canSubmit: false, hoursRemaining: 24 }; // Fail safe - don't allow if error
  }
}

/**
 * Public function to check if user can submit feedback
 * Returns eligibility status and hours remaining if not eligible
 */
export async function checkFeedbackEligibility(gridId: string): Promise<{ canSubmit: boolean; hoursRemaining?: number; message?: string }> {
  const user = auth.currentUser;
  
  if (!user) {
    return { 
      canSubmit: false, 
      message: 'You must be logged in to submit feedback' 
    };
  }
  
  const result = await canUserSubmitFeedback(user.uid, gridId);
  
  if (!result.canSubmit) {
    return {
      canSubmit: false,
      hoursRemaining: result.hoursRemaining,
      message: `You already submitted feedback for this area. Try again in ${result.hoursRemaining} hour${result.hoursRemaining !== 1 ? 's' : ''}.`
    };
  }
  
  return { canSubmit: true };
}

/**
 * Record that user submitted feedback for a grid
 */
async function recordUserFeedback(userId: string, gridId: string): Promise<void> {
  const feedbackDocId = `${userId}_${gridId}`;
  const feedbackRef = doc(db, 'userGridFeedbacks', feedbackDocId);
  
  await setDoc(feedbackRef, {
    lastSubmittedAt: serverTimestamp()
  });
}

// ============== AREA SAFETY DATA ==============

/**
 * Get safety data for a specific grid
 */
export async function getAreaSafetyData(gridId: string): Promise<AreaSafetyData | null> {
  try {
    const areaRef = doc(db, 'areas', gridId);
    const areaSnap = await getDoc(areaRef);
    
    if (!areaSnap.exists()) {
      return null;
    }
    
    return areaSnap.data() as AreaSafetyData;
  } catch (error) {
    console.error('Error fetching area safety data:', error);
    return null;
  }
}

/**
 * Get safety score for a specific grid
 */
export async function getAreaSafetyScore(gridId: string): Promise<number> {
  const data = await getAreaSafetyData(gridId);
  
  if (!data) {
    return 50; // Neutral score when no data
  }
  
  return calculateAreaSafetyScore(data.safeCount, data.unsafeCount);
}

/**
 * Get safety scores for multiple grids (used for route evaluation)
 */
export async function getMultipleAreaSafetyScores(gridIds: string[]): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  
  // Remove duplicates
  const uniqueGridIds = [...new Set(gridIds)];
  
  // Fetch all in parallel
  const promises = uniqueGridIds.map(async (gridId) => {
    const score = await getAreaSafetyScore(gridId);
    scores.set(gridId, score);
  });
  
  await Promise.all(promises);
  
  return scores;
}

// ============== SUBMIT FEEDBACK ==============

/**
 * Submit safety feedback for an area
 * Uses Firestore transaction for concurrency safety
 * 
 * @param latitude - Current GPS latitude
 * @param longitude - Current GPS longitude
 * @param isSafe - true = safe, false = unsafe
 * @param experienceText - Optional experience description
 * @param ratings - Optional detailed safety ratings
 */
export async function submitSafetyFeedback(
  latitude: number,
  longitude: number,
  isSafe: boolean,
  experienceText?: string,
  ratings?: SafetyRatings
): Promise<FeedbackResult> {
  // Check if user is authenticated
  const user = auth.currentUser;
  if (!user) {
    return {
      success: false,
      message: 'You must be logged in to submit feedback'
    };
  }
  
  const userId = user.uid;
  const gridId = getGridId(latitude, longitude);
  
  // Check abuse prevention (24-hour cooldown)
  const eligibility = await canUserSubmitFeedback(userId, gridId);
  if (!eligibility.canSubmit) {
    return {
      success: false,
      message: `You already submitted feedback for this area. Try again in ${eligibility.hoursRemaining} hour${eligibility.hoursRemaining !== 1 ? 's' : ''}.`,
      gridId
    };
  }
  
  try {
    // STEP 1: Update area counts using transaction
    const areaRef = doc(db, 'areas', gridId);
    
    await runTransaction(db, async (transaction) => {
      const areaDoc = await transaction.get(areaRef);
      
      if (!areaDoc.exists()) {
        // Create new area document
        transaction.set(areaRef, {
          safeCount: isSafe ? 1 : 0,
          unsafeCount: isSafe ? 0 : 1,
          lastUpdated: serverTimestamp()
        });
      } else {
        // Update existing counts
        const currentData = areaDoc.data() as AreaSafetyData;
        transaction.update(areaRef, {
          safeCount: isSafe ? currentData.safeCount + 1 : currentData.safeCount,
          unsafeCount: isSafe ? currentData.unsafeCount : currentData.unsafeCount + 1,
          lastUpdated: serverTimestamp()
        });
      }
    });
    
    // STEP 2: Record user feedback timestamp (abuse prevention)
    await recordUserFeedback(userId, gridId);
    
    // STEP 3: Add detailed report with ratings
    const reportData: any = {
      gridId,
      userId,
      isSafe,
      experienceText: experienceText?.trim() || '',
      timestamp: serverTimestamp()
    };
    
    // Add ratings if provided
    if (ratings) {
      reportData.ratings = ratings;
    }
    
    await addDoc(collection(db, 'areaReports'), reportData);
    
    // Get updated safety score
    const newScore = await getAreaSafetyScore(gridId);
    
    return {
      success: true,
      message: isSafe 
        ? 'Thank you! Area marked as safe.' 
        : 'Thank you! Area marked as unsafe. Stay safe!',
      gridId,
      newSafetyScore: newScore
    };
    
  } catch (error) {
    console.error('Error submitting safety feedback:', error);
    return {
      success: false,
      message: 'Failed to submit feedback. Please try again.'
    };
  }
}

// ============== AREA REPORTS ==============

/**
 * Get recent reports for an area
 */
export async function getAreaReports(gridId: string, maxResults: number = 10): Promise<AreaReport[]> {
  try {
    const reportsRef = collection(db, 'areaReports');
    const q = query(
      reportsRef,
      where('gridId', '==', gridId),
      orderBy('timestamp', 'desc'),
      limit(maxResults)
    );
    
    const querySnapshot = await getDocs(q);
    const reports: AreaReport[] = [];
    
    querySnapshot.forEach((doc) => {
      reports.push({
        id: doc.id,
        ...doc.data()
      } as AreaReport);
    });
    
    return reports;
  } catch (error) {
    console.error('Error fetching area reports:', error);
    return [];
  }
}

// ============== ROUTE SAFETY INTEGRATION ==============

/**
 * Calculate community safety score for a route
 * Decodes route into grid points and averages their scores
 * 
 * @param routePoints - Array of {lat, lng} points along the route
 * @returns Average community safety score (0-100)
 */
export async function calculateRouteCommunityScore(
  routePoints: Array<{ lat: number; lng: number }>
): Promise<{ score: number; coveredGrids: number; totalGrids: number }> {
  if (routePoints.length === 0) {
    return { score: 50, coveredGrids: 0, totalGrids: 0 };
  }
  
  // Convert all points to grid IDs
  const gridIds = routePoints.map(point => getGridId(point.lat, point.lng));
  
  // Remove duplicates
  const uniqueGridIds = [...new Set(gridIds)];
  
  // Fetch safety scores for all grids
  const scores = await getMultipleAreaSafetyScores(uniqueGridIds);
  
  // Calculate statistics
  let totalScore = 0;
  let gridsWithData = 0;
  
  scores.forEach((score, _gridId) => {
    totalScore += score;
    // Check if grid has actual data (not default 50)
    if (score !== 50) {
      gridsWithData++;
    }
  });
  
  const averageScore = uniqueGridIds.length > 0 
    ? Math.round(totalScore / uniqueGridIds.length) 
    : 50;
  
  return {
    score: averageScore,
    coveredGrids: gridsWithData,
    totalGrids: uniqueGridIds.length
  };
}

/**
 * Decode Google Maps polyline into coordinate points
 * (Simplified - samples points along the route)
 */
export function decodePolylineToPoints(
  encodedPolyline: string, 
  sampleInterval: number = 5
): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  
  let index = 0;
  let lat = 0;
  let lng = 0;
  let pointCount = 0;
  
  while (index < encodedPolyline.length) {
    // Decode latitude
    let shift = 0;
    let result = 0;
    let byte: number;
    
    do {
      byte = encodedPolyline.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;
    
    // Decode longitude
    shift = 0;
    result = 0;
    
    do {
      byte = encodedPolyline.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;
    
    // Sample every N points to reduce data
    if (pointCount % sampleInterval === 0) {
      points.push({
        lat: lat / 1e5,
        lng: lng / 1e5
      });
    }
    pointCount++;
  }
  
  return points;
}

// ============== CURRENT LOCATION HELPER ==============

/**
 * Get user's current GPS location
 */
export function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Location permission denied. Please enable location access.'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Location information unavailable.'));
            break;
          case error.TIMEOUT:
            reject(new Error('Location request timed out.'));
            break;
          default:
            reject(new Error('Failed to get location.'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );
  });
}

// ============== APP FEEDBACK & RATING ==============

export interface AppFeedback {
  rating: number;
  feedbackText: string;
  timestamp: Timestamp;
  userId: string;
}

/**
 * Check if user has already submitted app feedback
 * Returns the existing feedback if found
 */
export async function getExistingAppFeedback(): Promise<AppFeedback | null> {
  const user = auth.currentUser;
  if (!user) return null;
  
  try {
    const feedbackRef = doc(db, 'appFeedbacks', user.uid);
    const feedbackSnap = await getDoc(feedbackRef);
    
    if (feedbackSnap.exists()) {
      return feedbackSnap.data() as AppFeedback;
    }
    return null;
  } catch (error) {
    console.error('Error checking app feedback:', error);
    return null;
  }
}

/**
 * Submit app rating and feedback
 * Each user can only submit once (permanent)
 */
export async function submitAppFeedback(
  rating: number,
  feedbackText: string
): Promise<{ success: boolean; message: string }> {
  const user = auth.currentUser;
  if (!user) {
    return {
      success: false,
      message: 'You must be logged in to submit feedback'
    };
  }
  
  // Check if user already submitted
  const existing = await getExistingAppFeedback();
  if (existing) {
    return {
      success: false,
      message: 'You have already submitted your feedback. Thank you!'
    };
  }
  
  try {
    const feedbackRef = doc(db, 'appFeedbacks', user.uid);
    await setDoc(feedbackRef, {
      rating,
      feedbackText: feedbackText.trim(),
      timestamp: serverTimestamp(),
      userId: user.uid
    });
    
    return {
      success: true,
      message: 'Thank you for your valuable feedback!'
    };
  } catch (error) {
    console.error('Error submitting app feedback:', error);
    return {
      success: false,
      message: 'Failed to submit feedback. Please try again.'
    };
  }
}

// ============== EXPORT SERVICE ==============

export const firebaseSafetyService = {
  // Grid utilities
  getGridId,
  parseGridId,
  
  // Safety data
  getAreaSafetyData,
  getAreaSafetyScore,
  getMultipleAreaSafetyScores,
  calculateAreaSafetyScore,
  
  // Feedback submission
  submitSafetyFeedback,
  checkFeedbackEligibility,
  
  // Reports
  getAreaReports,
  
  // Route integration
  calculateRouteCommunityScore,
  decodePolylineToPoints,
  
  // Location
  getCurrentLocation,
  
  // App feedback
  getExistingAppFeedback,
  submitAppFeedback,
};

export default firebaseSafetyService;
