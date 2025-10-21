const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.PGUSER || 'your_pg_user',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'your_pg_db',
  password: process.env.PGPASSWORD || 'your_pg_password',
  port: process.env.PGPORT || 5432,
});

async function createTables() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id SERIAL PRIMARY KEY,
        full_name VARCHAR(256),
        email VARCHAR(255) UNIQUE,
        role VARCHAR(50),
        cognito_id VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS documents (
        document_id SERIAL PRIMARY KEY,
        file_name VARCHAR(256),
        ss_uri TEXT NOT NULL,
        document_type VARCHAR(100) CHECK (document_type IN ('Ownership', 'Business Registration', 'IDPassport')),
        upload_user_id INT REFERENCES users(user_id),
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) CHECK (status IN ('Uploaded', 'Extracted', 'Validated', 'Approved', 'Rejected')),
        textract_job_id VARCHAR(255),
        ocr_extracted_json JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS extracted_fields (
        field_id SERIAL PRIMARY KEY,
        document_id INT REFERENCES documents(document_id),
        field_name VARCHAR(255),
        field_value TEXT,
        confidence_score DECIMAL(5,2),
        validated BOOLEAN DEFAULT FALSE,
        validated_by INT REFERENCES users(user_id),
        validated_at TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS contracts (
        contract_id SERIAL PRIMARY KEY,
        document_id INT REFERENCES documents(document_id),
        contract_number VARCHAR(50) UNIQUE,
        customer_name VARCHAR(256),
        property_address TEXT,
        loan_amount DECIMAL(18,2),
        generated_pot_uri TEXT,
        generated_by INT REFERENCES users(user_id),
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_by INT REFERENCES users(user_id),
        approved_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'started'
      );
      CREATE TABLE IF NOT EXISTS integrations (
        integration_id SERIAL PRIMARY KEY,
        contract_id INT REFERENCES contracts(contract_id),
        external_system VARCHAR(100),
        integration_status VARCHAR(50),
        integration TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS activity_logs (
        log_id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(user_id),
        document_id INT REFERENCES documents(document_id),
        action VARCHAR(100),
        action_detail TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } finally {
    client.release();
  }
}

// USERS
async function createUser(full_name, email, role, cognito_id) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'INSERT INTO users (full_name, email, role, cognito_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [full_name, email, role, cognito_id]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

// DOCUMENTS
async function createDocument(data) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'INSERT INTO documents (file_name, ss_uri, document_type, upload_user_id, textract_job_id, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [data.file_name, data.ss_uri, data.document_type, data.upload_user_id, data.textract_job_id, data.status || 'Uploaded']
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

// EXTRACTED_FIELDS
async function createExtractedField(data) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'INSERT INTO extracted_fields (document_id, field_name, field_value, confidence_score, validated, validated_by, validated_at) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [data.document_id, data.field_name, data.field_value, data.confidence_score, data.validated || false, data.validated_by || null, data.validated_at || null]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

// CONTRACTS
async function createContract(data) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'INSERT INTO contracts (document_id, contract_number, customer_name, property_address, loan_amount, generated_pot_uri, generated_by, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [data.document_id, data.contract_number, data.customer_name, data.property_address, data.loan_amount, data.generated_pot_uri, data.generated_by, data.status || 'started']
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

// INTEGRATIONS
async function createIntegration(data) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'INSERT INTO integrations (contract_id, external_system, integration_status, integration) VALUES ($1, $2, $3, $4) RETURNING *',
      [data.contract_id, data.external_system, data.integration_status, data.integration]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

// ACTIVITY_LOGS
async function createActivityLog(data) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      'INSERT INTO activity_logs (user_id, document_id, action, action_detail) VALUES ($1, $2, $3, $4) RETURNING *',
      [data.user_id, data.document_id, data.action, data.action_detail]
    );
    return result.rows[0];
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  createTables,
  createUser,
  createDocument,
  createExtractedField,
  createContract,
  createIntegration,
  createActivityLog
};
