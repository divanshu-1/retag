# ReTag ML Pricing Evaluator Guide

## 1. Final project statement
**ReTag is an ML-powered intelligent thrift marketplace that predicts resale value in real time and keeps a human admin in the loop for final review.**

## 2. What the final interface looks like
### Seller side
1. Seller opens **Sell Your Item** on mobile.
2. Enters item metadata: article, brand, category, size, age, wear count, damage.
3. Uploads item photos.
4. Sees an **ML Pricing Results** screen with:
   - recommended resale price
   - confidence score
   - expected price range
   - image condition summary
   - factors considered
   - model/source badge and version
5. Seller accepts or rejects the offer.

### Admin side
Admin dashboard shows:
- suggested price
- pricing source (`ML Service` or fallback)
- model version
- confidence
- fallback status
- predicted range

## 3. How to use it in demo
### Start services
- Start backend in `server/`
- Start ML service in `ml-service/`
- Set `ML_SERVICE_URL=http://127.0.0.1:8010`

### Demo flow
1. Submit a clothing item through the sell form.
2. Show the ML pricing result screen.
3. Explain that the price comes from the Python ML microservice.
4. Accept the offer.
5. Open admin dashboard and show the same item with model metadata.
6. Explain that admin can override the price before listing.

## 4. How the model learns from images
Important: **the current version does not directly train a deep CNN on raw image pixels.**

Instead, it learns in two stages:
1. The system extracts structured visual signals from seller images:
   - item caption/description
   - quality label
   - condition score
   - visual features
2. The ML regressor learns the relationship between:
   - those image-derived signals
   - seller-entered metadata
   - historical resale prices

So the model learns from your images **through extracted condition/features**, not by end-to-end computer vision training.

## 5. How it improves over time
The production learning loop is:
1. Seller submits item
2. ML predicts price
3. Admin reviews/finalizes price
4. Marketplace stores the reviewed outcome
5. Export reviewed products to CSV:
   - `cd server && npm run export:ml-data`
6. Retrain the ML model:
   - `cd ml-service && ./.venv/bin/python train.py --data data/reviewed_marketplace_training.csv --output models/pricing_model.joblib`

This means the system can gradually learn from **your real marketplace decisions**, not only sample data.

## 6. Accuracy: how to answer honestly
### Current baseline
With the sample dataset, the trained baseline achieved approximately:
- **MAE = 286.63 INR**
- **R² = 0.336**

### What this means
- On average, the prediction error is about **₹287** on the validation split.
- This is acceptable as a **baseline minor-project prototype**, but not final industrial accuracy.
- Accuracy will improve when trained on:
  - more reviewed ReTag data
  - a larger resale dataset such as Mercari
  - more diverse brands/categories/conditions

### Best viva answer
> “The current model is a baseline regression system with measurable error. It is intentionally designed to improve as more marketplace-reviewed training data is collected.”

## 7. Why this is academically strong
You can say the project demonstrates:
- applied machine learning in a real MERN product
- microservice architecture (Node + FastAPI)
- explainable predictions with confidence and range
- human-in-the-loop moderation
- retraining from real operational data

## 8. Short evaluator explanation
> “The seller uploads an item, the backend extracts image and product signals, and sends structured features to a Python ML service. The service predicts a resale price, confidence, and expected range. The result is shown to the seller and to the admin dashboard. Admin feedback becomes future training data, so the pricing model improves over time.”

## 9. Questions evaluators may ask
### Why ML instead of rules?
Because resale pricing depends on non-linear relationships between brand, condition, category, and wear level. ML generalizes better than fixed rules.

### Why keep admin review?
To maintain trust, catch edge cases, and collect corrected labels for retraining.

### Is this fully autonomous?
No. It is a **decision-support pricing system** with human oversight.

### What is the next upgrade?
Train on larger reviewed datasets and replace handcrafted image features with stronger computer-vision embeddings.

## 10. One-line conclusion for presentation
**“ReTag combines marketplace workflow, explainable ML pricing, and human review to create a practical intelligent thrift valuation system.”**
