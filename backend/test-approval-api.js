/**
 * Test approval workflow API to verify contract URLs are returned
 */

require('dotenv').config();

async function testApprovalWorkflowAPI() {
  console.log('🧪 Testing Approval Workflow API...\n');
  
  try {
    // Test the approval workflow endpoint
    const response = await fetch('http://localhost:3001/approvals/contract/41', {
      headers: {
        'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzMwNzg0NjQwfQ.HYPmEGz6dLPc-FexQGKdIJCYQ6KnrBv6lCu6pCgJhsM',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('✅ API Response received');
    console.log('📋 Contract Data:');
    console.log(`   ID: ${data.contract?.contract_id}`);
    console.log(`   Number: ${data.contract?.contract_number}`);
    console.log(`   Status: ${data.contract?.status}`);
    console.log(`   PDF URL: ${data.contract?.pdf_url || 'Not available'}`);
    console.log(`   DOCX URL: ${data.contract?.docx_url || 'Not available'}`);
    
    console.log('\n📊 Workflow Stages:');
    if (data.workflow) {
      data.workflow.forEach((stage, index) => {
        console.log(`   ${index + 1}. ${stage.stageName}: ${stage.status}`);
      });
    }
    
    if (data.contract?.pdf_url && data.contract?.docx_url) {
      console.log('\n🎉 SUCCESS: Both contract URLs are available for the approval workflow!');
      console.log('📄 PDF URL:', data.contract.pdf_url);
      console.log('📝 DOCX URL:', data.contract.docx_url);
    } else {
      console.log('\n⚠️  Contract URLs missing in API response');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testApprovalWorkflowAPI();