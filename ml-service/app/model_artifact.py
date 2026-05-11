import math
from typing import Any, Dict, List, Optional

import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.ensemble import RandomForestRegressor
from sklearn.feature_extraction import DictVectorizer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LinearRegression


class RetagPriceModel:
    def __init__(self, estimator_type: str = 'random_forest') -> None:
        self.estimator_type = estimator_type
        self.model_name = 'retag-price-regressor'
        self.model_version = 'trained-v1'
        self.text_vectorizer = TfidfVectorizer(max_features=600, ngram_range=(1, 2), min_df=1)
        self.dict_vectorizer = DictVectorizer(sparse=False)
        self.svd: Optional[TruncatedSVD] = None
        self.estimator: Any = None
        self.training_metrics: Dict[str, float] = {}

    def fit(self, records: List[Dict[str, Any]], targets: List[float]) -> 'RetagPriceModel':
        features = self._build_feature_matrix(records, fit=True)
        self.estimator = self._build_estimator()
        self.estimator.fit(features, targets)
        return self

    def predict(self, records: List[Dict[str, Any]]) -> np.ndarray:
        if self.estimator is None:
            raise ValueError('Model is not trained')

        features = self._build_feature_matrix(records, fit=False)
        return np.asarray(self.estimator.predict(features), dtype=float)

    def predict_from_payload(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        prediction = float(self.predict([payload])[0])
        prediction = max(150.0, round(prediction, 2))
        low = max(100, int(round(prediction * 0.88)))
        high = int(round(prediction * 1.12))
        confidence = self._confidence_from_payload(payload)

        factors = [
            f"brand={payload.get('brand', 'unknown')}",
            f"category={payload.get('category', 'unknown')}",
            f"quality={payload.get('image_analysis', {}).get('quality', 'unknown')}",
            f"condition_score={payload.get('image_analysis', {}).get('condition_score', 0)}",
        ]
        if payload.get('wear_count') is not None:
            factors.append(f"wear_count={payload.get('wear_count')}")
        if payload.get('damage'):
            factors.append('damage_reported')

        metrics_summary = ''
        if self.training_metrics:
            mae = self.training_metrics.get('mae')
            r2 = self.training_metrics.get('r2')
            if mae is not None and r2 is not None:
                metrics_summary = f' Training MAE={mae:.2f}, R²={r2:.3f}.'

        return {
            'predicted_price': int(round(prediction)),
            'confidence_score': confidence,
            'reasoning': (
                'Predicted by the trained ReTag regression model using product metadata, '
                'condition signals, and text features.' + metrics_summary
            ),
            'market_comparison': 'Price is based on patterns learned from resale listings used during model training.',
            'factors': factors,
            'model_name': self.model_name,
            'model_version': self.model_version,
            'price_range_low': low,
            'price_range_high': high,
        }

    def _build_estimator(self) -> Any:
        if self.estimator_type == 'linear_regression':
            return LinearRegression()

        return RandomForestRegressor(
            n_estimators=200,
            max_depth=18,
            min_samples_leaf=2,
            random_state=42,
            n_jobs=-1,
        )

    def _build_feature_matrix(self, records: List[Dict[str, Any]], fit: bool) -> np.ndarray:
        text_corpus = [self._compose_text(record) for record in records]
        structured_rows = [self._structured_features(record) for record in records]
        numeric_rows = np.asarray([self._numeric_features(record) for record in records], dtype=float)

        if fit:
            text_matrix = self.text_vectorizer.fit_transform(text_corpus)
            structured_matrix = self.dict_vectorizer.fit_transform(structured_rows)
        else:
            text_matrix = self.text_vectorizer.transform(text_corpus)
            structured_matrix = self.dict_vectorizer.transform(structured_rows)

        text_dense = self._reduce_text_matrix(text_matrix, fit=fit)
        return np.hstack([structured_matrix, numeric_rows, text_dense])

    def _reduce_text_matrix(self, matrix: Any, fit: bool) -> np.ndarray:
        n_samples, n_features = matrix.shape
        if not fit and self.svd is not None:
            return self.svd.transform(matrix)

        if n_samples < 2 or n_features < 2:
            dense = matrix.toarray()
            return dense if dense.size else np.zeros((n_samples, 1))

        max_components = min(32, n_samples - 1, n_features - 1)
        if max_components < 1:
            dense = matrix.toarray()
            return dense if dense.size else np.zeros((n_samples, 1))

        if fit:
            self.svd = TruncatedSVD(n_components=max_components, random_state=42)
            return self.svd.fit_transform(matrix)

        if self.svd is None:
            dense = matrix.toarray()
            return dense if dense.size else np.zeros((n_samples, 1))

        return self.svd.transform(matrix)

    def _compose_text(self, record: Dict[str, Any]) -> str:
        image_analysis = record.get('image_analysis') or {}
        features = image_analysis.get('features') or record.get('features') or []
        parts = [
            str(record.get('article', '')),
            str(record.get('brand', '')),
            str(record.get('category', '')),
            str(record.get('description', '')),
            str(record.get('damage', '')),
            str(image_analysis.get('caption', '')),
            ' '.join(str(item) for item in features),
        ]
        return ' '.join(part.strip() for part in parts if part).lower()

    def _structured_features(self, record: Dict[str, Any]) -> Dict[str, Any]:
        image_analysis = record.get('image_analysis') or {}
        return {
            'brand': (record.get('brand') or 'unknown').strip().lower(),
            'category': (record.get('category') or 'unknown').strip().lower(),
            'gender': (record.get('gender') or 'unknown').strip().lower(),
            'size': (record.get('size') or 'unknown').strip().lower(),
            'age': (record.get('age') or 'unknown').strip().lower(),
            'quality': (image_analysis.get('quality') or record.get('quality') or 'unknown').strip().lower(),
            'has_damage': 'yes' if self._has_damage(record.get('damage')) else 'no',
        }

    def _numeric_features(self, record: Dict[str, Any]) -> List[float]:
        image_analysis = record.get('image_analysis') or {}
        description = str(record.get('description', '') or '')
        wear_count = self._safe_float(record.get('wear_count'))
        condition_score = self._safe_float(image_analysis.get('condition_score', record.get('condition_score', 0)))
        return [
            wear_count,
            condition_score,
            len(description),
            len(description.split()),
            1.0 if self._has_damage(record.get('damage')) else 0.0,
        ]

    def _confidence_from_payload(self, payload: Dict[str, Any]) -> float:
        image_analysis = payload.get('image_analysis') or {}
        condition = self._safe_float(image_analysis.get('condition_score', 6))
        wear_count = self._safe_float(payload.get('wear_count'))
        confidence = 0.6 + min(condition / 50.0, 0.18) - min(wear_count / 100.0, 0.08)
        return max(0.4, min(0.92, round(confidence, 2)))

    def _safe_float(self, value: Any) -> float:
        try:
            result = float(value or 0)
            return 0.0 if math.isnan(result) else result
        except (TypeError, ValueError):
            return 0.0

    def _has_damage(self, value: Any) -> bool:
        text = str(value or '').strip().lower()
        return bool(text and text not in {'none', 'no', 'n/a', 'na'})
