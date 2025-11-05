#!/usr/bin/env node

// Test script for FPT AI confidence score parsing
require('dotenv').config();
const { parseExtractionResult } = require('./config/fptai-config');

async function testFPTAIParsing() {
  console.log('🧪 Testing FPT AI Response Parsing');
  console.log('==================================');

  // Simulate the actual FPT AI response from the terminal log
  const mockFPTAIResponse = {
    "errorCode": 0,
    "errorMessage": "",
    "data": [
      {
        "id": "001095020575",
        "id_prob": "98.08",
        "name": "NGUYỄN MẠNH CƯỜNG",
        "name_prob": "98.77",
        "number_of_name_lines": "1",
        "dob": "31/10/1995",
        "dob_prob": "99.83",
        "sex": "NAM",
        "sex_prob": "98.30",
        "nationality": "VIỆT NAM",
        "nationality_prob": "99.88",
        "type_new": "cccd_12_front",
        "doe": "31/10/2035",
        "doe_prob": "98.42",
        "home": "MỸ ĐỨC, HÀ NỘI",
        "home_prob": "96.77",
        "address": "SỐ 7 HẺM 106/1/4 HQ/VIỆT, NGHĨA TÂN, CẦU GIẤY, HÀ NỘI",
        "address_prob": "99.15",
        "address_entities": {
          "province": "HÀ NỘI",
          "district": "CẦU GIẤY",
          "ward": "NGHĨA TÂN",
          "street": "SỐ 7 HẺM 106/1/4 HQ/VIỆT"
        }
      }
    ],
    "overall_score": "99.71",
    "type": "new"
  };

  console.log('\n📋 Test Case 1: Parsing High Confidence ID Card (99.71%)');
  const result1 = parseExtractionResult(mockFPTAIResponse, 'ID Card');
  
  console.log('✅ Parsing Result:');
  console.log(`   - Success: ${result1.success}`);
  console.log(`   - Overall Confidence: ${result1.confidenceScore}%`);
  console.log(`   - Needs Manual Review: ${result1.needsManualReview ? 'YES' : 'NO'}`);
  console.log(`   - Extracted Fields: ${result1.extractedFields.length}`);
  
  if (result1.extractedFields.length > 0) {
    console.log('   - Field Details:');
    result1.extractedFields.forEach(field => {
      console.log(`     * ${field.field_name}: "${field.field_value}" (${field.confidence_score}%)`);
    });
  }

  // Test with low confidence mock response
  console.log('\n📋 Test Case 2: Parsing Low Confidence Document (85%)');
  const lowConfidenceMock = {
    ...mockFPTAIResponse,
    "overall_score": "85.0",
    "data": [
      {
        ...mockFPTAIResponse.data[0],
        "name_prob": "80.0",
        "id_prob": "85.0",
        "address_prob": "90.0"
      }
    ]
  };
  
  const result2 = parseExtractionResult(lowConfidenceMock, 'ID Card');
  
  console.log('✅ Parsing Result:');
  console.log(`   - Success: ${result2.success}`);
  console.log(`   - Overall Confidence: ${result2.confidenceScore}%`);
  console.log(`   - Needs Manual Review: ${result2.needsManualReview ? 'YES' : 'NO'}`);
  console.log(`   - Expected Action: ${result2.needsManualReview ? 'Show Review Fields button' : 'Auto-store fields'}`);

  console.log('\n🎯 Test Summary:');
  console.log('================');
  
  if (result1.confidenceScore === 99.71 && !result1.needsManualReview) {
    console.log('✅ High confidence parsing: PASSED');
  } else {
    console.log('❌ High confidence parsing: FAILED');
  }
  
  if (result2.confidenceScore === 85.0 && result2.needsManualReview) {
    console.log('✅ Low confidence parsing: PASSED');
  } else {
    console.log('❌ Low confidence parsing: FAILED');
  }
  
  if (result1.extractedFields.length >= 7) {
    console.log('✅ Field extraction: PASSED');
  } else {
    console.log('❌ Field extraction: FAILED');
  }

  console.log('\n📖 Expected UI Behavior:');
  console.log('- High confidence (99.71%): Green "Validated" tag, no Review button');
  console.log('- Low confidence (85.0%): Orange "Review Required" tag, "Review Fields" button visible');
}

// Run the test
testFPTAIParsing().catch(console.error);