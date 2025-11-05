const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.PGUSER || 'your_pg_user',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'your_pg_db',
  password: process.env.PGPASSWORD || 'your_pg_password',
  port: process.env.PGPORT || 5432,
  ssl: process.env.PGHOST && process.env.PGHOST.includes('rds.amazonaws.com') ? {
    rejectUnauthorized: false
  } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

// DATABASE MIGRATIONS
async function runMigrations() {
  const client = await pool.connect();
  try {
    // Create schema version table first
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check current schema version
    const versionResult = await client.query('SELECT COALESCE(MAX(version), 0) as current_version FROM schema_version');
    const currentVersion = parseInt(versionResult.rows[0].current_version) || 0;
    
    console.log(`📋 Current database schema version: ${currentVersion}`);

    // Migration 3: Add approval workflow columns to existing contracts table
    if (currentVersion < 3) {
      console.log('📦 Applying migration 3 - Adding approval workflow columns...');
      
      try {
        // Add new columns to existing contracts table if they don't exist
        await client.query(`
          DO $$ 
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='current_approval_stage') THEN
              ALTER TABLE contracts ADD COLUMN current_approval_stage VARCHAR(50) DEFAULT 'document_review';
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='risk_score') THEN
              ALTER TABLE contracts ADD COLUMN risk_score DECIMAL(5,2) DEFAULT 0;
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='priority') THEN
              ALTER TABLE contracts ADD COLUMN priority VARCHAR(20) DEFAULT 'medium';
            END IF;
          END $$;
        `);
        
        // Update existing contracts to use new schema
        await client.query(`
          UPDATE contracts SET 
            status = CASE
              WHEN status = 'started' THEN 'draft'
              WHEN status = 'processing' THEN 'draft'
              WHEN status = 'pending_documents' THEN 'draft'
              ELSE status
            END,
            current_approval_stage = CASE 
              WHEN status = 'approved' THEN 'completed'
              WHEN status = 'rejected' THEN 'rejected'
              WHEN current_approval_stage IS NULL OR current_approval_stage = '' THEN 'document_review'
              ELSE current_approval_stage
            END,
            priority = COALESCE(priority, 'medium');
        `);
        
        // Create contract approvals table
        await client.query(`
          CREATE TABLE IF NOT EXISTS contract_approvals (
            approval_id SERIAL PRIMARY KEY,
            contract_id INT REFERENCES contracts(contract_id),
            stage VARCHAR(50) NOT NULL,
            approver_id INT REFERENCES users(user_id),
            status VARCHAR(20) NOT NULL,
            comments TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(contract_id, stage)
          );
        `);
        
        await client.query('INSERT INTO schema_version (version) VALUES (3) ON CONFLICT (version) DO NOTHING');
        console.log('✅ Migration 3 completed successfully');
        
      } catch (error) {
        console.error('❌ Error in migration 3:', error.message);
        throw error;
      }
    }

    // Migration 4: Fix contract-document relationship from 1-to-1 to 1-to-many
    if (currentVersion < 4) {
      console.log('📦 Applying migration 4 - Fixing contract-document relationship...');
      
      try {
        // Add contract_id column to documents table if it doesn't exist
        await client.query(`
          DO $$ 
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='contract_id') THEN
              ALTER TABLE documents ADD COLUMN contract_id INTEGER REFERENCES contracts(contract_id);
            END IF;
          END $$;
        `);
        
        // Remove document_id column from contracts table if it exists
        await client.query(`
          DO $$ 
          BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contracts' AND column_name='document_id') THEN
              ALTER TABLE contracts DROP COLUMN document_id;
            END IF;
          END $$;
        `);
        
        await client.query('INSERT INTO schema_version (version) VALUES (4) ON CONFLICT (version) DO NOTHING');
        console.log('✅ Migration 4 completed successfully - Contract-document relationship is now 1-to-many');
        
      } catch (error) {
        console.error('❌ Error in migration 4:', error.message);
        throw error;
      }
    }

    // Migration 5: Add OCR extraction tracking columns to documents table
    if (currentVersion < 5) {
      console.log('📦 Applying migration 5 - Adding OCR extraction tracking columns...');
      
      try {
        // Add new columns for FPT.AI OCR tracking
        await client.query(`
          DO $$ 
          BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='confidence_score') THEN
              ALTER TABLE documents ADD COLUMN confidence_score DECIMAL(5,2);
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='needs_manual_review') THEN
              ALTER TABLE documents ADD COLUMN needs_manual_review BOOLEAN DEFAULT FALSE;
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='extraction_completed_at') THEN
              ALTER TABLE documents ADD COLUMN extraction_completed_at TIMESTAMP;
            END IF;
          END $$;
        `);
        
        await client.query('INSERT INTO schema_version (version) VALUES (5) ON CONFLICT (version) DO NOTHING');
        console.log('✅ Migration 5 completed successfully - OCR tracking columns added');
        
      } catch (error) {
        console.error('❌ Error in migration 5:', error.message);
        throw error;
      }
    }

    // Migration 6: Update document_type enum to support new document types
    if (currentVersion < 6) {
      console.log('📦 Applying migration 6 - Updating document type enum...');
      
      try {
        // Drop existing check constraint
        await client.query(`
          ALTER TABLE documents 
          DROP CONSTRAINT IF EXISTS documents_document_type_check;
        `);
        
        // Add new check constraint with updated document types
        await client.query(`
          ALTER TABLE documents 
          ADD CONSTRAINT documents_document_type_check 
          CHECK (document_type IN (
            'ID Card', 
            'Passport', 
            'Legal Registration', 
            'Business Registration', 
            'Financial Statement'
          ));
        `);
        
        await client.query('INSERT INTO schema_version (version) VALUES (6) ON CONFLICT (version) DO NOTHING');
        console.log('✅ Migration 6 completed successfully - Document types updated');
        
      } catch (error) {
        console.error('❌ Error in migration 6:', error.message);
        throw error;
      }
    }

    console.log('✅ All migrations completed');
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    client.release();
  }
}

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
        document_type VARCHAR(100) CHECK (document_type IN ('ID Card', 'Passport', 'Legal Registration', 'Business Registration', 'Financial Statement')),
        upload_user_id INT REFERENCES users(user_id),
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(50) CHECK (status IN ('Uploaded', 'Extracted', 'Validated', 'Approved', 'Rejected')),
        textract_job_id VARCHAR(255),
        ocr_extracted_json JSONB,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        contract_id INTEGER,
        confidence_score DECIMAL(5,2),
        needs_manual_review BOOLEAN DEFAULT FALSE,
        extraction_completed_at TIMESTAMP
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
        contract_number VARCHAR(50) UNIQUE,
        customer_name VARCHAR(256),
        property_address TEXT,
        loan_amount DECIMAL(18,2),
        generated_pot_uri TEXT,
        generated_by INT REFERENCES users(user_id),
        generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_by INT REFERENCES users(user_id),
        approved_at TIMESTAMP,
        status VARCHAR(50) DEFAULT 'draft',
        current_approval_stage VARCHAR(50) DEFAULT 'document_review',
        risk_score DECIMAL(5,2) DEFAULT 0,
        priority VARCHAR(20) DEFAULT 'medium'
      );
      CREATE TABLE IF NOT EXISTS contract_approvals (
        approval_id SERIAL PRIMARY KEY,
        contract_id INT REFERENCES contracts(contract_id),
        stage VARCHAR(50) NOT NULL,
        approver_id INT REFERENCES users(user_id),
        status VARCHAR(20) NOT NULL,
        comments TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(contract_id, stage)
      );
      CREATE TABLE IF NOT EXISTS integrations (
        integration_id SERIAL PRIMARY KEY,
        contract_id INT REFERENCES contracts(contract_id),
        external_system VARCHAR(100),
        integration_status VARCHAR(50),
        integration TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Add foreign key constraint for documents.contract_id if it doesn't exist
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'documents_contract_id_fkey'
        ) THEN
          ALTER TABLE documents ADD CONSTRAINT documents_contract_id_fkey 
          FOREIGN KEY (contract_id) REFERENCES contracts(contract_id);
        END IF;
      END $$;
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
      'INSERT INTO contracts (contract_number, customer_name, property_address, loan_amount, generated_pot_uri, generated_by, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [data.contract_number, data.customer_name, data.property_address, data.loan_amount, data.generated_pot_uri, data.generated_by, data.status || 'started']
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

// Seed demo users for authentication system
async function seedDemoUsers() {
  const client = await pool.connect();
  try {
    // Check if users already exist
    const existingUsers = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(existingUsers.rows[0].count) > 0) {
      console.log('Demo users already exist, skipping seed.');
      return;
    }

    // Insert demo users that match our authentication system
    const demoUsers = [
      {
        full_name: 'System Administrator',
        email: 'admin@vpbank.com',
        role: 'ADMIN',
        cognito_id: 'admin-demo-1'
      },
      {
        full_name: 'Sarah Johnson',
        email: 'credit.officer@vpbank.com',
        role: 'CREDIT_OFFICER',
        cognito_id: 'credit-demo-2'
      },
      {
        full_name: 'Lisa Chen',
        email: 'legal.officer@vpbank.com',
        role: 'LEGAL_OFFICER',
        cognito_id: 'legal-demo-3'
      },
      {
        full_name: 'Mike Wilson',
        email: 'manager@vpbank.com',
        role: 'MANAGER',
        cognito_id: 'manager-demo-4'
      }
    ];

    for (const user of demoUsers) {
      await client.query(
        'INSERT INTO users (full_name, email, role, cognito_id) VALUES ($1, $2, $3, $4)',
        [user.full_name, user.email, user.role, user.cognito_id]
      );
    }

    console.log('✅ Demo users seeded successfully.');
  } catch (error) {
    console.error('❌ Error seeding demo users:', error);
  } finally {
    client.release();
  }
}

// Test database connection
async function testConnection() {
  try {
    console.log('🔗 Attempting to connect to:', process.env.PGHOST);
    console.log('📧 Using user:', process.env.PGUSER);
    console.log('🗄️ Database:', process.env.PGDATABASE);
    
    const client = await pool.connect();
    const result = await client.query('SELECT NOW(), version()');
    client.release();
    
    console.log('✅ Database connection successful!');
    console.log('⏰ Server time:', result.rows[0].now);
    console.log('🗃️ PostgreSQL version:', result.rows[0].version.split(' ')[0]);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('   Error code:', error.code);
    console.error('   Error message:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.error('   ➤ DNS resolution failed. Check your RDS endpoint.');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   ➤ Connection refused. Check security groups and port 5432.');
    } else if (error.code === '28P01') {
      console.error('   ➤ Authentication failed. Check username/password.');
    } else if (error.code === '3D000') {
      console.error('   ➤ Database does not exist. Check database name.');
    }
    
    return false;
  }
}

module.exports = {
  pool,
  createTables,
  runMigrations,
  seedDemoUsers,
  testConnection,
  createUser,
  createDocument,
  createExtractedField,
  createContract,
  createIntegration,
  createActivityLog
};
