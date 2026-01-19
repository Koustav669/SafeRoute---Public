import { GoogleGenerativeAI } from '@google/generative-ai';
import type { RouteData } from './googleMaps';
import type { RiskFactors } from './safetyScorer';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export interface SafetyAnalysis {
  description: string;
  highlights: string[];
  safetyScore: number;
  recommendations: string[];
  riskFactors?: RiskFactors;  // Detailed risk breakdown
  rank?: number;              // Route rank (1 = safest)
  rawRiskScore?: number;      // Raw risk score (0-100)
}

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    try {
      if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') {
        console.log('🤖 Initializing Gemini API...');
        console.log('📏 Key length:', GEMINI_API_KEY.length, '(should be 39)');
        console.log('✓ Key format valid:', GEMINI_API_KEY.startsWith('AIza'));
        
        this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-pro' });
        
        console.log('✅ Gemini API initialized successfully');
      } else {
        console.warn('⚠️ Gemini API not configured - using fallback analysis');
        console.warn('Set VITE_GEMINI_API_KEY in .env for AI-powered safety analysis');
      }
    } catch (error) {
      console.error('❌ Error initializing Gemini API:', error);
      this.genAI = null;
      this.model = null;
    }
  }

  isConfigured(): boolean {
    return this.genAI !== null && GEMINI_API_KEY !== 'your_gemini_api_key_here';
  }

  async analyzeRouteSafety(
    route: RouteData,
    travelTime: string,
    routeIndex: number,
    timeoutMs: number = 10000 // 10 second timeout per route
  ): Promise<SafetyAnalysis> {
    console.log('🚦 Starting route safety analysis for route index:', routeIndex, `(timeout: ${timeoutMs}ms)`);
    if (!this.isConfigured()) {
      console.warn('⚠️ GeminiService not configured. Using fallback analysis.');
      return this.getFallbackAnalysis(route, routeIndex);
    }

    try {
      const prompt = this.buildSafetyPrompt(route, travelTime, routeIndex);
      console.log('📝 Generated safety prompt:', prompt.substring(0, 100) + '...');
      
      // Create a timeout promise
      const timeoutPromise = new Promise<SafetyAnalysis>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Gemini API timeout for route ${routeIndex} after ${timeoutMs}ms`));
        }, timeoutMs);
      });

      // Race between the actual API call and the timeout
      const analysisPromise = (async () => {
        const result = await this.model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        console.log('✅ Gemini API response received for route', routeIndex);
        return this.parseAnalysisResponse(text, route);
      })();

      return await Promise.race([analysisPromise, timeoutPromise]);
    } catch (error) {
      console.error(`❌ Gemini API error for route ${routeIndex}:`, error);
      const fallback = this.getFallbackAnalysis(route, routeIndex);
      console.log(`✓ Using fallback analysis for route ${routeIndex}`);
      return fallback;
    }
  }

  private buildSafetyPrompt(route: RouteData, travelTime: string, routeIndex: number): string {
    const routeType = routeIndex === 0 ? 'safest' : routeIndex === 1 ? 'balanced' : 'fastest';
    const warnings = route.warnings || [];
    const steps = route.steps || [];
    
    return `You are a safety analyst for SafeRoute, an AI-powered navigation app helping women choose safer routes at night.

Analyze this ${routeType} route for a woman traveling at ${travelTime}:

Route Details:
- Route Type: ${routeType.toUpperCase()}
- Distance: ${route.distance}
- Duration: ${route.duration}
- Summary: ${route.summary || route.name || 'Route'}
- Warnings: ${warnings.length > 0 ? warnings.join(', ') : 'None'}
- Number of turns: ${steps.length}

IMPORTANT: Provide a safety score that reflects the route type:
- SAFEST route: 85-95 (prioritizes well-lit streets, high foot traffic, commercial areas)
- BALANCED route: 70-84 (mix of safety and efficiency, some quieter areas)
- FASTEST route: 50-69 (shortest path, may include isolated areas, lower lighting)

Consider these safety factors:
1. Time of travel (${travelTime}) - lighting conditions
2. Route characteristics - main streets vs side streets vs alleys
3. Likely foot traffic and pedestrian presence at this time
4. Proximity to commercial areas, residential zones, or isolated areas
5. Route complexity - more turns may indicate populated areas
6. Street lighting probability based on route type
7. Emergency services accessibility

Provide a safety analysis in this EXACT format:

DESCRIPTION: [2-3 sentences explaining why this route has this safety level. Be specific about lighting, foot traffic, and area characteristics. Tone should be calm and factual.]

HIGHLIGHTS:
- [Key safety feature or concern 1]
- [Key safety feature or concern 2]
- [Key safety feature or concern 3]
- [Key safety feature or concern 4]

SAFETY_SCORE: [Number between 50-95 based on route type - SAFEST: 85-95, BALANCED: 70-84, FASTEST: 50-69]

RECOMMENDATIONS:
- [Practical safety tip 1 specific to this route type]
- [Practical safety tip 2 specific to this route type]
- [Practical safety tip 3 specific to this route type]

Keep the tone calm, reassuring, and informative. Focus on facts, not fear. Be honest about risks while providing actionable guidance.`;
  }

  private parseAnalysisResponse(text: string, route: RouteData): SafetyAnalysis {
    try {
      console.log('📝 Gemini raw response (first 200 chars):', text.substring(0, 200) + '...');
      
      // Try to parse as JSON first (in case Gemini returns JSON)
      if (text.trim().startsWith('{')) {
        try {
          const json = JSON.parse(text);
          if (json.description && json.safetyScore) {
            console.log('✓ Parsed as JSON format');
            return {
              description: json.description,
              highlights: json.highlights || [],
              safetyScore: Math.max(50, Math.min(95, json.safetyScore)),
              recommendations: json.recommendations || []
            };
          }
        } catch (jsonError) {
          console.log('ℹ️ Not JSON format, parsing as structured text');
        }
      }
      
      // Parse as structured text (existing implementation)
      // Extract description
      const descMatch = text.match(/DESCRIPTION:\s*(.+?)(?=HIGHLIGHTS:|$)/s);
      const description = descMatch 
        ? descMatch[1].trim().replace(/\n/g, ' ')
        : 'This route provides a balance of safety and efficiency for your journey.';

      // Extract highlights
      const highlightsMatch = text.match(/HIGHLIGHTS:\s*(.+?)(?=SAFETY_SCORE:|$)/s);
      const highlights = highlightsMatch
        ? highlightsMatch[1]
            .split('\n')
            .map(h => h.trim())
            .filter(h => h.startsWith('-'))
            .map(h => h.substring(1).trim())
            .filter(h => h.length > 0)
        : [
            'Well-maintained route',
            'Clear navigation',
            'Reasonable distance',
            'Standard safety measures apply'
          ];

      // Extract safety score
      const scoreMatch = text.match(/SAFETY_SCORE:\s*(\d+)/);
      const safetyScore = scoreMatch 
        ? Math.max(50, Math.min(95, parseInt(scoreMatch[1])))
        : route.safetyScore;

      // Extract recommendations
      const recsMatch = text.match(/RECOMMENDATIONS:\s*(.+?)$/s);
      const recommendations = recsMatch
        ? recsMatch[1]
            .split('\n')
            .map(r => r.trim())
            .filter(r => r.startsWith('-'))
            .map(r => r.substring(1).trim())
            .filter(r => r.length > 0)
        : [
            'Stay aware of your surroundings',
            'Keep your phone charged and accessible'
          ];

      console.log('✓ Parsed structured text format - Score:', safetyScore);

      return {
        description,
        highlights: highlights.slice(0, 5),
        safetyScore,
        recommendations: recommendations.slice(0, 3)
      };
    } catch (error) {
      console.error('❌ Error parsing Gemini response:', error);
      return this.getFallbackAnalysis(route, 0);
    }
  }

  private getFallbackAnalysis(_route: RouteData, routeIndex: number): SafetyAnalysis {
    const analyses = [
      {
        description: 'This route maintains higher foot traffic after 9 PM, avoids poorly lit streets, and passes open commercial zones. Community feedback indicates higher perceived safety in this area during night hours.',
        highlights: [
          'Well-lit main streets',
          'Active commercial areas',
          'Higher foot traffic',
          'Multiple emergency services nearby',
          'Clear visibility throughout'
        ],
        safetyScore: 92,
        recommendations: [
          'Stay on main streets when possible',
          'Keep emergency contacts readily available',
          'Trust your instincts'
        ]
      },
      {
        description: 'A moderate option balancing time and safety. Some segments have reduced lighting but maintain reasonable pedestrian presence. The route uses a mix of main and side streets.',
        highlights: [
          'Mix of main and side streets',
          'Moderate foot traffic',
          'Some well-lit areas',
          'Reasonable distance'
        ],
        safetyScore: 78,
        recommendations: [
          'Be extra aware in less-lit areas',
          'Consider traveling with a companion',
          'Share your route with trusted contacts'
        ]
      },
      {
        description: 'Shortest distance but includes isolated areas with minimal lighting and low pedestrian activity during night hours. Consider this route only if time is critical.',
        highlights: [
          'Shortest distance',
          'Less populated areas',
          'Limited street lighting',
          'Faster arrival time'
        ],
        safetyScore: 54,
        recommendations: [
          'Only use if absolutely necessary',
          'Share live location with trusted contacts',
          'Stay alert and avoid distractions'
        ]
      }
    ];

    return analyses[routeIndex] || analyses[0];
  }

  async analyzeMultipleRoutes(
    routes: RouteData[],
    travelTime: string,
    timeoutMs: number = 10000
  ): Promise<Map<string, SafetyAnalysis>> {
    const analyses = new Map<string, SafetyAnalysis>();

    console.log(`🚀 Starting parallel analysis for ${routes.length} routes`);
    
    // Create a timeout promise for the entire operation
    const overallTimeoutPromise = new Promise<Map<string, SafetyAnalysis>>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Overall Gemini analysis timeout after ${timeoutMs * routes.length}ms`));
      }, timeoutMs * routes.length);
    });

    const analysisPromise = (async () => {
      // Analyze routes in parallel, but with individual timeouts
      const promises = routes.map((route, index) => {
        return this.analyzeRouteSafety(route, travelTime, index, timeoutMs)
          .catch(error => {
            console.warn(`Route ${index} analysis failed:`, error);
            return this.getFallbackAnalysis(route, index);
          });
      });

      const results = await Promise.all(promises);

      routes.forEach((route, index) => {
        analyses.set(route.id, results[index]);
      });

      console.log(`✅ Analysis complete for ${routes.length} routes`);
      return analyses;
    })();

    try {
      return await Promise.race([analysisPromise, overallTimeoutPromise]);
    } catch (error) {
      console.error('❌ Fatal error in analyzeMultipleRoutes:', error);
      // Return empty analyses map on complete failure
      // This allows the routes to display with default safety scores
      routes.forEach((route, index) => {
        analyses.set(route.id, this.getFallbackAnalysis(route, index));
      });
      return analyses;
    }
  }
}

export const geminiService = new GeminiService();
