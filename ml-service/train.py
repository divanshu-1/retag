import argparse
import csv
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import joblib
import numpy as np
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.model_selection import train_test_split

from app.model_artifact import RetagPriceModel


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Train the ReTag ML pricing model')
    parser.add_argument('--data', default='data/retag_sample_training.csv', help='Path to CSV/TSV training data')
    parser.add_argument('--output', default='models/pricing_model.joblib', help='Where to save the model artifact')
    return parser.parse_args()


def load_rows(path: Path) -> List[Dict[str, str]]:
    delimiter = '\t' if path.suffix.lower() == '.tsv' else ','
    with path.open('r', encoding='utf-8', newline='') as handle:
        reader = csv.DictReader(handle, delimiter=delimiter)
        return [dict(row) for row in reader]


def normalize_row(row: Dict[str, str]) -> Tuple[Optional[Dict[str, Any]], Optional[float]]:
    if 'brand_name' in row and 'item_condition_id' in row:
        return normalize_mercari_row(row)
    return normalize_retag_style_row(row)


def normalize_mercari_row(row: Dict[str, str]) -> Tuple[Optional[Dict[str, Any]], Optional[float]]:
    price = safe_float(row.get('price'))
    if price is None or price <= 0:
      return None, None

    category_raw = (row.get('category_name') or 'Other').strip()
    top_category = category_raw.split('/')[0] if category_raw else 'Other'
    condition_id = int(safe_float(row.get('item_condition_id')) or 3)
    condition_score = max(1, 12 - (condition_id * 2))
    quality = quality_from_condition(condition_id)
    description = (row.get('item_description') or '').replace('No description yet', '').strip()
    damage = infer_damage(description)

    record = {
        'article': (row.get('name') or 'Unknown Item').strip(),
        'brand': (row.get('brand_name') or 'Unknown').strip(),
        'category': top_category,
        'description': description,
        'damage': damage,
        'gender': None,
        'size': None,
        'age': None,
        'wear_count': max(0, condition_id - 1),
        'image_analysis': {
            'caption': description[:160],
            'quality': quality,
            'category': top_category,
            'condition_score': condition_score,
            'features': [top_category.lower()],
        },
    }
    return record, float(price)


def normalize_retag_style_row(row: Dict[str, str]) -> Tuple[Optional[Dict[str, Any]], Optional[float]]:
    price = safe_float(row.get('price'))
    if price is None or price <= 0:
        return None, None

    condition_score = int(safe_float(row.get('condition_score')) or 7)
    quality = (row.get('quality') or quality_from_score(condition_score)).strip().lower()

    record = {
        'article': (row.get('article') or 'Unknown Item').strip(),
        'brand': (row.get('brand') or 'Unknown').strip(),
        'category': (row.get('category') or 'Other').strip(),
        'gender': empty_to_none(row.get('gender')),
        'size': empty_to_none(row.get('size')),
        'age': empty_to_none(row.get('age')),
        'wear_count': int(safe_float(row.get('wear_count')) or 0),
        'damage': empty_to_none(row.get('damage')),
        'description': (row.get('description') or '').strip(),
        'image_analysis': {
            'caption': (row.get('caption') or row.get('description') or '').strip(),
            'quality': quality,
            'category': (row.get('category') or 'Other').strip(),
            'condition_score': condition_score,
            'features': split_features(row.get('features')),
        },
    }
    return record, float(price)


def quality_from_condition(condition_id: int) -> str:
    mapping = {1: 'excellent', 2: 'good', 3: 'good', 4: 'fair', 5: 'poor'}
    return mapping.get(condition_id, 'good')


def quality_from_score(score: int) -> str:
    if score >= 9:
        return 'excellent'
    if score >= 7:
        return 'good'
    if score >= 4:
        return 'fair'
    return 'poor'


def infer_damage(description: str) -> Optional[str]:
    damage_keywords = ('tear', 'stain', 'faded', 'damage', 'scratch', 'crack', 'worn')
    lowered = description.lower()
    return 'reported' if any(word in lowered for word in damage_keywords) else None


def split_features(value: Optional[str]) -> List[str]:
    if not value:
        return []
    return [item.strip() for item in value.split('|') if item.strip()]


def empty_to_none(value: Optional[str]) -> Optional[str]:
    text = (value or '').strip()
    return text or None


def safe_float(value: Any) -> Optional[float]:
    try:
        if value is None or value == '':
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def prepare_dataset(rows: Iterable[Dict[str, str]]) -> Tuple[List[Dict[str, Any]], List[float]]:
    records: List[Dict[str, Any]] = []
    prices: List[float] = []
    for row in rows:
        record, price = normalize_row(row)
        if record is None or price is None:
            continue
        records.append(record)
        prices.append(price)
    return records, prices


def train_and_select(records: List[Dict[str, Any]], targets: List[float]) -> RetagPriceModel:
    x_train, x_test, y_train, y_test = train_test_split(records, targets, test_size=0.2, random_state=42)

    candidates = ['linear_regression', 'random_forest']
    best_model: Optional[RetagPriceModel] = None
    best_mae = float('inf')

    for estimator_type in candidates:
        model = RetagPriceModel(estimator_type=estimator_type)
        model.fit(x_train, y_train)
        predictions = model.predict(x_test)
        mae = mean_absolute_error(y_test, predictions)
        r2 = r2_score(y_test, predictions)
        model.training_metrics = {'mae': float(mae), 'r2': float(r2)}
        model.model_version = f'{estimator_type}-v1'

        print(f'{estimator_type}: MAE={mae:.2f}, R2={r2:.3f}')
        if mae < best_mae:
            best_mae = float(mae)
            best_model = model

    if best_model is None:
        raise RuntimeError('No model was trained successfully')

    print(f'Selected model: {best_model.estimator_type} (MAE={best_mae:.2f})')
    return best_model


def main() -> None:
    args = parse_args()
    data_path = Path(args.data)
    output_path = Path(args.output)

    if not data_path.exists():
        raise FileNotFoundError(f'Training data not found: {data_path}')

    rows = load_rows(data_path)
    records, prices = prepare_dataset(rows)
    if len(records) < 10:
        raise ValueError('Need at least 10 valid training rows to train the model')

    model = train_and_select(records, prices)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, output_path)
    print(f'Saved trained model to {output_path}')


if __name__ == '__main__':
    main()
