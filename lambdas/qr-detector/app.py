import os
import json
import tempfile
import boto3
from PIL import Image
import cv2
import numpy as np
from pdf2image import convert_from_path

s3 = boto3.client('s3')


def _download_s3_object(bucket: str, key: str) -> str:
    fd, path = tempfile.mkstemp()
    os.close(fd)
    s3.download_file(bucket, key, path)
    return path


def _images_from_document(path: str):
    lower = path.lower()
    if lower.endswith('.pdf'):
        # Convert up to 2 pages to images (first two pages)
        return convert_from_path(path, first_page=1, last_page=2, fmt='png')
    # Assume image
    return [Image.open(path)]


def _try_decode_qr(pil_img: Image.Image):
    # Convert PIL Image to OpenCV format
    img_array = np.array(pil_img)
    # Convert RGB to BGR for OpenCV
    if len(img_array.shape) == 3 and img_array.shape[2] == 3:
        img_cv = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
    else:
        img_cv = img_array
    
    # Use OpenCV QRCodeDetector
    detector = cv2.QRCodeDetector()
    retval, decoded_info, points, straight_qrcode = detector.detectAndDecodeMulti(img_cv)
    
    if retval and decoded_info and len(decoded_info) > 0:
        text = decoded_info[0]
        box = None
        if points is not None and len(points) > 0 and len(points[0]) > 0:
            # points[0] is the first QR code's corner points
            pts = [{'x': int(p[0]), 'y': int(p[1])} for p in points[0]]
            box = {'points': pts}
        return {'text': text, 'box': box}
    return None


def handler(event, context):
    # Expected input: { "bucket": ..., "key": ... }
    bucket = event.get('bucket') or event.get('s3', {}).get('bucket')
    key = event.get('key') or event.get('s3', {}).get('key')
    if not bucket or not key:
        return { 'statusCode': 400, 'body': json.dumps({'error': 'Missing bucket/key'}) }

    local_path = _download_s3_object(bucket, key)
    try:
        images = _images_from_document(local_path)
        for img in images:
            res = _try_decode_qr(img)
            if res and res.get('text'):
                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'hasQR': True,
                        'decodedText': res.get('text'),
                        'box': res.get('box')
                    })
                }
        return { 'statusCode': 200, 'body': json.dumps({'hasQR': False}) }
    finally:
        try:
            os.unlink(local_path)
        except Exception:
            pass

