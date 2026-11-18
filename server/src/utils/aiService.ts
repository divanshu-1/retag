import axios from 'axios';

// Types for AI analysis
export interface ImageAnalysis {
  caption: string;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  category: string;
  brand_detected?: string;

  condition_score: number; // 1-10
  features: string[];
  ocr_text?: string;
  market_retail_price?: number;
  market_retail_min?: number;
  market_retail_max?: number;
  market_comparable_count?: number;
  ocr_available?: boolean;
}

export interface PriceSuggestion {
  suggested_price: number;
  reasoning: string;
  market_comparison: string;
  confidence_score: number; // 0-1
  factors: string[];
  pricing_source?: 'legacy_ai' | 'ml_service' | 'market_estimate';
  model_name?: string;
  model_version?: string;
  prediction_interval?: {
    low?: number;
    high?: number;
  };
  fallback_used?: boolean;
}

export interface ProductAnalysis {
  image_analysis: ImageAnalysis;
  price_suggestion: PriceSuggestion;
  final_recommendation: string;
  user_report: {
    condition: string;
    suggested_price: number;
    explanation: string;
    market_comparison?: string;
  };
}

// SERP API price fetcher
async function fetchSerpPrice(brand: string, category: string, article: string, ocrText = '') {
  const SERP_API_KEY = process.env.SERP_API_KEY;
  if (!SERP_API_KEY) return null;
  try {
    const query = encodeURIComponent(`${brand} ${article} ${category} India`);
    const url = `https://serpapi.com/search.json?q=${query}&engine=google_shopping&api_key=${SERP_API_KEY}`;
    const response = await axios.get(url);
    const products = response.data?.shopping_results || [];
    if (products.length > 0) {
      const itemTerms = `${article} ${category}`.toLowerCase().split(/\W+/).filter((token) => token.length > 3 && !['clothing', 'fashion', 'apparel', 'other'].includes(token));
      const brandToken = brand.toLowerCase().trim();
      const matched = products.filter((product: any) => {
        const title = String(product.title || '').toLowerCase();
        return title.includes(brandToken) && (itemTerms.length === 0 || itemTerms.some((token) => title.includes(token)));
      });
      const prices = matched.map((p: any) => {
        const raw = String(p.extracted_price ?? p.price ?? '');
        const value = Number(raw.replace(/[^\d.]/g, ''));
        return Number.isFinite(value) && value >= 200 && value <= 200000 ? value : null;
      }).filter((value: number | null): value is number => value !== null);
      if (prices.length > 0) {
        prices.sort((a: number, b: number) => a - b);
        const median = prices.length % 2
          ? prices[Math.floor(prices.length / 2)]
          : (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2;
        return {
          min: Math.min(...prices),
          max: Math.max(...prices),
          avg: Math.round(median),
          count: prices.length,
          query: `${brand} ${article} ${category}`
        };
      }
    }
    return null;
  } catch (err) {
    console.error('SERP API error:', err);
    return null;
  }
}

async function detectTextWithPaddleOCR(imagesBase64: string[]): Promise<{ text: string; labels: string[]; logos: string[]; qualityScores: number[]; available: boolean }> {
  try {
    const configuredUrl = process.env.ML_SERVICE_URL?.trim();
    const serviceUrl = configuredUrl || (process.env.NODE_ENV === 'production'
      ? 'https://retag-ml-service.onrender.com'
      : 'http://127.0.0.1:8010');
    if (!serviceUrl) return { text: '', labels: [], logos: [], qualityScores: [], available: false };
    const response = await axios.post(`${serviceUrl.replace(/\/$/, '')}/ocr`, { images: imagesBase64 }, { timeout: 90000 });
    return {
      text: String(response.data?.text || ''),
      labels: [],
      logos: [],
      qualityScores: [],
      available: Boolean(response.data?.available)
    };
  } catch (err) {
    console.error('PaddleOCR request error:', err);
    return { text: '', labels: [], logos: [], qualityScores: [], available: false };
  }
}

function extractTextBrand(text: string): string | undefined {
  const aliases: Record<string, string[]> = {
    Nike: ['nike'], Adidas: ['adidas'], Puma: ['puma'], "Levi's": ["levi's", 'levis'],
    Zara: ['zara'], 'H&M': ['h&m', 'h and m'], Gucci: ['gucci'], 'Louis Vuitton': ['louis vuitton'],
    Reebok: ['reebok'], 'Under Armour': ['under armour'], Fila: ['fila'], 'Tommy Hilfiger': ['tommy hilfiger'],
    'Calvin Klein': ['calvin klein'], Superdry: ['superdry'], 'Jack & Jones': ['jack & jones', 'jack and jones'],
    Wrangler: ['wrangler'], 'Pepe Jeans': ['pepe jeans'], Lee: ['lee'], 'Allen Solly': ['allen solly'],
    'Van Heusen': ['van heusen'], Arrow: ['arrow'], Biba: ['biba'], Mango: ['mango'], Diesel: ['diesel'],
    Roadster: ['roadster'], HRX: ['hrx'], Mufti: ['mufti'], 'Flying Machine': ['flying machine'],
  };
  const normalized = text.toLowerCase().replace(/[^a-z0-9& ]/g, ' ').replace(/\s+/g, ' ').trim();
  return Object.entries(aliases).find(([, names]) => names.some((name) => ` ${normalized} `.includes(` ${name} `)))?.[0];
}

function normalizeBrand(text: string): string | undefined {
  const brands = ['Nike', 'Adidas', 'Puma', 'Levi\'s', 'Zara', 'H&M', 'Gucci', 'Louis Vuitton', 'Reebok', 'Under Armour', 'Fila', 'Tommy Hilfiger', 'Calvin Klein', 'Superdry', 'Jack & Jones', 'Wrangler', 'Pepe Jeans', 'Lee', 'Allen Solly', 'Van Heusen', 'Arrow', 'Biba', 'Mango', 'Diesel', 'Roadster', 'HRX', 'Mufti', 'Flying Machine'];
  const normalized = text.toLowerCase().replace(/[^a-z0-9& ]/g, ' ');
  return brands.find((brand) => normalized.includes(brand.toLowerCase().replace(/[^a-z0-9& ]/g, ' ')));
}

function conditionFromDetails(details: { wear_count?: number; age?: string; damage?: string }): number {
  let score = 8;
  const wear = Number(details.wear_count || 0);
  score -= Math.min(3, Math.floor(wear / 3));
  if (details.age === '2-3') score -= 1;
  if (details.age === '>3') score -= 2;
  if (details.damage?.trim()) score -= 2;
  return Math.max(2, Math.min(10, score));
}




// Gemini API for price suggestion
class GeminiService {
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    if (!this.apiKey) {
      console.warn('Gemini API key not found. Price suggestions will be limited.');
    }
  }

  async suggestPrice(
    imageAnalysis: ImageAnalysis,
    productDetails: {
      article: string;
      brand: string;
      gender?: string;
      size?: string;
      age?: string;
      wear_count?: number;
      damage?: string;
    }
  ): Promise<PriceSuggestion> {
    if (!this.apiKey) {
      return this.fallbackPriceSuggestion(productDetails);
    }

    try {
      const prompt = this.buildPricePrompt(imageAnalysis, productDetails);
      
      const response = await axios.post(
        `${this.baseUrl}/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      const suggestion = this.parseGeminiResponse(response.data);
      return suggestion;
    } catch (error) {
      console.error('Gemini API error:', error);
      return this.fallbackPriceSuggestion(productDetails);
    }
  }

  async suggestPriceWithSerp(
    imageAnalysis: ImageAnalysis,
    productDetails: any,
    serpPrices: { min: number; max: number; avg: number } | null
  ): Promise<PriceSuggestion> {
    if (!this.apiKey) {
      return this.fallbackPriceSuggestion(productDetails, serpPrices);
    }
    try {
      const prompt = this.buildPricePromptWithSerp(imageAnalysis, productDetails, serpPrices);
      const response = await axios.post(
        `${this.baseUrl}/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{ text: prompt }]
          }]
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      const suggestion = this.parseGeminiResponse(response.data);
      return suggestion;
    } catch (error) {
      console.error('Gemini API error:', error);
      return this.fallbackPriceSuggestion(productDetails, serpPrices);
    }
  }

  private buildPricePrompt(imageAnalysis: ImageAnalysis, productDetails: any): string {
    return `You are an expert fashion appraiser for a second-hand clothing marketplace called ReTag. \n\nAnalyze this item and suggest a fair market price in Indian Rupees (INR):\n\n**Item Details:**\n- Article: ${productDetails.article}\n- Brand: ${productDetails.brand}\n- Gender: ${productDetails.gender || 'Not specified'}\n- Size: ${productDetails.size || 'Not specified'}\n- Age: ${productDetails.age || 'Not specified'}\n- Times worn: ${productDetails.wear_count || 'Not specified'}\n- Damage: ${productDetails.damage || 'None reported'}\n\n**AI Image Analysis:**\n- Caption: ${imageAnalysis.caption}\n- Quality: ${imageAnalysis.quality}\n- Category: ${imageAnalysis.category}\n- Condition Score: ${imageAnalysis.condition_score}/10\n- Features: ${imageAnalysis.features.join(', ')}\n\n**Market Context:**\n- This is for the Indian market\n- Consider similar items on platforms like Myntra, Amazon, Flipkart\n- Factor in the second-hand nature and condition\n- Be conservative but fair\n\n**Response Format (JSON only):**\n{\n  "suggested_price": <price_in_inr>,\n  "reasoning": "<detailed explanation>",\n  "market_comparison": "<comparison with new prices>",\n  "confidence_score": <0.0-1.0>,\n  "factors": ["factor1", "factor2", "factor3"]\n}\n\nProvide only the JSON response, no additional text.`;
  }

  private buildPricePromptWithSerp(
    imageAnalysis: ImageAnalysis,
    productDetails: any,
    serpPrices: { min: number; max: number; avg: number } | null
  ): string {
    let serpText = '';
    if (serpPrices) {
      serpText = `\n\n**Market Price Reference:**\n- New items of this brand/category in India are typically priced between ₹${serpPrices.min} and ₹${serpPrices.max} (avg: ₹${serpPrices.avg}).`;
    }
    return `You are an expert fashion appraiser for a second-hand clothing marketplace.\n\nAnalyze this item and suggest a fair resale price in Indian Rupees (INR) for a used/pre-owned item.\n\n**Instructions:**\n- The resale price should typically be 40–60% of the new price, depending on condition, age, and times worn.\n- Be conservative and realistic.\n- Consider the second-hand nature, wear, and any reported damage.\n- Do NOT mention any competitor or e-commerce platform by name.\n- Use only the information below.\n- Provide only the JSON response, no additional text.\n\n**Item Details:**\n- Article: ${productDetails.article}\n- Brand: ${productDetails.brand}\n- Gender: ${productDetails.gender || 'Not specified'}\n- Size: ${productDetails.size || 'Not specified'}\n- Age: ${productDetails.age || 'Not specified'}\n- Times worn: ${productDetails.wear_count || 'Not specified'}\n- Damage: ${productDetails.damage || 'None reported'}\n\n**AI Image Analysis:**\n- Caption: ${imageAnalysis.caption}\n- Quality: ${imageAnalysis.quality}\n- Category: ${imageAnalysis.category}\n- Condition Score: ${imageAnalysis.condition_score}/10\n- Features: ${imageAnalysis.features.join(', ')}${serpText}\n\n**Response Format (JSON only):**\n{\n  "suggested_price": <price_in_inr>,\n  "reasoning": "<detailed explanation>",\n  "market_comparison": "<comparison with new prices>",\n  "confidence_score": <0.0-1.0>,\n  "factors": ["factor1", "factor2", "factor3"]\n}`;
  }

  private parseGeminiResponse(response: any): PriceSuggestion {
    try {
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          suggested_price: parsed.suggested_price || 500,
          reasoning: parsed.reasoning || 'Based on market analysis',
          market_comparison: parsed.market_comparison || 'Comparable to similar items',
          confidence_score: parsed.confidence_score || 0.7,
          factors: parsed.factors || ['brand', 'condition', 'market demand'],
          pricing_source: 'legacy_ai',
          fallback_used: false
        };
      }
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
    }
    
    return this.fallbackPriceSuggestion({});
  }

  // Optionally, apply a discount factor in fallbackPriceSuggestion
  private fallbackPriceSuggestion(productDetails: any, serpPrices?: { min: number; max: number; avg: number } | null): PriceSuggestion {
    // Use SERP price if available, otherwise base price
    let basePrice = 500;
    if (serpPrices && serpPrices.avg) {
      // Apply 40–60% discount for used items
      basePrice = Math.round(serpPrices.avg * 0.5);
    } else if (productDetails.brand?.toLowerCase().includes('nike')) {
      basePrice = 800;
    }
    return {
      suggested_price: basePrice,
      reasoning: 'Based on standard market rates for second-hand clothing (typically 40–60% of new price)',
      market_comparison: 'Similar to other pre-owned items in the market',
      confidence_score: 0.6,
      factors: ['brand reputation', 'general condition', 'market demand'],
      pricing_source: 'legacy_ai',
      fallback_used: true
    };
  }
}

// Main AI service class
export class AIService {
  private gemini: GeminiService;

  constructor() {
    this.gemini = new GeminiService();
  }

  async analyzeImage(imageBase64: string, userCategory: string): Promise<ImageAnalysis> {
    return this.analyzeImages([imageBase64], { article: 'clothing item', brand: '', category: userCategory });
  }

  async analyzeImages(
    imagesBase64: string[],
    details: { article: string; brand: string; category: string; age?: string; wear_count?: number; damage?: string }
  ): Promise<ImageAnalysis> {
    const visionResult = await detectTextWithPaddleOCR(imagesBase64);
    const combinedText = visionResult.text;
    const detectedBrand = extractTextBrand(combinedText) || normalizeBrand(combinedText);
    const ocrText = visionResult.text.replace(/\s+/g, ' ').trim().slice(0, 500);
    const conditionScore = conditionFromDetails(details);
    const quality = conditionScore >= 9 ? 'excellent' : conditionScore >= 7 ? 'good' : conditionScore >= 5 ? 'fair' : 'poor';
    const ocrAvailable = visionResult.available;
    const confidence = detectedBrand
      ? 'Brand matched from tag text.'
      : ocrAvailable ? 'No known brand was matched in the tag text; using seller entry.' : 'PaddleOCR service unavailable; tag text was not analyzed.';
    const market = await fetchSerpPrice(detectedBrand || details.brand, details.category, details.article, ocrText);
    return {
      caption: `${confidence} OCR text: ${ocrText || 'none detected'}. Condition reflects declared wear and damage; image condition is not yet visually graded.`,
      quality,
      category: details.category,
      brand_detected: detectedBrand,
      condition_score: conditionScore,
      features: detectedBrand ? [`OCR brand: ${detectedBrand}`] : [],
      ocr_text: ocrText || undefined,
      market_retail_price: market?.avg,
      market_retail_min: market?.min,
      market_retail_max: market?.max,
      market_comparable_count: market?.count,
      ocr_available: ocrAvailable
    };
  }

  // Kept only for callers that explicitly need a neutral metadata-based baseline.
  private localImageAnalysis(_imageBase64: string, userCategory: string): ImageAnalysis {
    return { caption: 'Image analysis unavailable; condition is unverified.', quality: 'good', category: userCategory, condition_score: 6, features: [] };
  }

  // HuggingFace image analysis
  async analyzeImageWithHuggingFace(imageBase64: string) {
    const HF_API_TOKEN = process.env.HUGGING_FACE_API_KEY;
    if (!HF_API_TOKEN) {
      throw new Error('HuggingFace API key not found');
    }
    try {
    const response = await axios.post(
        'https://router.huggingface.co/hf-inference/models/google/vit-base-patch16-224',
        { inputs: imageBase64 },
        {
          headers: {
            Authorization: `Bearer ${HF_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );
      return response.data;
    } catch (error) {
      console.error('HuggingFace API error:', error);
      throw new Error('Failed to analyze image with HuggingFace');
    }
  }

  async analyzeProduct(
    images: string[], // Base64 encoded images
    productDetails: {
      article: string;
      brand: string;
      category: string;
      gender?: string;
      size?: string;
      age?: string;
      wear_count?: number;
      damage?: string;
    }
  ): Promise<ProductAnalysis> {
    try {
      const imageAnalysis = await this.analyzeImages(images, productDetails);
      // Use detected brand if found
      const brandForPricing = imageAnalysis.brand_detected || productDetails.brand;
      // Fetch real prices from SERP API
      const serpPrices = imageAnalysis.market_retail_price ? {
        min: imageAnalysis.market_retail_min || imageAnalysis.market_retail_price,
        max: imageAnalysis.market_retail_max || imageAnalysis.market_retail_price,
        avg: imageAnalysis.market_retail_price,
        count: imageAnalysis.market_comparable_count || 1
      } : null;
      // Get price suggestion using Gemini
      const priceSuggestion = serpPrices
        ? this.marketBasedPrice(imageAnalysis, productDetails, brandForPricing, serpPrices)
        : await this.gemini.suggestPriceWithSerp(imageAnalysis, { ...productDetails, brand: brandForPricing }, null);
      // Generate final recommendation
      const finalRecommendation = this.generateFinalRecommendation(imageAnalysis, priceSuggestion);
      // Generate user-facing report
      let userCondition = '';
      switch (imageAnalysis.quality) {
        case 'excellent': userCondition = 'Excellent'; break;
        case 'good': userCondition = 'Good'; break;
        case 'fair': userCondition = 'Fair'; break;
        case 'poor': userCondition = 'Poor'; break;
        default: userCondition = 'Good';
      }
      const userReport = {
        condition: userCondition,
        suggested_price: priceSuggestion.suggested_price,
        explanation: `Based on your item's brand, its ${userCondition.toLowerCase()} condition, and current market trends, this is a fair resale price for your ${imageAnalysis.category}.`,
        market_comparison: serpPrices ? `New ${brandForPricing} ${imageAnalysis.category} typically sell for ₹${serpPrices.min}–₹${serpPrices.max}.` : undefined
      };
      return {
        image_analysis: imageAnalysis,
        price_suggestion: priceSuggestion,
        final_recommendation: finalRecommendation,
        user_report: userReport
      };
    } catch (error) {
      console.error('AI analysis error:', error);
      throw new Error('Failed to analyze product');
    }
  }

  private marketBasedPrice(
    imageAnalysis: ImageAnalysis,
    details: { wear_count?: number; age?: string; damage?: string },
    brand: string,
    retail: { min: number; max: number; avg: number; count?: number }
  ): PriceSuggestion {
    const conditionFactor = 0.25 + ((imageAnalysis.condition_score - 1) / 9) * 0.35;
    const wearPenalty = Math.min(0.18, Math.max(0, Number(details.wear_count || 0)) * 0.02);
    const agePenalty = details.age === '>3' ? 0.1 : details.age === '2-3' ? 0.05 : 0;
    const damagePenalty = details.damage?.trim() ? 0.12 : 0;
    const resaleFactor = Math.max(0.1, Math.min(0.6, conditionFactor - wearPenalty - agePenalty - damagePenalty));
    const price = Math.max(150, Math.round((retail.avg * resaleFactor) / 10) * 10);
    return {
      suggested_price: price,
      reasoning: `Comparable retail median ₹${retail.avg}; resale factor ${(resaleFactor * 100).toFixed(0)}% applied for condition, age, wear, and reported damage.`,
      market_comparison: `Google Shopping returned ${retail.count || 'several'} comparable listings from ₹${retail.min} to ₹${retail.max}; this is a retail reference, not a verified used-item sale price.`,
      confidence_score: imageAnalysis.brand_detected && (retail.count || 0) >= 3 ? 0.72 : (retail.count || 0) >= 3 ? 0.58 : 0.4,
      factors: [`brand=${brand}`, `retail_median=${retail.avg}`, `condition_score=${imageAnalysis.condition_score}/10`, `resale_factor=${resaleFactor.toFixed(2)}`],
      pricing_source: 'market_estimate',
      fallback_used: false
    };
  }

  async suggestMarketBasedPrice(
    imageAnalysis: ImageAnalysis,
    details: { wear_count?: number; age?: string; damage?: string },
    brand: string
  ): Promise<PriceSuggestion | null> {
    if (!imageAnalysis.market_retail_price) return null;
    const retail = {
      min: imageAnalysis.market_retail_price,
      max: imageAnalysis.market_retail_price,
      avg: imageAnalysis.market_retail_price,
      count: 1
    };
    return this.marketBasedPrice(imageAnalysis, details, brand, retail);
  }

  private generateFinalRecommendation(
    imageAnalysis: ImageAnalysis,
    priceSuggestion: PriceSuggestion
  ): string {
    const quality = imageAnalysis.quality;
    const confidence = priceSuggestion.confidence_score;
    
    if (confidence > 0.8) {
      return `High confidence recommendation: ₹${priceSuggestion.suggested_price}. ${priceSuggestion.reasoning}`;
    } else if (confidence > 0.6) {
      return `Moderate confidence recommendation: ₹${priceSuggestion.suggested_price}. Consider admin review for final pricing.`;
    } else {
      return `Low confidence recommendation: ₹${priceSuggestion.suggested_price}. Requires admin review and manual pricing.`;
    }
  }
}

export default new AIService();
