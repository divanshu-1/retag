import base64
import binascii
import os
import tempfile
import warnings
from pathlib import Path
from threading import Lock
from typing import Any, Dict, List, Optional


_pipeline: Any = None
_pipeline_error: Optional[str] = None
_pipeline_lock = Lock()
warnings.filterwarnings('ignore', message='No model hoster is available!.*')


def _model_cache_dir() -> str:
    return os.getenv('PADDLE_PDX_CACHE_HOME', os.path.join(tempfile.gettempdir(), 'retag-paddlex-cache'))


def _bundled_model_dir(model_name: str) -> Path:
    return Path(__file__).resolve().parents[1] / 'models' / 'ocr' / model_name


def _get_pipeline() -> Any:
    global _pipeline, _pipeline_error
    if _pipeline is not None:
        return _pipeline
    if _pipeline_error:
        raise RuntimeError(_pipeline_error)

    with _pipeline_lock:
        if _pipeline is not None:
            return _pipeline
        try:
            os.environ.setdefault('PADDLE_PDX_CACHE_HOME', _model_cache_dir())
            os.environ.setdefault('PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK', 'True')
            from paddleocr import PaddleOCR

            cached_models = Path(_model_cache_dir()) / 'official_models'
            detection_model = _bundled_model_dir('PP-OCRv5_mobile_det')
            recognition_model = _bundled_model_dir('PP-OCRv5_mobile_rec')
            if not (detection_model / 'inference.yml').is_file():
                detection_model = cached_models / 'PP-OCRv5_mobile_det'
            if not (recognition_model / 'inference.yml').is_file():
                recognition_model = cached_models / 'PP-OCRv5_mobile_rec'
            local_models_available = (detection_model / 'inference.yml').is_file() and (recognition_model / 'inference.yml').is_file()

            _pipeline = PaddleOCR(
                text_detection_model_name='PP-OCRv5_mobile_det',
                text_recognition_model_name='PP-OCRv5_mobile_rec',
                text_detection_model_dir=str(detection_model) if local_models_available else None,
                text_recognition_model_dir=str(recognition_model) if local_models_available else None,
                use_doc_orientation_classify=False,
                use_doc_unwarping=False,
                use_textline_orientation=False,
            )
            return _pipeline
        except Exception as exc:
            _pipeline_error = f'PaddleOCR initialization failed: {exc}'
            raise RuntimeError(_pipeline_error) from exc


def get_ocr_status() -> Dict[str, Any]:
    return {
        'available': _pipeline is not None,
        'provider': 'PaddleOCR PP-OCRv5',
        'error': _pipeline_error,
    }


def analyze_base64_images(images: List[str]) -> Dict[str, Any]:
    if not images:
        return {'available': False, 'text': '', 'lines': [], 'error': 'No images supplied'}

    pipeline = _get_pipeline()
    text_lines: List[str] = []
    confidences: List[float] = []

    for image_data in images[:10]:
        try:
            image_bytes = base64.b64decode(image_data, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise ValueError('An image was not valid base64 data') from exc
        if len(image_bytes) > 8 * 1024 * 1024:
            continue

        temp_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as temp_file:
                temp_file.write(image_bytes)
                temp_path = temp_file.name
            results = pipeline.predict(temp_path)
            for result in results:
                result_json = getattr(result, 'json', {})
                if callable(result_json):
                    result_json = result_json()
                payload = result_json.get('res', result_json) if isinstance(result_json, dict) else {}
                lines = payload.get('rec_texts', []) or []
                scores = payload.get('rec_scores', []) or []
                for index, line in enumerate(lines):
                    normalized = str(line).strip()
                    if normalized:
                        text_lines.append(normalized)
                        if index < len(scores):
                            try:
                                confidences.append(float(scores[index]))
                            except (TypeError, ValueError):
                                pass
        finally:
            if temp_path:
                Path(temp_path).unlink(missing_ok=True)

    return {
        'available': True,
        'provider': 'PaddleOCR PP-OCRv5',
        'text': ' '.join(text_lines)[:2000],
        'lines': text_lines[:80],
        'mean_confidence': round(sum(confidences) / len(confidences), 3) if confidences else None,
    }
