import os
import io
import json
import tempfile
import boto3
from pdf2image import convert_from_path
from PIL import Image
from vietocr.tool.predictor import Predictor
from vietocr.tool.config import Cfg

s3 = boto3.client('s3')


def _download_s3_object(bucket: str, key: str) -> str:
    fd, path = tempfile.mkstemp()
    os.close(fd)
    s3.download_file(bucket, key, path)
    return path


def _images_from_document(path: str):
    lower = path.lower()
    if lower.endswith('.pdf'):
        return convert_from_path(path, first_page=1, last_page=2, fmt='png')
    return [Image.open(path)]


_model = None


def _get_model():
    global _model
    if _model is None:
        config = Cfg.load_config_from_name('vgg_transformer')
        config['device'] = 'cpu'
        config['predictor']['beamsearch'] = False
        _model = Predictor(config)
    return _model


def handler(event, context):
    # Input: { bucket, key }
    bucket = event.get('bucket') or event.get('s3', {}).get('bucket')
    key = event.get('key') or event.get('s3', {}).get('key')
    if not bucket or not key:
        return { 'statusCode': 400, 'body': json.dumps({'error': 'Missing bucket/key'}) }

    local_path = _download_s3_object(bucket, key)
    try:
        images = _images_from_document(local_path)
        model = _get_model()

        texts = []
        for img in images:
            # Simple whole-image OCR; downstream Bedrock will structure/QA
            text = model.predict(img)
            if text:
                texts.append(text)

        return {
            'statusCode': 200,
            'body': json.dumps({
                'text': '\n'.join(texts)
            })
        }
    finally:
        try:
            os.unlink(local_path)
        except Exception:
            pass

