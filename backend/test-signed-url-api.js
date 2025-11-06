/**
 * Test the signed URL API endpoints
 */

require('dotenv').config();

async function testSignedUrlAPI() {
  console.log('🧪 Testing Signed URL API Endpoints...\n');
  
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJlbWFpbCI6ImFkbWluQGV4YW1wbGUuY29tIiwicm9sZSI6IkFETUlOIiwiaWF0IjoxNzMwNzg0NjQwfQ.HYPmEGz6dLPc-FexQGKdIJCYQ6KnrBv6lCu6pCgJhsM';
  
  try {
    console.log('📄 Testing PDF document signed URL...');
    
    const pdfResponse = await fetch('http://localhost:3001/contracts/41/document/pdf', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (pdfResponse.ok) {
      const pdfData = await pdfResponse.json();
      console.log('✅ PDF signed URL generated successfully');
      console.log(`   Signed URL: ${pdfData.signedUrl.substring(0, 100)}...`);
      console.log(`   Expires in: ${pdfData.expiresIn} seconds`);
    } else {
      console.log(`❌ PDF API failed: ${pdfResponse.status} ${pdfResponse.statusText}`);
      const errorData = await pdfResponse.json();
      console.log('   Error:', errorData);
    }
    
    console.log('\n📝 Testing DOCX document signed URL...');
    
    const docxResponse = await fetch('http://localhost:3001/contracts/41/document/docx', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (docxResponse.ok) {
      const docxData = await docxResponse.json();
      console.log('✅ DOCX signed URL generated successfully');
      console.log(`   Signed URL: ${docxData.signedUrl.substring(0, 100)}...`);
      console.log(`   Expires in: ${docxData.expiresIn} seconds`);
    } else {
      console.log(`❌ DOCX API failed: ${docxResponse.status} ${docxResponse.statusText}`);
      const errorData = await docxResponse.json();
      console.log('   Error:', errorData);
    }
    
    console.log('\n📋 Testing combined documents endpoint...');
    
    const combinedResponse = await fetch('http://localhost:3001/contracts/41/documents', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (combinedResponse.ok) {
      const combinedData = await combinedResponse.json();
      console.log('✅ Combined documents API successful');
      console.log(`   Contract: ${combinedData.contractNumber}`);
      console.log(`   PDF available: ${combinedData.documents.pdf ? 'Yes' : 'No'}`);
      console.log(`   DOCX available: ${combinedData.documents.docx ? 'Yes' : 'No'}`);
      
      if (combinedData.documents.pdf && combinedData.documents.pdf.signedUrl) {
        console.log('\n🎉 SUCCESS: PDF signed URL is ready for use!');
        console.log(`   Test the PDF: ${combinedData.documents.pdf.signedUrl.substring(0, 150)}...`);
      }
      
      if (combinedData.documents.docx && combinedData.documents.docx.signedUrl) {
        console.log('\n🎉 SUCCESS: DOCX signed URL is ready for use!');
        console.log(`   Test the DOCX: ${combinedData.documents.docx.signedUrl.substring(0, 150)}...`);
      }
    } else {
      console.log(`❌ Combined API failed: ${combinedResponse.status} ${combinedResponse.statusText}`);
      const errorData = await combinedResponse.json();
      console.log('   Error:', errorData);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSignedUrlAPI();