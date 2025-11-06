/**
 * Field Mapper Service
 * Maps extracted OCR fields to contract template fields
 */

/**
 * Contract field requirements mapping
 * Maps database field names to contract template placeholders
 */
const CONTRACT_FIELD_MAPPING = {
  // Document information
  'doc.number': ['contract_number'],
  'doc.signing_date': ['signing_date', 'contract_date'],
  'doc.signing_location.office': ['signing_location', 'office_location'],

  // Lender information (from ID Card/Personal documents)
  'lender.name': ['Full Name', 'name', 'customer_name'],
  'lender.id.number': ['ID Number', 'id', 'identity_number'],
  'lender.id.issuer': ['ID Issuer', 'issuer', 'id_issuer'],
  'lender.id.issue_date': ['ID Issue Date', 'issue_date', 'id_issue_date'],
  'lender.address.original': ['Address', 'address', 'place_of_origin', 'home'],

  // Spouse information (if available)
  'spouse.id.number': ['Spouse ID Number', 'spouse_id'],
  'spouse.id.issuer': ['Spouse ID Issuer', 'spouse_issuer'],
  'spouse.id.issue_date': ['Spouse ID Issue Date', 'spouse_issue_date'],
  'spouse.address.original': ['Spouse Address', 'spouse_address'],

  // Property information (from Legal Registration documents)
  'propID': ['Property ID', 'property_id', 'land_parcel_id'],
  'prop.certID': ['Certificate ID', 'cert_id', 'ownership_cert_id'],
  'prop.cert.issuer': ['Certificate Issuer', 'cert_issuer'],
  'prop.cert.issue.date': ['Certificate Issue Date', 'cert_issue_date'],
  'prop.cert.owner': ['Certificate Owner', 'owner_name'],
  'prop.detailed.id': ['Land Parcel Number', 'parcel_number', 'land_number'],
  'prop.mapID': ['Map ID', 'map_sheet_id'],
  'prop.address': ['Property Address', 'property_address', 'land_address'],
  'prop.area': ['Property Area', 'land_area', 'area'],
  'prop.usage.method': ['Usage Method', 'land_use_method'],
  'prop.purpose': ['Usage Purpose', 'land_use_purpose'],
  'prop.period': ['Usage Period', 'land_use_period'],
  'prop.origin': ['Land Origin', 'origin'],
  'prop.value': ['Property Value', 'property_value', 'assessed_value'],

  // Asset information (from Property Assessment documents)
  'aprop.address': ['Asset Address', 'construction_address'],
  'aprop.construct.area': ['Construction Area', 'built_area'],
  'aprop.floor.area': ['Floor Area', 'usable_area'],
  'aprop.construction.method': ['Construction Method', 'construction_type'],
  'aprop.level': ['Building Level', 'structure_level'],
  'aprop.floor': ['Floor Number', 'floor'],
  'aprop.yearbuilt': ['Year Built', 'construction_year'],
  'aprop.possessdue': ['Possession Due', 'possession_date'],
  'aprop.note': ['Additional Notes', 'notes'],

  // Company information (from Business Registration)
  'lender.companyname': ['Company Name', 'business_name'],
  'lender.company.bizregcode': ['Business Registration Code', 'business_reg_code'],
  'lender.company.address': ['Company Address', 'business_address'],
};

/**
 * Bank branch information (static data that would be in bank database)
 */
const BANK_BRANCH_INFO = {
  'branch.name': 'NGÂN HÀNG THƯƠNG MẠI CỔ PHẦN VIỆT NAM THỊNH VƯỢNG',
  'branch.address': '',
  'branch.bizregcode': '',
  'branch.bizregissue': '',
  'branch.bizreg.first.issued.date': '',
  'branch.phone.number': '',
  'branch.fax': '',
  'branch.representative.name': '',
  'branch.representative.title': ''
};

/**
 * Extract and map fields from contract documents
 * @param {number} contractId - Contract ID
 * @param {Object} pool - Database pool
 * @returns {Promise<Object>} Mapped contract fields
 */
async function mapContractFields(contractId, pool) {
  const client = await pool.connect();
  
  try {
    console.log(`📋 Mapping fields for contract ${contractId}...`);
    
    // Get all documents for this contract with their extracted data
    const documentsResult = await client.query(`
      SELECT 
        document_id,
        document_type,
        file_name,
        ocr_extracted_json,
        confidence_score,
        status
      FROM documents 
      WHERE contract_id = $1 
      AND ocr_extracted_json IS NOT NULL
      ORDER BY document_type, upload_date DESC
    `, [contractId]);
    
    if (documentsResult.rows.length === 0) {
      throw new Error(`No documents with extracted data found for contract ${contractId}`);
    }
    
    console.log(`📄 Found ${documentsResult.rows.length} documents with extracted data`);
    
    // Also get contract basic info
    const contractResult = await client.query(`
      SELECT 
        contract_number,
        customer_name,
        property_address,
        loan_amount,
        generated_at
      FROM contracts 
      WHERE contract_id = $1
    `, [contractId]);
    
    if (contractResult.rows.length === 0) {
      throw new Error(`Contract ${contractId} not found`);
    }
    
    const contract = contractResult.rows[0];
    const documents = documentsResult.rows;
    
    // Initialize the mapped fields object
    const mappedFields = {
      // Contract basic info
      'doc.number': contract.contract_number,
      'doc.signing_date': new Date().toISOString().split('T')[0], // Default to today
      'doc.signing_location.office': '', // To be filled by user or bank data
      
      // Bank information (static)
      ...BANK_BRANCH_INFO,
      
      // Loan information
      'loan.amount': contract.loan_amount,
      
      // Initialize all other fields as empty
      ...Object.keys(CONTRACT_FIELD_MAPPING).reduce((acc, key) => {
        acc[key] = '';
        return acc;
      }, {})
    };
    
    // Process each document and extract relevant fields
    for (const doc of documents) {
      console.log(`📄 Processing ${doc.document_type}: ${doc.file_name}`);
      
      const extractedData = doc.ocr_extracted_json;
      
      if (!extractedData || !extractedData.data) {
        console.log(`   ⚠️ No extracted data found in ${doc.file_name}`);
        continue;
      }
      
      // Process FPT.AI extraction format
      const dataArray = Array.isArray(extractedData.data) ? extractedData.data : [extractedData.data];
      
      for (const dataItem of dataArray) {
        // Map each extracted field to contract fields
        for (const [contractField, possibleExtractedFields] of Object.entries(CONTRACT_FIELD_MAPPING)) {
          if (mappedFields[contractField]) continue; // Skip if already filled
          
          // Try to find matching extracted field
          for (const extractedFieldName of possibleExtractedFields) {
            const value = dataItem[extractedFieldName] || 
                         dataItem[extractedFieldName.toLowerCase()] || 
                         dataItem[extractedFieldName.replace(/\s+/g, '_').toLowerCase()];
            
            if (value && value !== 'N/A' && value.toString().trim() !== '') {
              mappedFields[contractField] = value.toString().trim();
              console.log(`   ✅ Mapped ${contractField} = ${value}`);
              break;
            }
          }
        }
      }
    }
    
    // Also get validated fields from extracted_fields table
    const fieldsResult = await client.query(`
      SELECT DISTINCT ef.field_name, ef.field_value, ef.confidence_score
      FROM extracted_fields ef
      JOIN documents d ON ef.document_id = d.document_id
      WHERE d.contract_id = $1 
      AND ef.validated = true
      AND ef.field_value IS NOT NULL 
      AND ef.field_value != ''
      ORDER BY ef.confidence_score DESC
    `, [contractId]);
    
    console.log(`📋 Found ${fieldsResult.rows.length} validated extracted fields`);
    
    // Override with validated fields (higher priority)
    for (const field of fieldsResult.rows) {
      for (const [contractField, possibleExtractedFields] of Object.entries(CONTRACT_FIELD_MAPPING)) {
        if (possibleExtractedFields.includes(field.field_name)) {
          mappedFields[contractField] = field.field_value;
          console.log(`   ✅ Overrode ${contractField} with validated field = ${field.field_value}`);
          break;
        }
      }
    }
    
    // Calculate completion percentage
    const totalFields = Object.keys(CONTRACT_FIELD_MAPPING).length;
    const filledFields = Object.values(mappedFields).filter(value => value && value.toString().trim() !== '').length;
    const completionPercentage = Math.round((filledFields / totalFields) * 100);
    
    console.log(`✅ Field mapping complete: ${filledFields}/${totalFields} fields (${completionPercentage}%)`);
    
    return {
      success: true,
      contractId,
      mappedFields,
      completionPercentage,
      totalFields,
      filledFields,
      documentsProcessed: documents.length
    };
    
  } catch (error) {
    console.error(`❌ Error mapping fields for contract ${contractId}:`, error);
    return {
      success: false,
      error: error.message,
      contractId
    };
  } finally {
    client.release();
  }
}

/**
 * Get missing required fields for a contract
 * @param {Object} mappedFields - Already mapped fields
 * @returns {Array} List of missing required fields
 */
function getMissingRequiredFields(mappedFields) {
  const requiredFields = [
    'lender.name',
    'lender.id.number',
    'lender.address.original',
    'prop.address',
    'prop.area',
    'prop.value'
  ];
  
  return requiredFields.filter(field => 
    !mappedFields[field] || mappedFields[field].toString().trim() === ''
  );
}

/**
 * Validate mapped fields for contract generation
 * @param {Object} mappedFields - Mapped fields object
 * @returns {Object} Validation result
 */
function validateMappedFields(mappedFields) {
  const missingRequired = getMissingRequiredFields(mappedFields);
  
  const warnings = [];
  
  // Check for important but not critical fields
  const importantFields = [
    'prop.cert.owner',
    'prop.certID',
    'lender.id.issue_date'
  ];
  
  importantFields.forEach(field => {
    if (!mappedFields[field] || mappedFields[field].toString().trim() === '') {
      warnings.push(`Missing important field: ${field}`);
    }
  });
  
  return {
    isValid: missingRequired.length === 0,
    missingRequired,
    warnings,
    canGenerate: true // Always allow generation (temporary)
  };
}

module.exports = {
  mapContractFields,
  getMissingRequiredFields,
  validateMappedFields,
  CONTRACT_FIELD_MAPPING,
  BANK_BRANCH_INFO
};