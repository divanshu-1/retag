from fastapi import FastAPI
import os

from .predictor import PricingPredictor
from .schemas import PredictRequest, PredictResponse

app = FastAPI(title='ReTag ML Pricing Service', version='0.1.0')
predictor = PricingPredictor()


@app.on_event('startup')
def load_model() -> None:
    predictor.load()


@app.get('/health')
def health() -> dict:
    return {
        'status': 'ok',
        'service': 'retag-ml-pricing',
        **predictor.get_info(),
    }


@app.get('/model/info')
def model_info() -> dict:
    return predictor.get_info()


@app.post('/predict', response_model=PredictResponse)
def predict(payload: PredictRequest) -> PredictResponse:
    return predictor.predict(payload)


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=int(os.getenv('PORT', '8010')))
