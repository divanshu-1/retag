from fastapi import FastAPI
import os
import tempfile

os.environ.setdefault('PADDLE_PDX_CACHE_HOME', os.path.join(tempfile.gettempdir(), 'retag-paddlex-cache'))

from .predictor import PricingPredictor
from .schemas import PredictRequest, PredictResponse
from .ocr_service import analyze_base64_images, get_ocr_status
from pydantic import BaseModel, Field
from typing import List

app = FastAPI(title='ReTag ML Pricing Service', version='0.1.0')
predictor = PricingPredictor()


class OCRRequest(BaseModel):
    images: List[str] = Field(min_length=1, max_length=10)


@app.on_event('startup')
def load_model() -> None:
    predictor.load()


@app.get('/health')
def health() -> dict:
    return {
        'status': 'ok',
        'service': 'retag-ml-pricing',
        **predictor.get_info(),
        'ocr': get_ocr_status(),
    }


@app.get('/model/info')
def model_info() -> dict:
    return predictor.get_info()


@app.post('/predict', response_model=PredictResponse)
def predict(payload: PredictRequest) -> PredictResponse:
    return predictor.predict(payload)


@app.post('/ocr')
def ocr(payload: OCRRequest) -> dict:
    return analyze_base64_images(payload.images)


@app.get('/ocr/health')
def ocr_health() -> dict:
    return get_ocr_status()


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=int(os.getenv('PORT', '8010')))
