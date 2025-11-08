/**
 * Test VietOCR Service
 * Tests the VietOCR HTTP endpoint
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const VIETOCR_ENDPOINT = process.env.VIETOCR_HTTP_ENDPOINT || 'http://localhost:5000/ocr';

async function testVietOCR(imagePath) {
  try {
    console.log(`🧪 Testing VietOCR endpoint: ${VIETOCR_ENDPOINT}`);
    
    // Read image file
    if (!fs.existsSync(imagePath)) {
      console.error(`❌ Image file not found: ${imagePath}`);
      return;
    }
    
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const fileName = path.basename(imagePath);
    
    console.log(`📸 Image: ${fileName} (${(imageBuffer.length / 1024).toFixed(2)} KB)`);
    
    // Test health endpoint first
    try {
      const healthUrl = VIETOCR_ENDPOINT.replace('/ocr', '/health');
      console.log(`\n🏥 Checking health: ${healthUrl}`);
      const healthRes = await axios.get(healthUrl, { timeout: 5000 });
      console.log('✅ Health check:', JSON.stringify(healthRes.data, null, 2));
    } catch (err) {
      console.log('⚠️  Health check failed:', err.message);
    }
    
    // Test OCR endpoint
    console.log(`\n🔍 Sending OCR request...`);
    console.log(`⏱️  Timeout: 180 seconds (first request may download model weights)`);
    const startTime = Date.now();
    
    const response = await axios.post(VIETOCR_ENDPOINT, {
      fileName: fileName,
      dataBase64: base64Image
    }, {
      timeout: 180000, // 3 minutes for first request (model download)
      headers: {
        'Content-Type': 'application/json'
      },
      // Prevent socket hang up
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true })
    });
    
    const duration = Date.now() - startTime;
    
    if (response.data && response.data.success !== false) {
      const text = response.data.text || '';
      const debug = response.data.debug || {};
      const probeLogs = debug.probe_logs || [];
      
      console.log(`\n✅ OCR Success! (${duration}ms)`);
      
      // Display probe logs if available
      if (probeLogs.length > 0) {
        console.log(`\n🔍 [PROBE LOGS] Pipeline execution:`);
        console.log('═'.repeat(60));
        probeLogs.forEach(log => console.log(log));
        console.log('═'.repeat(60));
      }
      
      // Display debug info
      if (debug.detection_method || debug.boxes_detected !== undefined) {
        console.log(`\n📊 [DEBUG INFO]`);
        console.log(`   Detection method: ${debug.detection_method || 'N/A'}`);
        console.log(`   Boxes detected: ${debug.boxes_detected || 0}`);
        console.log(`   Regions processed: ${debug.regions_processed || 0}`);
        console.log(`   Final text length: ${debug.final_text_length || 0} chars`);
        if (debug.lines && debug.lines.length > 0) {
          console.log(`   Lines extracted: ${debug.lines.length}`);
          debug.lines.forEach((line, i) => {
            console.log(`     Line ${i+1}: "${line.substring(0, 80)}${line.length > 80 ? '...' : ''}"`);
          });
        }
      }
      
      console.log(`\n📝 Extracted text (${text.length} chars):`);
      console.log('─'.repeat(60));
      console.log(text || '(empty)');
      console.log('─'.repeat(60));
      
      return {
        success: true,
        text: text,
        duration: duration,
        debug: debug
      };
    } else {
      console.log(`\n❌ OCR failed:`, response.data);
      return {
        success: false,
        error: response.data?.error || 'Unknown error'
      };
    }
    
  } catch (error) {
    console.error(`\n❌ Test failed:`, error.message);
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      console.error(`\n⏱️  Request timed out. This might be because:`);
      console.error(`   1. First request is downloading model weights (~500MB) - this can take 2-3 minutes`);
      console.error(`   2. Server is processing a large image`);
      console.error(`   💡 Check server logs on EC2: sudo journalctl -u vietocr -f`);
    } else if (error.code === 'ECONNRESET' || error.message.includes('socket hang up')) {
      console.error(`\n🔌 Connection reset. This might mean:`);
      console.error(`   1. Server crashed during initialization`);
      console.error(`   2. Server is out of memory`);
      console.error(`   3. Network issue`);
      console.error(`   💡 Check server status: curl http://3.23.17.163:5000/health`);
      console.error(`   💡 Check server logs: sudo journalctl -u vietocr -n 50`);
    } else if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error(`\n💡 Tip: Make sure VietOCR server is running on EC2`);
      console.error(`   Check: curl http://3.23.17.163:5000/health`);
    }
    return {
      success: false,
      error: error.message
    };
  }
}

// Run test if called directly
if (require.main === module) {
  const imagePath = process.argv[2];
  
  if (!imagePath) {
    console.log('Usage: node test-vietocr.js <image-path>');
    console.log('Example: node test-vietocr.js test-image.jpg');
    console.log(`\nCurrent VIETOCR_HTTP_ENDPOINT: ${VIETOCR_ENDPOINT}`);
    process.exit(1);
  }
  
  testVietOCR(imagePath)
    .then(result => {
      process.exit(result && result.success ? 0 : 1);
    })
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

module.exports = { testVietOCR };

