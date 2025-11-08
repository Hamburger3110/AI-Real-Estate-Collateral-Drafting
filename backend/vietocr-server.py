from flask import Flask, request, jsonify
from flask_cors import CORS
import base64, io, os, sys, traceback
from PIL import Image
import numpy as np
import cv2
from paddleocr import PaddleOCR
from vietocr.tool.predictor import Predictor
from vietocr.tool.config import Cfg

app = Flask(__name__)
CORS(app)

predictor = None
detector = None

# Helper to print and flush immediately (for systemd logs)
def probe_print(msg):
    """Print probe message and flush immediately"""
    print(msg, flush=True)
    sys.stdout.flush()
    sys.stderr.flush()

def init_detector():
    global detector
    if detector is None:
        import logging
        logging.getLogger('paddleocr').setLevel(logging.WARNING)
        logging.getLogger('ppocr').setLevel(logging.WARNING)
        logging.getLogger('paddle').setLevel(logging.WARNING)

        # PaddleOCR 2.7.0.3 - pin version for predictable API
        # Use show_log=False and pass det/rec to ocr() method
        detector = PaddleOCR(
            lang='vi',
            use_angle_cls=True,
            show_log=False,
            det_limit_side_len=2048,
            det_db_thresh=0.20,
            det_db_box_thresh=0.30,
            det_db_unclip_ratio=1.8
        )
        probe_print(f"✅ PaddleOCR 2.7.0.3 initialized (detector-only mode)")
    return detector

def init_predictor():
    global predictor
    if predictor is None:
        cfg = Cfg.load_config_from_name('vgg_transformer')
        use_gpu = os.environ.get('USE_GPU', 'false').lower() == 'true'
        cfg['device'] = 'cuda' if use_gpu else 'cpu'
        weights_path = os.environ.get('VIETOCR_WEIGHTS', '').strip()
        if weights_path:
            cfg['weights'] = weights_path
        predictor = Predictor(cfg)
        print(f"✅ VietOCR predictor initialized (device={cfg['device']}, weights={cfg.get('weights','auto')})")
    return predictor

def preprocess_image(img: Image.Image, for_detection: bool = False) -> Image.Image:
    """
    Preprocess image for better OCR quality:
    1. Scale appropriately (downscale if huge, upscale if small)
    2. Remove pink background to boost contrast
    
    Args:
        img: Input PIL Image
        for_detection: If True, more aggressive upscaling for small text detection
    """
    try:
        # Step 1: Smart scaling
        max_side = max(img.size)
        
        if for_detection:
            # For detection phase: more aggressive upscaling to detect small text
            if max_side > 5000:
                # Huge image → downscale but keep it larger for detection
                img.thumbnail((3200, 3200), Image.LANCZOS)
                probe_print(f"📐 [PREPROC] Downscaled from {max_side}px to max 3200px (detection mode)")
            elif max_side < 2000:
                # Small scan → aggressive upscale for small text detection
                scale = 2400.0 / max_side  # Increased from 1600 to 2400
                new_size = (int(img.width * scale), int(img.height * scale))
                img = img.resize(new_size, Image.LANCZOS)
                probe_print(f"📐 [PREPROC] Upscaled from {max_side}px to {max(new_size)}px (scale={scale:.2f}, detection mode)")
        else:
            # For recognition phase: standard scaling
            if max_side > 4000:
                # Huge image → downscale to avoid memory issues
                img.thumbnail((2400, 2400), Image.LANCZOS)
                probe_print(f"📐 [PREPROC] Downscaled from {max_side}px to max 2400px")
            elif max_side < 1200:
                # Small scan → text too tiny, upscale
                scale = 1600.0 / max_side
                new_size = (int(img.width * scale), int(img.height * scale))
                img = img.resize(new_size, Image.LANCZOS)
                probe_print(f"📐 [PREPROC] Upscaled from {max_side}px to {max(new_size)}px (scale={scale:.2f})")
        
        # Step 2: Remove pink background and enhance contrast
        arr_bgr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        
        # Convert to LAB color space
        lab = cv2.cvtColor(arr_bgr, cv2.COLOR_BGR2LAB)
        L, A, B = cv2.split(lab)
        
        # Pink sits heavily in A channel; equalize it to reduce pink background
        A = cv2.equalizeHist(A)
        
        # Also apply adaptive thresholding for better contrast
        gray = cv2.cvtColor(arr_bgr, cv2.COLOR_BGR2GRAY)
        thr = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 31, 15
        )
        
        # Merge LAB channels back
        lab_enhanced = cv2.merge([L, A, B])
        arr_bgr_enhanced = cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)
        
        # Convert back to RGB for PIL
        arr_rgb = cv2.cvtColor(arr_bgr_enhanced, cv2.COLOR_BGR2RGB)
        
        return Image.fromarray(arr_rgb)
    except Exception as e:
        probe_print(f"⚠️ [PREPROC] Preprocessing failed, using original: {e}")
        return img

def preprocess_for_detection(img: Image.Image) -> np.ndarray:
    """
    Additional preprocessing specifically for detection:
    Returns BGR array optimized for PaddleOCR detector
    """
    try:
        arr_bgr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        
        # Remove pinkish background → boost contrast
        lab = cv2.cvtColor(arr_bgr, cv2.COLOR_BGR2LAB)
        L, A, B = cv2.split(lab)
        # Pink sits heavily in A; push it down a bit
        A = cv2.equalizeHist(A)
        
        # Apply adaptive thresholding
        gray = cv2.cvtColor(arr_bgr, cv2.COLOR_BGR2GRAY)
        thr = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 31, 15
        )
        
        # Convert thresholded image back to BGR
        arr_bgr_pre = cv2.cvtColor(thr, cv2.COLOR_GRAY2BGR)
        
        return arr_bgr_pre
    except Exception as e:
        probe_print(f"⚠️ [PREPROC] Detection preprocessing failed, using original: {e}")
        return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'service': 'vietocr',
        'detector_initialized': detector is not None,
        'predictor_initialized': predictor is not None
    })

@app.route('/ocr', methods=['POST'])
def ocr():
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400

        data_base64 = data.get('dataBase64')
        if not data_base64:
            return jsonify({'error': 'dataBase64 field is required'}), 400

        # Decode base64
        probe_logs = []  # Collect probe logs to return in response
        probe_logs.append("="*60)
        probe_logs.append("🔍 [PROBE] Starting OCR Pipeline")
        probe_logs.append("="*60)
        probe_print("\n" + "="*60)
        probe_print("🔍 [PROBE] Starting OCR Pipeline")
        probe_print("="*60)
        
        try:
            image_data = base64.b64decode(data_base64)
            image = Image.open(io.BytesIO(image_data))
            # ✅ Ensure RGB; avoids issues with RGBA/LA/P modes
            if image.mode != 'RGB':
                image = image.convert('RGB')
            msg = f"📸 [PROBE] Image loaded: {image.size[0]}x{image.size[1]}, mode={image.mode}"
            probe_print(msg)
            probe_logs.append(msg)
        except Exception as e:
            return jsonify({'error': f'Invalid image data: {e}'}), 400

        # Step 1: Preprocess image for detection (aggressive upscaling for small text)
        msg = "\n🔄 [PROBE] Step 1: Preprocessing image for detection (small text optimized)..."
        probe_print(msg)
        probe_logs.append(msg)
        detection_img = preprocess_image(image, for_detection=True)
        msg = f"✅ [PROBE] Detection image: {detection_img.size[0]}x{detection_img.size[1]}"
        probe_print(msg)
        probe_logs.append(msg)
        
        # Also preprocess for recognition (less aggressive)
        processed_img = preprocess_image(image, for_detection=False)
        msg = f"✅ [PROBE] Recognition image: {processed_img.size[0]}x{processed_img.size[1]}"
        probe_print(msg)
        probe_logs.append(msg)
        
        # Step 2: Initialize detector and predictor
        msg = "\n🔧 [PROBE] Step 2: Initializing models..."
        probe_print(msg)
        probe_logs.append(msg)
        det = init_detector()
        rec = init_predictor()
        msg = "✅ [PROBE] Models initialized"
        probe_print(msg)
        probe_logs.append(msg)
        
        # Step 3: Detect text regions using PaddleOCR
        msg = "\n🎯 [PROBE] Step 3: Detecting text regions with PaddleOCR (small text optimized)..."
        probe_print(msg)
        probe_logs.append(msg)
        
        # Use improved preprocessing for detection (removes pink background, uses upscaled image)
        bgr_preprocessed = preprocess_for_detection(detection_img)
        msg = f"📐 [PROBE] Preprocessed BGR image shape: {bgr_preprocessed.shape}"
        probe_print(msg)
        probe_logs.append(msg)
        
        # Also keep regular BGR as fallback
        bgr = cv2.cvtColor(np.array(processed_img), cv2.COLOR_RGB2BGR)
        
        # PaddleOCR 2.7.0.3 API: Use ocr() with det=True, rec=False, cls=True
        boxes_pages = None
        detection_method = None
        
        try:
            msg = "🔍 [PROBE] Using ocr(det=True, rec=False, cls=True) with preprocessed image (PaddleOCR 2.7.x)..."
            probe_print(msg)
            probe_logs.append(msg)
            
            # PaddleOCR 2.7.x: pass det/rec/cls to ocr() method
            result = det.ocr(bgr_preprocessed, det=True, rec=False, cls=True)
            
            msg = f"📊 [PROBE] ocr() returned: type={type(result)}, len={len(result) if result else 0}"
            probe_print(msg)
            probe_logs.append(msg)
            
            if result and len(result) > 0 and result[0]:
                msg = f"📊 [PROBE] First page items: {len(result[0])}"
                probe_print(msg)
                probe_logs.append(msg)
                
                # PaddleOCR 2.7.x with det=True, rec=False returns: [[bbox], [bbox], ...]
                # Each bbox is [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
                # Extract bounding boxes
                boxes_pages = []
                for item in result[0]:
                    if item and isinstance(item, (list, tuple)) and len(item) > 0:
                        # item is the bbox polygon: [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
                        if isinstance(item[0], (list, tuple)) and len(item[0]) == 2:
                            # Valid bbox with 4 points
                            boxes_pages.append(item)
                
                boxes_pages = [boxes_pages]  # Wrap in pages format
                detection_method = "ocr(det=True, rec=False, cls=True)"
                msg = f"✅ [PROBE] Detection succeeded: {len(boxes_pages[0]) if boxes_pages and boxes_pages[0] else 0} boxes detected"
                probe_print(msg)
                probe_logs.append(msg)
            else:
                msg = "⚠️  [PROBE] No boxes detected in result"
                probe_print(msg)
                probe_logs.append(msg)
                
        except Exception as e:
            msg = f"⚠️  [PROBE] Detection failed: {e}"
            probe_print(msg)
            probe_logs.append(msg)
            import traceback
            probe_print(traceback.format_exc())
        
        # Step 4: Extract text from detected regions
        msg = "\n📝 [PROBE] Step 4: Extracting text from regions..."
        probe_print(msg)
        probe_logs.append(msg)
        msg = f"🔍 [PROBE] Detection method used: {detection_method}"
        probe_print(msg)
        probe_logs.append(msg)
        msg = f"📦 [PROBE] Boxes structure: {type(boxes_pages)}, pages={len(boxes_pages) if boxes_pages else 0}"
        probe_print(msg)
        probe_logs.append(msg)
        
        lines = []
        if boxes_pages and boxes_pages[0]:
            # Calculate scale factor between detection image and recognition image
            det_H, det_W = detection_img.height, detection_img.width
            rec_H, rec_W = processed_img.height, processed_img.width
            scale_x = rec_W / det_W
            scale_y = rec_H / det_H
            
            msg = f"📐 [PROBE] Detection image: {det_W}x{det_H}, Recognition image: {rec_W}x{rec_H}"
            probe_print(msg)
            probe_logs.append(msg)
            if abs(scale_x - 1.0) > 0.01 or abs(scale_y - 1.0) > 0.01:
                msg = f"📏 [PROBE] Coordinate scale factors: x={scale_x:.3f}, y={scale_y:.3f}"
                probe_print(msg)
                probe_logs.append(msg)
            
            H, W = rec_H, rec_W  # Use recognition image dimensions for cropping
            msg = f"📊 [PROBE] Processing {len(boxes_pages[0])} detected regions..."
            probe_print(msg)
            probe_logs.append(msg)
            
            for idx, poly in enumerate(boxes_pages[0]):
                if not poly:
                    msg = f"⚠️  [PROBE] Region {idx}: poly is None/empty, skipping"
                    probe_print(msg)
                    probe_logs.append(msg)
                    continue
                    
                # Handle different poly formats
                if isinstance(poly, (list, tuple)) and len(poly) >= 4:
                    # poly is [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
                    try:
                        # Scale coordinates from detection image to recognition image
                        xs = [int(float(p[0]) * scale_x) for p in poly]
                        ys = [int(float(p[1]) * scale_y) for p in poly]
                        msg = f"\n📍 [PROBE] Region {idx+1}: bbox=({min(xs)},{min(ys)}) to ({max(xs)},{max(ys)}) (scaled from detection coords)"
                        probe_print(msg)
                        probe_logs.append(msg)
                    except (IndexError, TypeError, ValueError) as e:
                        msg = f"⚠️  [PROBE] Region {idx}: Failed to parse bbox: {e}, poly={str(poly)[:100]}"
                        probe_print(msg)
                        probe_logs.append(msg)
                        continue
                    
                    pad = 5
                    x1 = max(0, min(xs) - pad)
                    y1 = max(0, min(ys) - pad)
                    x2 = min(W, max(xs) + pad)
                    y2 = min(H, max(ys) + pad)
                    
                    crop_size = (x2 - x1, y2 - y1)
                    msg = f"✂️  [PROBE] Region {idx+1}: Crop size={crop_size[0]}x{crop_size[1]}"
                    probe_print(msg)
                    probe_logs.append(msg)
                    
                    if x2 > x1 and y2 > y1:
                        crop = processed_img.crop((x1, y1, x2, y2))
                        original_height = crop.height
                        
                        # Upscale tiny crops to preserve diacritics (Vietnamese accents)
                        # Tiny crops lose accents → scale to ~48–64 px height
                        if crop.height < 48:
                            scale = 48.0 / crop.height
                            new_width = int(crop.width * scale)
                            new_height = 48
                            crop = crop.resize((new_width, new_height), Image.BICUBIC)
                            msg = f"📏 [PROBE] Region {idx+1}: Upscaled crop from {original_height}px to {new_height}px (scale={scale:.2f})"
                            probe_print(msg)
                            probe_logs.append(msg)
                        
                        msg = f"🔤 [PROBE] Region {idx+1}: Running VietOCR recognition (crop={crop.width}x{crop.height})..."
                        probe_print(msg)
                        probe_logs.append(msg)
                        text = rec.predict(crop)
                        msg = f"📝 [PROBE] Region {idx+1}: Recognized text='{text}' (len={len(text) if text else 0})"
                        probe_print(msg)
                        probe_logs.append(msg)
                        if text and text.strip():
                            lines.append(text.strip())
                            msg = f"✅ [PROBE] Region {idx+1}: Added to lines"
                            probe_print(msg)
                            probe_logs.append(msg)
                        else:
                            msg = f"⚠️  [PROBE] Region {idx+1}: Empty or whitespace text, skipped"
                            probe_print(msg)
                            probe_logs.append(msg)
                    else:
                        msg = f"⚠️  [PROBE] Region {idx+1}: Invalid crop dimensions, skipped"
                        probe_print(msg)
                        probe_logs.append(msg)
                else:
                    msg = f"⚠️  [PROBE] Region {idx}: Invalid poly format, len={len(poly) if poly else 0}"
                    probe_print(msg)
                    probe_logs.append(msg)
        else:
            # Fallback: whole image
            msg = f"\n⚠️  [PROBE] No boxes detected (boxes_pages={str(boxes_pages)[:100]})"
            probe_print(msg)
            probe_logs.append(msg)
            msg = "🔄 [PROBE] Fallback: Trying full-image recognition..."
            probe_print(msg)
            probe_logs.append(msg)
            t = rec.predict(processed_img)
            msg = f"📝 [PROBE] Full-image text='{t}' (len={len(t) if t else 0})"
            probe_print(msg)
            probe_logs.append(msg)
            if t and t.strip():
                lines.append(t.strip())
                msg = "✅ [PROBE] Full-image text added to lines"
                probe_print(msg)
                probe_logs.append(msg)

        # Combine all lines
        msg = "\n📋 [PROBE] Step 5: Combining results..."
        probe_print(msg)
        probe_logs.append(msg)
        msg = f"📊 [PROBE] Total lines collected: {len(lines)}"
        probe_print(msg)
        probe_logs.append(msg)
        for i, line in enumerate(lines):
            msg = f"   Line {i+1}: '{line}' (len={len(line)})"
            probe_print(msg)
            probe_logs.append(msg)
        
        final_text = "\n".join(lines) if lines else ""
        msg = f"📄 [PROBE] Final combined text length: {len(final_text)} chars"
        probe_print(msg)
        probe_logs.append(msg)
        msg = f"📄 [PROBE] Final text preview: '{final_text[:100]}...' (first 100 chars)"
        probe_print(msg)
        probe_logs.append(msg)
        probe_print("="*60 + "\n")
        
        # Include debug info in response for easier troubleshooting
        debug_info = {
            'detection_method': detection_method,
            'boxes_detected': len(boxes_pages[0]) if boxes_pages and boxes_pages[0] else 0,
            'regions_processed': len(lines),
            'final_text_length': len(final_text),
            'lines': lines,
            'probe_logs': probe_logs  # Include all probe logs in response
        }
        
        return jsonify({
            'text': final_text,
            'success': True,
            'regions_detected': len(lines),
            'debug': debug_info  # Include debug info in response
        })
    except Exception as e:
        print("❌ OCR error:", e)
        traceback.print_exc()
        return jsonify({'error': str(e), 'success': False}), 500

if __name__ == '__main__':
    try:
        probe_print("🚀 Starting VietOCR HTTP Server on :5000")
        probe_print(f"📁 Working directory: {os.getcwd()}")
        probe_print(f"🐍 Python path: {sys.executable}")
        probe_print(f"📦 Python version: {sys.version}")
        
        # Test imports before starting server
        probe_print("🔍 Testing imports...")
        import flask
        import flask_cors
        probe_print("✅ Flask imports OK")
        
        # Don't initialize models at startup - lazy load on first request
        probe_print("✅ Server ready (models will load on first request)")
        
        app.run(host='0.0.0.0', port=5000, debug=False)
    except Exception as e:
        probe_print(f"❌ Failed to start server: {e}")
        import traceback
        probe_print(traceback.format_exc())
        sys.exit(1)
