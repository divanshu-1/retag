import axios from 'axios';
import aiService, { ImageAnalysis, ProductAnalysis } from '../utils/aiService';

export interface PricingProductDetails {
  article: string;
  brand: string;
  category: string;
  gender?: string;
  size?: string;
  age?: string;
  wear_count?: number | string;
  damage?: string;
}

interface MlPricingResponse {
  predicted_price: number;
  confidence_score?: number;
  reasoning?: string;
  market_comparison?: string;
  factors?: string[];
  model_name?: string;
  model_version?: string;
  price_range_low?: number;
  price_range_high?: number;
}

const ML_TIMEOUT_MS = 8000;

function normalizeWearCount(wearCount?: number | string): number | undefined {
  if (typeof wearCount === 'number' && Number.isFinite(wearCount)) {
    return wearCount;
  }

  if (typeof wearCount === 'string' && wearCount.trim()) {
    const parsed = Number.parseInt(wearCount, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function clampConfidence(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(0, Math.min(1, value));
}

function buildFinalRecommendation(price: number, confidenceScore: number, reasoning: string): string {
  if (confidenceScore > 0.8) {
    return `High confidence ML recommendation: ₹${price}. ${reasoning}`;
  }

  if (confidenceScore > 0.6) {
    return `Moderate confidence ML recommendation: ₹${price}. Consider admin review for final pricing.`;
  }

  return `Low confidence ML recommendation: ₹${price}. Requires admin review and manual pricing.`;
}

function buildMlFallbackFactors(
  productDetails: PricingProductDetails,
  imageAnalysis: ImageAnalysis,
  suggestedPrice: number
): string[] {
  return [
    `brand=${productDetails.brand}`,
    `category=${productDetails.category}`,
    `quality=${imageAnalysis.quality}`,
    `condition_score=${imageAnalysis.condition_score}`,
    `suggested_price=${suggestedPrice}`,
  ];
}

function buildUserConditionLabel(quality: ImageAnalysis['quality']): string {
  switch (quality) {
    case 'excellent':
      return 'Excellent';
    case 'fair':
      return 'Fair';
    case 'poor':
      return 'Poor';
    case 'good':
    default:
      return 'Good';
  }
}

class PricingService {
  private getMlServiceUrl(): string | null {
    const url = process.env.ML_SERVICE_URL?.trim();
    return url ? url.replace(/\/$/, '') : null;
  }

  async analyzeProduct(images: string[], productDetails: PricingProductDetails): Promise<ProductAnalysis> {
    const normalizedDetails = {
      ...productDetails,
      wear_count: normalizeWearCount(productDetails.wear_count),
    };
    const mlServiceUrl = this.getMlServiceUrl();

    if (!mlServiceUrl) {
      return aiService.analyzeProduct(images, normalizedDetails);
    }

    const imageAnalysis = aiService.analyzeImageForMl(images[0], normalizedDetails.category);

    try {
      return await this.applyMlPricing(mlServiceUrl, normalizedDetails, imageAnalysis);
    } catch (error) {
      console.error('ML pricing failed, using baseline AI pricing:', error);
      const fallbackAnalysis = await aiService.analyzeProduct(images, normalizedDetails);
      return {
        ...fallbackAnalysis,
        price_suggestion: {
          ...fallbackAnalysis.price_suggestion,
          fallback_used: true,
        },
      };
    }
  }

  private async applyMlPricing(
    mlServiceUrl: string,
    productDetails: Omit<PricingProductDetails, 'wear_count'> & { wear_count?: number },
    imageAnalysis: ImageAnalysis
  ): Promise<ProductAnalysis> {
    const response = await axios.post<MlPricingResponse>(
      `${mlServiceUrl}/predict`,
      {
        ...productDetails,
        image_analysis: imageAnalysis,
      },
      {
        timeout: ML_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const suggestedPrice = Math.round(response.data?.predicted_price);
    if (!Number.isFinite(suggestedPrice) || suggestedPrice <= 0) {
      throw new Error('ML service returned an invalid predicted price');
    }

    const reasoning = response.data.reasoning?.trim() || 'Price predicted using the ML pricing service.';
    const marketComparison = response.data.market_comparison?.trim()
      || 'Price predicted from the ML pricing model using product metadata and image-derived condition signals.';
    const confidenceScore = clampConfidence(response.data.confidence_score, 0.7);
    const factors = response.data.factors?.length
      ? response.data.factors
      : buildMlFallbackFactors(productDetails, imageAnalysis, suggestedPrice);
    const userCondition = buildUserConditionLabel(imageAnalysis.quality);

    return {
      image_analysis: imageAnalysis,
      price_suggestion: {
        suggested_price: suggestedPrice,
        reasoning,
        market_comparison: marketComparison,
        confidence_score: confidenceScore,
        factors,
        pricing_source: 'ml_service',
        model_name: response.data.model_name,
        model_version: response.data.model_version,
        prediction_interval: {
          low: response.data.price_range_low,
          high: response.data.price_range_high,
        },
        fallback_used: false,
      },
      final_recommendation: buildFinalRecommendation(suggestedPrice, confidenceScore, reasoning),
      user_report: {
        condition: userCondition,
        suggested_price: suggestedPrice,
        explanation: `Based on your item's brand, ${userCondition.toLowerCase()} condition, and the trained ML pricing model, this is a fair resale price for your ${productDetails.category}.`,
        market_comparison: marketComparison,
      },
    };
  }
}

export default new PricingService();