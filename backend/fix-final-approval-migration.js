const { pool } = require('./db');

async function fixFinalApprovalMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Starting final approval cleanup migration...');
    
    // 1. Update contracts that are currently at final_approval stage to completed
    const updateContractsResult = await client.query(`
      UPDATE contracts 
      SET 
        current_approval_stage = 'completed',
        status = 'approved'
      WHERE current_approval_stage = 'final_approval'
      RETURNING contract_id, contract_number, current_approval_stage, status;
    `);
    
    if (updateContractsResult.rows.length > 0) {
      console.log(`✅ Updated ${updateContractsResult.rows.length} contracts from final_approval to completed:`);
      updateContractsResult.rows.forEach(row => {
        console.log(`   - Contract ${row.contract_number} (ID: ${row.contract_id}) -> ${row.current_approval_stage} (${row.status})`);
      });
    } else {
      console.log('✅ No contracts found with final_approval stage');
    }
    
    // 2. Check for any approval records with final_approval stage
    const approvalRecordsResult = await client.query(`
      SELECT contract_id, stage, status, approved_by, approved_at
      FROM contract_approvals 
      WHERE stage = 'final_approval'
      ORDER BY contract_id, approved_at;
    `);
    
    if (approvalRecordsResult.rows.length > 0) {
      console.log(`⚠️  Found ${approvalRecordsResult.rows.length} approval records with final_approval stage:`);
      approvalRecordsResult.rows.forEach(row => {
        console.log(`   - Contract ID ${row.contract_id}: ${row.stage} -> ${row.status} (${row.approved_at})`);
      });
      
      // Mark these as completed workflow steps (but don't delete for audit trail)
      const updateApprovalsResult = await client.query(`
        UPDATE contract_approvals 
        SET stage = 'workflow_completed'
        WHERE stage = 'final_approval'
        RETURNING contract_id, stage;
      `);
      
      console.log(`✅ Updated ${updateApprovalsResult.rows.length} approval records from final_approval to workflow_completed`);
    } else {
      console.log('✅ No approval records found with final_approval stage');
    }
    
    // 3. Check current status of all contracts
    const contractStatusResult = await client.query(`
      SELECT 
        status,
        current_approval_stage,
        COUNT(*) as count
      FROM contracts 
      GROUP BY status, current_approval_stage
      ORDER BY status, current_approval_stage;
    `);
    
    console.log('\n📊 Current contract status summary:');
    contractStatusResult.rows.forEach(row => {
      console.log(`   - ${row.status} / ${row.current_approval_stage || 'null'}: ${row.count} contracts`);
    });
    
    console.log('\n✅ Final approval cleanup migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during final approval cleanup migration:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the migration
fixFinalApprovalMigration()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });