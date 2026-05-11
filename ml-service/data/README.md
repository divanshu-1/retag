# Training data

Place your dataset in this folder and run the trainer from `ml-service/`.

Supported formats:

- **Mercari TSV** with fields like `name`, `brand_name`, `category_name`, `item_condition_id`, `item_description`, `price`
- **ReTag-style CSV** with fields like `article`, `brand`, `category`, `description`, `quality`, `condition_score`, `price`

Example commands:

- `./.venv/bin/python train.py --data data/retag_sample_training.csv`
- `./.venv/bin/python train.py --data data/mercari_train.tsv --output models/pricing_model.joblib`

Learning from reviewed ReTag marketplace data:

- Export reviewed products from the backend:
  - `cd ../server && npm run export:ml-data`
- Retrain the ML model on the exported CSV:
  - `./.venv/bin/python train.py --data data/reviewed_marketplace_training.csv --output models/pricing_model.joblib`
