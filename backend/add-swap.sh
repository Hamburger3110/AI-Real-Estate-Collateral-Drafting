#!/bin/bash
# Add swap space to EC2 instance (temporary workaround for OOM)

echo "💾 Adding 4GB swap space..."

# Create swap file
sudo fallocate -l 4G /swapfile
# Or if fallocate doesn't work:
# sudo dd if=/dev/zero of=/swapfile bs=1M count=4096

# Set permissions
sudo chmod 600 /swapfile

# Make it swap
sudo mkswap /swapfile

# Enable swap
sudo swapon /swapfile

# Make it permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify
echo "✅ Swap added. Current memory:"
free -h

echo ""
echo "⚠️  Note: Swap is slower than RAM. Consider upgrading to t3.large (8GB) for better performance."

