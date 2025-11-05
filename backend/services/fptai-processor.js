const axios = require('axios');
const { parseExtractionResult } = require('../config/fptai-config');
const { pool } = require('../db');

class FPTAIProcessor {
  constructor() {
    this.apiKey = process.env.FPTAI_API_KEY;
    this.apiUrl = process.env.FPTAI_API_URL || 'https://api.fpt.ai/vision/idr/vnm';
  }

  async processDocument(documentId, fileUrl, documentType) {
    console.log(`🔄 Starting FPT AI processing for document ${documentId}`);
    
    try {
      // Step 1: Call FPT AI API
      const fptaiResponse = await this.callFPTAI(fileUrl);
      
      if (!fptaiResponse || fptaiResponse.errorCode !== 0) {
        throw new Error(`FPT AI processing failed: ${fptaiResponse?.errorMessage || 'Unknown error'}`);
      }

      // Step 2: Parse the response using our parsing logic
      const parsedResult = parseExtractionResult(fptaiResponse, documentType);
      
      if (!parsedResult.success) {
        throw new Error(`Failed to parse FPT AI response: ${parsedResult.error}`);
      }

      console.log(`✅ FPT AI processing successful - Confidence: ${parsedResult.confidenceScore}%`);

      // Step 3: Save results to database
      await this.saveExtractionResults(documentId, parsedResult);

      return {
        success: true,
        confidenceScore: parsedResult.confidenceScore,
        needsManualReview: parsedResult.needsManualReview,
        extractedFields: parsedResult.extractedFields
      };

    } catch (error) {
      console.error(`❌ FPT AI processing failed for document ${documentId}:`, error);
      
      // Update document status to failed
      await this.markDocumentAsFailed(documentId, error.message);
      
      throw error;
    }
  }

  async callFPTAI(fileUrl) {
    console.log('📡 Calling FPT AI API...');
    
    const response = await axios.post(this.apiUrl, {
      image: fileUrl
    }, {
      headers: {
        'api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    });

    return response.data;
  }

  async saveExtractionResults(documentId, parsedResult) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
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
        parsedResult.needsManualReview ? 'Extracted' : 'Validated',
        JSON.stringify(parsedResult.rawResponse),
        parsedResult.confidenceScore,
        parsedResult.needsManualReview,
        documentId
      ]);
      
      // If confidence is high (≥95%), automatically store extracted fields
      if (!parsedResult.needsManualReview && parsedResult.extractedFields) {
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
          `, [documentId, field.field_name, field.field_value, field.confidence_score, true]);
        }
        
        // Update document status to validated since fields are auto-stored
        await client.query(
          'UPDATE documents SET status = $1 WHERE document_id = $2',
          ['Validated', documentId]
        );
        
        console.log(`✅ Auto-stored ${parsedResult.extractedFields.length} fields for document ${documentId}`);
      } else {
        // For low confidence, store unvalidated fields for manual review
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
            `, [documentId, field.field_name, field.field_value, field.confidence_score, false]);
          }
          
          console.log(`⚠️ Stored ${parsedResult.extractedFields.length} unvalidated fields for manual review`);
        }
      }
      
      await client.query('COMMIT');
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async markDocumentAsFailed(documentId, errorMessage) {
    try {
      await pool.query(`
        UPDATE documents 
        SET 
          status = 'Failed',
          updated_at = CURRENT_TIMESTAMP
        WHERE document_id = $1
      `, [documentId]);
      
      console.log(`❌ Marked document ${documentId} as failed: ${errorMessage}`);
    } catch (error) {
      console.error('Failed to update document status to failed:', error);
    }
  }

  // Process document immediately after upload
  async processDocumentFromUpload(documentId) {
    const client = await pool.connect();
    
    try {
      // Get document details
      const result = await client.query(
        'SELECT document_id, ss_uri, document_type, file_name FROM documents WHERE document_id = $1',
        [documentId]
      );
      
      if (result.rows.length === 0) {
        throw new Error(`Document ${documentId} not found`);
      }
      
      const document = result.rows[0];
      
      // Update status to processing
      await client.query(
        'UPDATE documents SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE document_id = $2',
        ['Processing', documentId]
      );
      
      console.log(`🔄 Processing document: ${document.file_name} (Type: ${document.document_type})`);
      
      // Process with FPT AI
      const result_processing = await this.processDocument(
        documentId, 
        document.ss_uri, 
        document.document_type
      );
      
      return result_processing;
      
    } finally {
      client.release();
    }
  }
}

module.exports = new FPTAIProcessor();