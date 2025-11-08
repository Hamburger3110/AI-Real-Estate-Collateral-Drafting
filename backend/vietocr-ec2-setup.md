# VietOCR EC2 Setup Guide

## Overview
This guide sets up an enhanced OCR service on EC2 that combines:
- **PaddleOCR**: Text detection (finds text regions in images)
- **Image preprocessing**: Improves quality using OpenCV (LAB color space, adaptive thresholding)
- **VietOCR**: Text recognition (reads text from detected regions)

This pipeline provides better accuracy than using VietOCR alone.

## Prerequisites
- EC2 instance (Ubuntu 22.04 LTS recommended)
- **Minimum**: t3.medium (4GB RAM) - **Recommended**: t3.large (8GB RAM) or larger
- Python 3.8+ installed
- GPU instance recommended (g4dn.xlarge or better) for faster processing, but CPU works too
- **Note**: PaddleOCR + VietOCR require significant memory. Ensure sufficient RAM or add swap space.

## Step 1: Install Dependencies on EC2

```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Python and pip
sudo apt-get install -y python3 python3-pip python3-venv

# Install system dependencies for image processing
sudo apt-get install -y libgl1-mesa-glx libglib2.0-0

# Install build dependencies (required for PyMuPDF, a PaddleOCR dependency)
sudo apt-get install -y swig build-essential

# For GPU support (optional but recommended)
# Install CUDA toolkit if using GPU instance
```

## Step 2: Set Up Python Environment

```bash
# Create virtual environment
python3 -m venv ~/vietocr-env
source ~/vietocr-env/bin/activate

# Install Python packages (takes 10-15 minutes)
pip install --upgrade pip
pip install -r vietocr-requirements.txt

# Verify installation
python3 -c "import vietocr, paddleocr, cv2; print('✅ All packages installed')"

# Note: First OCR request will download:
# - PaddleOCR models (~200MB) - for text detection
# - VietOCR model weights (~500MB) - for text recognition
# This happens automatically on first use
```

## Step 3: Download VietOCR Server Files

Upload these files to your EC2 instance:
- `vietocr-server.py`
- `vietocr-requirements.txt`

Or clone your repo on EC2:
```bash
git clone <your-repo-url>
cd <repo>/backend
```

## Step 4: Run the Server

### Option A: Direct Run (for testing)
```bash
source ~/vietocr-env/bin/activate
cd /path/to/backend
python3 vietocr-server.py

# For GPU support (if using GPU instance):
# USE_GPU=true python3 vietocr-server.py
```

### Option B: Using systemd (production)

Create `/etc/systemd/system/vietocr.service`:

```ini
[Unit]
Description=VietOCR HTTP Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/<your-repo>/backend
Environment="PATH=/home/ubuntu/vietocr-env/bin"
Environment="USE_GPU=false"
ExecStart=/home/ubuntu/vietocr-env/bin/python3 vietocr-server.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable vietocr
sudo systemctl start vietocr
sudo systemctl status vietocr
```

## Step 5: Configure Security Group

In AWS Console → EC2 → Security Groups:
- Add inbound rule: Custom TCP, Port 5000, Source: Your backend server's IP or security group

## Step 6: Update Backend Environment

On your backend server, set:
```bash
VIETOCR_HTTP_ENDPOINT=http://<ec2-public-ip>:5000/ocr
```

Or if using a domain/load balancer:
```bash
VIETOCR_HTTP_ENDPOINT=https://vietocr.yourdomain.com/ocr
```

## Step 7: Test

```bash
# Health check
curl http://<ec2-ip>:5000/health

# Test OCR (from backend server)
curl -X POST http://<ec2-ip>:5000/ocr \
  -H "Content-Type: application/json" \
  -d '{"fileName": "test.jpg", "dataBase64": "<base64-encoded-image>"}'
```

## Troubleshooting

### Check logs
```bash
# If using systemd
sudo journalctl -u vietocr -f

# If running directly
# Check console output
```

### Common Issues

1. **Port 5000 not accessible**: Check security group rules
2. **Out of memory**: Use larger instance (t3.medium or better recommended)
3. **Slow processing**: Use GPU instance (g4dn.xlarge or better) and set `USE_GPU=true`
4. **Import errors**: Ensure virtual environment is activated and packages installed
5. **Model download fails**: First run downloads model weights (~500MB). Ensure internet connection and sufficient disk space
6. **CUDA errors**: If using GPU, ensure CUDA drivers are installed. Otherwise set `USE_GPU=false`

## Performance Tips

- Use GPU instances (g4dn.xlarge) for 5-10x faster processing
- Consider using Application Load Balancer for multiple instances
- Monitor CPU/GPU usage and scale as needed

