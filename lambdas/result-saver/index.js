const { Client } = require('pg');
const AWS = require('aws-sdk');

async function getDbClient() {
  const client = new Client({
    host: process.env.PGHOST,
    port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  return client;
}

exports.handler = async (event) => {
  // event: { bucket, key, result }
  const bucket = event.bucket || (event.s3 && event.s3.bucket);
  const key = event.key || (event.s3 && event.s3.key);
  const result = event.result || event.qa || event.qrDecoded || {};

  if (!bucket || !key) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing bucket/key' }) };
  }

  const client = await getDbClient();
  try {
    // Find document row by s3 key or ss_uri LIKE
    const findSql = `
      SELECT document_id, ss_uri
      FROM documents
      WHERE ss_uri LIKE '%' || $1
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    const { rows } = await client.query(findSql, [key]);
    if (!rows.length) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Document not found for key', key }) };
    }
    const documentId = rows[0].document_id;

    const extractedFields = result.fields || {};
    const overall = typeof result.overall_confidence === 'number' ? result.overall_confidence : 0;
    const needsReview = overall < 90 ? true : false;

    const payload = {
      api_source: result.source || 'pipeline',
      confidence_score: overall,
      needs_manual_review: needsReview,
      extracted_fields: extractedFields,
      raw_response: result.raw || result
    };

    const updateSql = `
      UPDATE documents
      SET status = $1,
          ocr_extracted_json = $2,
          confidence_score = $3,
          needs_manual_review = $4,
          extraction_completed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE document_id = $5
    `;
    await client.query(updateSql, [
      'Extracted',
      JSON.stringify(payload),
      overall,
      needsReview,
      documentId
    ]);

    return { statusCode: 200, body: JSON.stringify({ document_id: documentId, status: 'saved' }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  } finally {
    await client.end();
  }
};


