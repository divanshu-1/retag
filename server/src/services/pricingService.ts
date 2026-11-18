import axios from 'axios';
import Product from '../models/Product';
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
    const configuredUrl = process.env.ML_SERVICE_URL?.trim();
    const url = configuredUrl || (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:8010');
    return url ? url.replace(/\/$/, '') : null;
  }

  async analyzeProduct(images: string[], productDetails: PricingProductDetails): Promise<ProductAnalysis> {
    const normalizedDetails = {
      ...productDetails,
      wear_count: normalizeWearCount(productDetails.wear_count),
    };
    const mlServiceUrl = this.getMlServiceUrl();

    if (!mlServiceUrl) {
      const fallback = await aiService.analyzeProduct(images, normalizedDetails);
      fallback.price_suggestion.pricing_source = 'market_estimate';
      fallback.price_suggestion.fallback_used = true;
      return fallback;
    }

    try {
      const imageAnalysis = await aiService.analyzeImages(images, normalizedDetails);
      if (imageAnalysis.brand_detected) normalizedDetails.brand = imageAnalysis.brand_detected;
      const result = await this.applyMlPricing(mlServiceUrl, normalizedDetails, imageAnalysis);
      const learnedPrice = await this.predictFromReviewedItems(normalizedDetails, imageAnalysis);
      if (learnedPrice) {
        const modelWeight = learnedPrice.matches >= 5 ? 0.35 : 0.15;
        result.price_suggestion.suggested_price = Math.round((result.price_suggestion.suggested_price * (1 - modelWeight) + learnedPrice.price * modelWeight) / 10) * 10;
        result.price_suggestion.reasoning += ` Adjusted using ${learnedPrice.matches} similar reviewed marketplace item(s).`;
        result.price_suggestion.factors.push(`reviewed_similar_items=${learnedPrice.matches}`);
        result.price_suggestion.prediction_interval = {
          low: Math.round(Math.min(result.price_suggestion.prediction_interval?.low || learnedPrice.price, learnedPrice.low)),
          high: Math.round(Math.max(result.price_suggestion.prediction_interval?.high || learnedPrice.price, learnedPrice.high)),
        };
      }
      const marketPrice = await aiService.suggestMarketBasedPrice(imageAnalysis, normalizedDetails, normalizedDetails.brand);
      if (marketPrice) {
        const modelPrice = result.price_suggestion.suggested_price;
        const marketWeight = imageAnalysis.market_comparable_count && imageAnalysis.market_comparable_count >= 5 ? 0.25 : 0.12;
        result.price_suggestion.suggested_price = Math.round((modelPrice * (1 - marketWeight) + marketPrice.suggested_price * marketWeight) / 10) * 10;
        result.price_suggestion.reasoning += ` Retail comparable adjustment applied at ${(marketWeight * 100).toFixed(0)}% weight; comparable prices are not verified resale transactions.`;
        result.price_suggestion.market_comparison = marketPrice.market_comparison;
        result.price_suggestion.factors.push(...marketPrice.factors);
      }
      result.user_report.suggested_price = result.price_suggestion.suggested_price;
      return result;
    } catch (error) {
      console.error('ML pricing failed, using market-aware fallback:', error);
      const fallbackAnalysis = await aiService.analyzeProduct(images, normalizedDetails);
      return {
        ...fallbackAnalysis,
        price_suggestion: {
          ...fallbackAnalysis.price_suggestion,
          pricing_source: 'market_estimate',
          fallback_used: true,
        },
      };
    }
  }

  private async predictFromReviewedItems(
    details: PricingProductDetails & { wear_count?: number },
    image: ImageAnalysis
  ): Promise<{ price: number; low: number; high: number; matches: number } | null> {
    const escapedBrand = details.brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reviewed = await Product.find({
      status: { $in: ['listed', 'sold'] },
      $or: [
        { 'admin_review.final_price': { $gt: 0 } },
        { 'listed_product.price': { $gt: 0 } },
      ],
      brand: new RegExp(`^${escapedBrand}$`, 'i'),
      category: details.category,
    }).select('article brand category age wear_count damage admin_review.final_price listed_product.price').limit(300).lean();

    const candidates = reviewed.filter((item: any) => {
      const target = Number(item.admin_review?.final_price || item.listed_product?.price || 0);
      return target > 0 && item.article?.toLowerCase() === details.article.toLowerCase();
    });
    if (candidates.length < 3) return null;

    const requestedWear = Number(details.wear_count || 0);
    const weighted = candidates.map((item: any) => {
      const target = Number(item.admin_review?.final_price || item.listed_product?.price || 0);
      const wearDistance = Math.abs(Number(item.wear_count || 0) - requestedWear);
      const damageDistance = Boolean(item.damage) === Boolean(details.damage) ? 0 : 2;
      const weight = 1 / (1 + wearDistance + damageDistance);
      return { target, weight };
    });
    const totalWeight = weighted.reduce((sum: number, item: any) => sum + item.weight, 0);
    const price = weighted.reduce((sum: number, item: any) => sum + item.target * item.weight, 0) / totalWeight;
    const prices = weighted.map((item: any) => item.target).sort((a: number, b: number) => a - b);
    return { price, low: prices[0], high: prices[prices.length - 1], matches: candidates.length };
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

    const modelPrice = Math.round(response.data?.predicted_price);
    if (!Number.isFinite(modelPrice) || modelPrice <= 0) {
      throw new Error('ML service returned an invalid predicted price');
    }

    const suggestedPrice = modelPrice;

    const reasoning = response.data.reasoning?.trim() || 'Price predicted using the trained ReTag regression model.';
    const marketComparison = response.data.market_comparison?.trim()
      || 'ML estimate is based on product metadata and the reported condition signals.';
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
        factors: [...factors, `reported_condition_score=${imageAnalysis.condition_score}/10`],
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
