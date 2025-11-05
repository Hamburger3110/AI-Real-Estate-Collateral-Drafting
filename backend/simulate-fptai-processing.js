#!/usr/bin/env node

// Simulate FPT AI webhook processing for existing documents
require('dotenv').config();
const { Pool } = require('pg');
const { parseExtractionResult } = require('./config/fptai-config');

const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
  ssl: process.env.PGHOST && process.env.PGHOST.includes('rds.amazonaws.com') ? { rejectUnauthorized: false } : false
});

async function simulateFPTAIProcessing() {
  console.log('🔄 Simulating FPT AI Processing for Existing Documents');
  console.log('======================================================');

  const client = await pool.connect();
  
  try {
    // Find documents that might need confidence score processing
    const documentsResult = await client.query(`
      SELECT document_id, file_name, document_type, status, confidence_score
      FROM documents 
      WHERE document_type = 'ID Card' 
      AND (confidence_score IS NULL OR confidence_score = 0)
      ORDER BY upload_date DESC
      LIMIT 5
    `);

    console.log(`📋 Found ${documentsResult.rows.length} documents to process`);

    if (documentsResult.rows.length === 0) {
      console.log('ℹ️  No documents found that need confidence score processing');
      return;
    }

    // Mock FPT AI response with high confidence (99.71% like in terminal)
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

    for (const doc of documentsResult.rows) {
      console.log(`\n📄 Processing document ${doc.document_id}: ${doc.file_name}`);
      
      // Parse the mock FPT AI response
      const parsedResult = parseExtractionResult(mockFPTAIResponse, doc.document_type);
      
      if (!parsedResult.success) {
        console.log(`❌ Failed to parse result for document ${doc.document_id}`);
        continue;
      }

      console.log(`   Confidence: ${parsedResult.confidenceScore}%`);
      console.log(`   Needs Review: ${parsedResult.needsManualReview ? 'YES' : 'NO'}`);
      console.log(`   Fields Extracted: ${parsedResult.extractedFields.length}`);

      await client.query('BEGIN');
      
      try {
        // Update document with extraction results
        await client.query(`
          UPDATE documents 
          SET 
            status = $1,
            ocr_extracted_json = $2,
            confidence_score = $3,
            needs_manual_review = $4,
            extraction_completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE document_id = $5
        `, [
          parsedResult.needsManualReview ? 'Needs Review' : 'Extracted',
          JSON.stringify(parsedResult.rawResponse),
          parsedResult.confidenceScore,
          parsedResult.needsManualReview,
          doc.document_id
        ]);
        
        // If confidence is high (≥95%), automatically store extracted fields
        if (!parsedResult.needsManualReview && parsedResult.extractedFields) {
          for (const field of parsedResult.extractedFields) {
            await client.query(`
              INSERT INTO extracted_fields 
              (document_id, field_name, field_value, confidence_score, validated, validated_at)
              VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
              ON CONFLICT (document_id, field_name) 
              DO UPDATE SET field_value = $3, confidence_score = $4, validated = $5, validated_at = CURRENT_TIMESTAMP
            `, [doc.document_id, field.field_name, field.field_value, field.confidence_score, true]);
          }
          
          // Update document status to validated
          await client.query(
            'UPDATE documents SET status = $1 WHERE document_id = $2',
            ['Validated', doc.document_id]
          );
          
          console.log(`   ✅ Auto-stored ${parsedResult.extractedFields.length} fields`);
        } else {
          console.log(`   ⚠️  Marked for manual review`);
        }
        
        await client.query('COMMIT');
        console.log(`   ✅ Document ${doc.document_id} processed successfully`);
        
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`   ❌ Error processing document ${doc.document_id}:`, error.message);
      }
    }

    // Show final status
    console.log('\n📊 Final Document Status:');
    const finalStatus = await client.query(`
      SELECT 
        document_id,
        file_name,
        status,
        confidence_score,
        needs_manual_review,
        (SELECT COUNT(*) FROM extracted_fields WHERE document_id = documents.document_id) as field_count
      FROM documents 
      WHERE document_type = 'ID Card'
      ORDER BY upload_date DESC
      LIMIT 5
    `);

    finalStatus.rows.forEach(doc => {
      const statusIcon = doc.confidence_score >= 95 ? '✅' : '⚠️';
      console.log(`${statusIcon} ${doc.file_name}:`);
      console.log(`    Status: ${doc.status}`);
      console.log(`    Confidence: ${doc.confidence_score}%`);
      console.log(`    Manual Review: ${doc.needs_manual_review ? 'YES' : 'NO'}`);
      console.log(`    Extracted Fields: ${doc.field_count}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the simulation
simulateFPTAIProcessing();