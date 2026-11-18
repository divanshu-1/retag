from typing import List, Optional

from pydantic import BaseModel, Field


class ImageAnalysisInput(BaseModel):
    caption: str
    quality: str
    category: str
    condition_score: int = Field(ge=0, le=10)
    features: List[str] = Field(default_factory=list)
    brand_detected: Optional[str] = None
    ocr_text: Optional[str] = None
    market_retail_price: Optional[float] = Field(default=None, ge=0)


class PredictRequest(BaseModel):
    article: str
    brand: str
    category: str
    gender: Optional[str] = None
    size: Optional[str] = None
    age: Optional[str] = None
    wear_count: Optional[int] = Field(default=None, ge=0)
    damage: Optional[str] = None
    image_analysis: Optional[ImageAnalysisInput] = None


class PredictResponse(BaseModel):
    predicted_price: int
    confidence_score: float = Field(ge=0, le=1)
    reasoning: str
    market_comparison: str
    factors: List[str]
    model_name: str
    model_version: str
    price_range_low: int
    price_range_high: int
