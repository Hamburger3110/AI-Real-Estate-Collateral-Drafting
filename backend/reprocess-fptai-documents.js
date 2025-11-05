#!/usr/bin/env node

/**
 * Reprocess Documents with Fixed FPT AI Parsing
 * 
 * This script reprocesses documents that have existing FPT AI data
 * but incorrect confidence scores due to parsing issues.
 */

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

async function reprocessDocumentsWithIncorrectParsing() {
  console.log('🔄 Reprocessing Documents with Incorrect FPT AI Parsing');
  console.log('=====================================================');

  const client = await pool.connect();
  
  try {
    // Find documents that have FPT AI data but incorrect confidence scores
    const documentsResult = await client.query(`
      SELECT 
        document_id, 
        file_name, 
        document_type, 
        status, 
        confidence_score,
        ocr_extracted_json,
        needs_manual_review
      FROM documents 
      WHERE document_type IN ('ID Card', 'Passport')
      AND ocr_extracted_json IS NOT NULL
      AND (
        confidence_score = 0 
        OR confidence_score IS NULL
        OR (ocr_extracted_json->'raw_response'->>'overall_score' IS NOT NULL 
            AND confidence_score != CAST(ocr_extracted_json->'raw_response'->>'overall_score' AS NUMERIC))
      )
      ORDER BY upload_date DESC
    `);

    console.log(`📋 Found ${documentsResult.rows.length} documents to reprocess`);

    if (documentsResult.rows.length === 0) {
      console.log('✅ No documents need reprocessing - all confidence scores are correct');
      return;
    }

    for (const doc of documentsResult.rows) {
      console.log(`\n📄 Reprocessing document ${doc.document_id}: ${doc.file_name}`);
      
      try {
        // Extract the raw FPT AI response from stored JSON
        const ocrData = doc.ocr_extracted_json;
        let rawFPTResponse = null;

        if (ocrData.raw_response) {
          rawFPTResponse = ocrData.raw_response;
        } else if (ocrData.data && ocrData.overall_score) {
          // JSON is the raw FPT AI response itself
          rawFPTResponse = ocrData;
        } else {
          console.log(`   ⚠️  No FPT AI response found in stored data`);
          continue;
        }

        // Reparse with fixed logic
        const parsedResult = parseExtractionResult(rawFPTResponse, doc.document_type);
        
        if (!parsedResult.success) {
          console.log(`   ❌ Failed to reparse: ${parsedResult.error}`);
          continue;
        }

        console.log(`   Old Confidence: ${doc.confidence_score}%`);
        console.log(`   New Confidence: ${parsedResult.confidenceScore}%`);
        console.log(`   Needs Review: ${parsedResult.needsManualReview ? 'YES' : 'NO'}`);

        await client.query('BEGIN');
        
        try {
          // Update document with correct parsing
          const newStatus = parsedResult.needsManualReview ? 'Extracted' : 'Validated';
          
          await client.query(`
            UPDATE documents 
            SET 
              confidence_score = $1,
              needs_manual_review = $2,
              status = $3,
              updated_at = CURRENT_TIMESTAMP
            WHERE document_id = $4
          `, [parsedResult.confidenceScore, parsedResult.needsManualReview, newStatus, doc.document_id]);
          
          // Handle fields based on confidence
          if (!parsedResult.needsManualReview && parsedResult.extractedFields) {
            // High confidence - auto-validate fields
            for (const field of parsedResult.extractedFields) {
              await client.query(`
                INSERT INTO extracted_fields 
                (document_id, field_name, field_value, confidence_score, validated, validated_at)
                VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
                ON CONFLICT (document_id, field_name) 
                DO UPDATE SET 
                  field_value = $3, 
                  confidence_score = $4, 
                  validated = $5, 
                  validated_at = CURRENT_TIMESTAMP
              `, [doc.document_id, field.field_name, field.field_value, field.confidence_score, true]);
            }
            
            // Update status to validated
            await client.query(
              'UPDATE documents SET status = $1 WHERE document_id = $2',
              ['Validated', doc.document_id]
            );
            
            console.log(`   ✅ Auto-validated ${parsedResult.extractedFields.length} fields`);
          } else {
            // Low confidence - store unvalidated fields for manual review
            if (parsedResult.extractedFields) {
              for (const field of parsedResult.extractedFields) {
                await client.query(`
                  INSERT INTO extracted_fields 
                  (document_id, field_name, field_value, confidence_score, validated)
                  VALUES ($1, $2, $3, $4, $5)
                  ON CONFLICT (document_id, field_name) 
                  DO UPDATE SET 
                    field_value = $3, 
                    confidence_score = $4, 
                    validated = $5
                `, [doc.document_id, field.field_name, field.field_value, field.confidence_score, false]);
              }
            }
            console.log(`   ⚠️  Marked for manual review - ${parsedResult.extractedFields?.length || 0} fields`);
          }
          
          await client.query('COMMIT');
          console.log(`   ✅ Document ${doc.document_id} reprocessed successfully`);
          
        } catch (error) {
          await client.query('ROLLBACK');
          console.error(`   ❌ Error updating document ${doc.document_id}:`, error.message);
        }
        
      } catch (error) {
        console.error(`   ❌ Error reprocessing document ${doc.document_id}:`, error.message);
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
      WHERE document_type IN ('ID Card', 'Passport')
      AND ocr_extracted_json IS NOT NULL
      ORDER BY upload_date DESC
      LIMIT 10
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

// Check if script is run directly
if (require.main === module) {
  reprocessDocumentsWithIncorrectParsing()
    .then(() => {
      console.log('\n🎯 Reprocessing Complete!');
      console.log('📱 You can now refresh your frontend to see correct confidence scores.');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Reprocessing failed:', error);
      process.exit(1);
    });
}

module.exports = { reprocessDocumentsWithIncorrectParsing };