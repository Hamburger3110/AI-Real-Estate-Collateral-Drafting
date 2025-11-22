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
  'lender.id.issuer': "Cục Cảnh sát Quản lý Hành chính về trật tự xã hội",
  'lender.id.issue_date': "10/11/2015",
  'lender.id.expiry_date': ['ID Expiry Date', 'expiry_date', 'doe'],
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

  // Asset information (from Property Assessment documents - Bedrock Vietnamese fields)
  'aprop.address': ['Asset Address', 'construction_address'],
  'aprop.construct.area': ['Construction Area', 'built_area', 'Diện tích xây dựng'],
  'aprop.floor.area': ['Floor Area', 'usable_area', 'Diện tích sàn hoặc công suất'],
  'aprop.construction.method': ['Construction Method', 'construction_type', 'Kết cấu chủ yếu'],
  'aprop.level': ['Building Level', 'structure_level', 'Cấp công trình'],
  'aprop.floor': ['Floor Number', 'floor', 'Số tầng'],
  'aprop.yearbuilt': ['Year Built', 'construction_year', 'Năm HT xây dựng'],
  'aprop.possessdue': ['Possession Due', 'possession_date', 'Thời hạn sở hữu'],
  'aprop.note': ['Additional Notes', 'notes', 'Ghi chú'],

  // Company information (from Business Registration)
  'lender.companyname': ['Company Name', 'business_name'],
  'lender.company.bizregcode': ['Business Registration Code', 'business_reg_code'],
  'lender.company.address': ['Company Address', 'business_address'],
};

/**
 * Bank branch information (static data that would be in bank database)
 */
const BANK_BRANCH_INFO = {
  'branch.name': 'NGÂN HÀNG TMCP VIỆT NAM THỊNH VƯỢNG - Chi Nhánh Hà Nội',
  'branch.address': 'Tòa nhà 5 Điện Biên Phủ, Phường Điện Biên, Quận Ba Đình, Hà Nội, Việt Nam',
  'branch.bizregcode': '0100233583-040',
  'branch.bizregissue': 'Sở KHĐT TP Hà Nội',
  'branch.bizreg.first.issued.date': '2010-08-10',
  'branch.phone.number': '024-38222838',
  'branch.fax': '024-39424182',
  'branch.representative.name': 'Trịnh Viết Thuân',
  'branch.representative.title': 'Branch Director'
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
      
      if (!extractedData) {
        console.log(`   ⚠️ No extracted data found in ${doc.file_name}`);
        continue;
      }
      
      // Handle different OCR extraction formats
      let dataToProcess = [];
      
      // Check for Bedrock format: raw.content[0].text contains JSON string with fields array
      if (extractedData.raw && extractedData.raw.content && Array.isArray(extractedData.raw.content)) {
        try {
          const textContent = extractedData.raw.content.find(c => c.type === 'text' && c.text);
          if (textContent && textContent.text) {
            const parsedContent = JSON.parse(textContent.text);
            if (parsedContent.fields && Array.isArray(parsedContent.fields)) {
              // Convert Bedrock fields array to object format for easier mapping
              const fieldsObject = {};
              for (const field of parsedContent.fields) {
                if (field.name && field.value !== undefined && field.value !== null && field.value !== '') {
                  fieldsObject[field.name] = field.value;
                }
              }
              dataToProcess = [fieldsObject];
              console.log(`   🔍 Using Bedrock format (${parsedContent.fields.length} fields)`);
            }
          }
        } catch (parseError) {
          console.log(`   ⚠️ Failed to parse Bedrock content: ${parseError.message}`);
        }
      }
      
      // If Bedrock format not found, try other formats
      if (dataToProcess.length === 0) {
        if (extractedData.raw_response && extractedData.raw_response.data) {
          // FPT.AI format with raw_response wrapper
          const rawData = extractedData.raw_response.data;
          dataToProcess = Array.isArray(rawData) ? rawData : [rawData];
          console.log(`   🔍 Using FPT.AI raw_response format`);
        } else if (extractedData.data) {
          // Direct data wrapper
          dataToProcess = Array.isArray(extractedData.data) ? extractedData.data : [extractedData.data];
          console.log(`   🔍 Using direct data format`);
        } else if (extractedData.results) {
          // Alternative format with results wrapper
          dataToProcess = Array.isArray(extractedData.results) ? extractedData.results : [extractedData.results];
          console.log(`   🔍 Using results format`);
        } else if (typeof extractedData === 'object') {
          // Direct object format
          dataToProcess = [extractedData];
          console.log(`   🔍 Using direct object format`);
        }
      }
      
      console.log(`   📊 Found ${dataToProcess.length} data items to process`);
      
      for (const dataItem of dataToProcess) {
        if (!dataItem || typeof dataItem !== 'object') continue;
        
        // Map each extracted field to contract fields
        for (const [contractField, possibleExtractedFields] of Object.entries(CONTRACT_FIELD_MAPPING)) {
          // Skip if mapping value is not an array (shouldn't happen, but safety check)
          if (!Array.isArray(possibleExtractedFields)) {
            continue;
          }
          
          if (mappedFields[contractField] && mappedFields[contractField].toString().trim() !== '') {
            continue; // Skip if already filled with valid data
          }
          
          // Try to find matching extracted field with multiple variations
          for (const extractedFieldName of possibleExtractedFields) {
            let value = null;
            
            // Try exact match
            value = dataItem[extractedFieldName];
            
            // Try lowercase
            if (!value) {
              value = dataItem[extractedFieldName.toLowerCase()];
            }
            
            // Try with underscores instead of spaces
            if (!value) {
              value = dataItem[extractedFieldName.replace(/\s+/g, '_').toLowerCase()];
            }
            
            // Try with spaces replaced by underscores and capitalized
            if (!value) {
              value = dataItem[extractedFieldName.replace(/\s+/g, '_')];
            }
            
            // Try case insensitive search through all keys
            if (!value) {
              const matchingKey = Object.keys(dataItem).find(key => 
                key.toLowerCase() === extractedFieldName.toLowerCase() ||
                key.toLowerCase().replace(/\s+/g, '_') === extractedFieldName.toLowerCase().replace(/\s+/g, '_')
              );
              if (matchingKey) {
                value = dataItem[matchingKey];
              }
            }
            
            // Handle special cases for Bedrock nested JSON values
            if (value && typeof value === 'string' && value.trim().startsWith('{')) {
              try {
                const parsedValue = JSON.parse(value);
                // For "Tên tài sản gắn liền với đất 1", extract nested fields
                if (extractedFieldName === 'Tên tài sản gắn liền với đất 1' && typeof parsedValue === 'object') {
                  // Map nested asset fields
                  if (parsedValue['Diện tích xây dựng'] && !mappedFields['aprop.construct.area']) {
                    mappedFields['aprop.construct.area'] = parsedValue['Diện tích xây dựng'].toString().trim();
                    console.log(`   ✅ Mapped aprop.construct.area = "${parsedValue['Diện tích xây dựng']}" (from nested field)`);
                  }
                  if (parsedValue['Diện tích sàn hoặc công suất'] && !mappedFields['aprop.floor.area']) {
                    mappedFields['aprop.floor.area'] = parsedValue['Diện tích sàn hoặc công suất'].toString().trim();
                    console.log(`   ✅ Mapped aprop.floor.area = "${parsedValue['Diện tích sàn hoặc công suất']}" (from nested field)`);
                  }
                  if (parsedValue['Kết cấu chủ yếu'] && !mappedFields['aprop.construction.method']) {
                    mappedFields['aprop.construction.method'] = parsedValue['Kết cấu chủ yếu'].toString().trim();
                    console.log(`   ✅ Mapped aprop.construction.method = "${parsedValue['Kết cấu chủ yếu']}" (from nested field)`);
                  }
                  if (parsedValue['Cấp công trình'] && !mappedFields['aprop.level']) {
                    mappedFields['aprop.level'] = parsedValue['Cấp công trình'].toString().trim();
                    console.log(`   ✅ Mapped aprop.level = "${parsedValue['Cấp công trình']}" (from nested field)`);
                  }
                  if (parsedValue['Số tầng'] && !mappedFields['aprop.floor']) {
                    mappedFields['aprop.floor'] = parsedValue['Số tầng'].toString().trim();
                    console.log(`   ✅ Mapped aprop.floor = "${parsedValue['Số tầng']}" (from nested field)`);
                  }
                  if (parsedValue['Năm HT xây dựng'] && !mappedFields['aprop.yearbuilt']) {
                    mappedFields['aprop.yearbuilt'] = parsedValue['Năm HT xây dựng'].toString().trim();
                    console.log(`   ✅ Mapped aprop.yearbuilt = "${parsedValue['Năm HT xây dựng']}" (from nested field)`);
                  }
                  if (parsedValue['Thời hạn sở hữu'] && !mappedFields['aprop.possessdue']) {
                    mappedFields['aprop.possessdue'] = parsedValue['Thời hạn sở hữu'].toString().trim();
                    console.log(`   ✅ Mapped aprop.possessdue = "${parsedValue['Thời hạn sở hữu']}" (from nested field)`);
                  }
                  // Don't set value for this field itself, it's a container
                  value = null;
                }
                // For "Thời hạn sử dụng đất" and "Nguồn gốc sử dụng đất", use as JSON string
                else if (extractedFieldName === 'Thời hạn sử dụng đất' || extractedFieldName === 'Nguồn gốc sử dụng đất') {
                  value = value; // Keep as JSON string
                }
              } catch (parseError) {
                // If JSON parsing fails, use the string value as-is
                console.log(`   ⚠️ Could not parse JSON value for ${extractedFieldName}: ${parseError.message}`);
              }
            }
            
            // Handle array values (e.g., "Loại đất")
            if (value && Array.isArray(value)) {
              value = value.join(', ');
            }
            
            if (value && value !== 'N/A' && value.toString().trim() !== '') {
              mappedFields[contractField] = value.toString().trim();
              console.log(`   ✅ Mapped ${contractField} = "${value}" (from field: ${extractedFieldName})`);
              break;
            }
          }
        }
        
        // Process "Tên tài sản gắn liền với đất 1" field separately (not in CONTRACT_FIELD_MAPPING)
        // This field contains nested JSON with asset information
        if (dataItem['Tên tài sản gắn liền với đất 1'] && typeof dataItem['Tên tài sản gắn liền với đất 1'] === 'string' && dataItem['Tên tài sản gắn liền với đất 1'].trim().startsWith('{')) {
          try {
            const assetData = JSON.parse(dataItem['Tên tài sản gắn liền với đất 1']);
            if (typeof assetData === 'object') {
              // Map nested asset fields
              if (assetData['Diện tích xây dựng'] && !mappedFields['aprop.construct.area']) {
                mappedFields['aprop.construct.area'] = assetData['Diện tích xây dựng'].toString().trim();
                console.log(`   ✅ Mapped aprop.construct.area = "${assetData['Diện tích xây dựng']}" (from Tên tài sản gắn liền với đất 1)`);
              }
              if (assetData['Diện tích sàn hoặc công suất'] && !mappedFields['aprop.floor.area']) {
                mappedFields['aprop.floor.area'] = assetData['Diện tích sàn hoặc công suất'].toString().trim();
                console.log(`   ✅ Mapped aprop.floor.area = "${assetData['Diện tích sàn hoặc công suất']}" (from Tên tài sản gắn liền với đất 1)`);
              }
              if (assetData['Kết cấu chủ yếu'] && !mappedFields['aprop.construction.method']) {
                mappedFields['aprop.construction.method'] = assetData['Kết cấu chủ yếu'].toString().trim();
                console.log(`   ✅ Mapped aprop.construction.method = "${assetData['Kết cấu chủ yếu']}" (from Tên tài sản gắn liền với đất 1)`);
              }
              if (assetData['Cấp công trình'] && !mappedFields['aprop.level']) {
                mappedFields['aprop.level'] = assetData['Cấp công trình'].toString().trim();
                console.log(`   ✅ Mapped aprop.level = "${assetData['Cấp công trình']}" (from Tên tài sản gắn liền với đất 1)`);
              }
              if (assetData['Số tầng'] && !mappedFields['aprop.floor']) {
                mappedFields['aprop.floor'] = assetData['Số tầng'].toString().trim();
                console.log(`   ✅ Mapped aprop.floor = "${assetData['Số tầng']}" (from Tên tài sản gắn liền với đất 1)`);
              }
              if (assetData['Năm HT xây dựng'] && !mappedFields['aprop.yearbuilt']) {
                mappedFields['aprop.yearbuilt'] = assetData['Năm HT xây dựng'].toString().trim();
                console.log(`   ✅ Mapped aprop.yearbuilt = "${assetData['Năm HT xây dựng']}" (from Tên tài sản gắn liền với đất 1)`);
              }
              if (assetData['Thời hạn sở hữu'] && !mappedFields['aprop.possessdue']) {
                mappedFields['aprop.possessdue'] = assetData['Thời hạn sở hữu'].toString().trim();
                console.log(`   ✅ Mapped aprop.possessdue = "${assetData['Thời hạn sở hữu']}" (from Tên tài sản gắn liền với đất 1)`);
              }
            }
          } catch (parseError) {
            console.log(`   ⚠️ Could not parse "Tên tài sản gắn liền với đất 1" JSON: ${parseError.message}`);
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