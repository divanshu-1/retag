import os
from pathlib import Path
from typing import Any, Dict, Optional

import joblib

from .schemas import PredictRequest, PredictResponse


class PricingPredictor:
    def __init__(self) -> None:
        self.model_name = os.getenv('MODEL_NAME', 'retag-price-regressor')
        self.model_version = os.getenv('MODEL_VERSION', 'heuristic-v1')
        self.model_path = Path(os.getenv('MODEL_PATH', 'models/pricing_model.joblib'))
        self.model: Any = None
        self.load_error: Optional[str] = None

    @property
    def model_loaded(self) -> bool:
        return self.model is not None

    def load(self) -> None:
        if not self.model_path.exists():
            return

        try:
            self.model = joblib.load(self.model_path)
            self.model_name = getattr(self.model, 'model_name', self.model_name)
            self.model_version = getattr(self.model, 'model_version', self.model_version)
        except Exception as exc:  # pragma: no cover - defensive startup guard
            self.load_error = str(exc)
            self.model = None

    def predict(self, payload: PredictRequest) -> PredictResponse:
        if self.model_loaded and hasattr(self.model, 'predict_from_payload'):
            prediction = self.model.predict_from_payload(payload.model_dump())
            return PredictResponse(**prediction)

        return self._heuristic_predict(payload)

    def get_info(self) -> Dict[str, Any]:
        return {
            'model_name': self.model_name,
            'model_version': self.model_version,
            'model_loaded': self.model_loaded,
            'model_path': str(self.model_path),
            'load_error': self.load_error,
            'mode': 'artifact' if self.model_loaded else 'heuristic-fallback',
            'training_metrics': getattr(self.model, 'training_metrics', {}) if self.model_loaded else {},
        }

    def _heuristic_predict(self, payload: PredictRequest) -> PredictResponse:
        base_price = 450
        brand_bonus = {
            'nike': 350,
            'adidas': 300,
            'zara': 220,
            'levi': 260,
            'h&m': 150,
            'puma': 220,
        }
        category_bonus = {
            'outerwear': 300,
            'footwear': 280,
            'dresses': 220,
            'bags': 260,
            'formal': 180,
            'tops': 120,
            'bottoms': 140,
        }
        quality_multiplier = {
            'excellent': 1.2,
            'good': 1.0,
            'fair': 0.78,
            'poor': 0.55,
        }

        brand_key = payload.brand.lower().strip()
        category_key = payload.category.lower().strip()
        quality = payload.image_analysis.quality.lower() if payload.image_analysis else 'good'
        condition_score = payload.image_analysis.condition_score if payload.image_analysis else 7

        price = base_price
        price += brand_bonus.get(brand_key, 100)
        price += category_bonus.get(category_key, 80)
        price += condition_score * 35
        price *= quality_multiplier.get(quality, 1.0)

        if payload.wear_count:
            price -= min(payload.wear_count * 18, 180)

        if payload.damage and payload.damage.strip() and payload.damage.lower().strip() != 'none':
            price -= 120

        price = max(150, int(round(price)))
        low = max(100, int(round(price * 0.85)))
        high = int(round(price * 1.15))

        factors = [
            f'brand={payload.brand}',
            f'category={payload.category}',
            f'quality={quality}',
            f'condition_score={condition_score}',
        ]
        if payload.wear_count is not None:
            factors.append(f'wear_count={payload.wear_count}')
        if payload.damage:
            factors.append('damage_reported')

        reasoning = (
            'Predicted using the current heuristic fallback service. '
            'This will be replaced by the trained regression model once model artifacts are added.'
        )

        return PredictResponse(
            predicted_price=price,
            confidence_score=0.58,
            reasoning=reasoning,
            market_comparison='Price reflects a thrift-market estimate derived from brand, category, and condition signals.',
            factors=factors,
            model_name=self.model_name,
            model_version=self.model_version,
            price_range_low=low,
            price_range_high=high,
        )
