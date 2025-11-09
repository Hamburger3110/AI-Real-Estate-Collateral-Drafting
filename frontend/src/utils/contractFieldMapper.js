/**
 * Contract Field Mapper
 * Maps extracted document data to contract fields
 */

/**
 * Extract lender information from ID card data
 * @param {Object} idData - Extracted ID card data from FPT.AI
 * @returns {Object} Lender information
 */
export function extractLenderFromID(idData) {
  if (!idData || !idData.data || !Array.isArray(idData.data) || idData.data.length === 0) {
    return null;
  }

  const id = idData.data[0]; // First ID card
  return {
    name: id.name || '',
    idNumber: id.id || '',
    idIssuer: 'Cơ quan cấp CCCD', // Default, can be extracted if available
    idIssueDate: id.doe || '', // Date of expiry, might need to adjust
    address: id.address || ''
  };
}

/**
 * Extract spouse information from ID card data (second ID if available)
 * @param {Object} idData - Extracted ID card data from FPT.AI
 * @returns {Object} Spouse information or null
 */
export function extractSpouseFromID(idData) {
  if (!idData || !idData.data || !Array.isArray(idData.data) || idData.data.length < 2) {
    return null;
  }

  const id = idData.data[1]; // Second ID card
  return {
    idNumber: id.id || '',
    idIssuer: 'Cơ quan cấp CCCD',
    idIssueDate: id.doe || '',
    address: id.address || ''
  };
}

/**
 * Map Legal Registration fields to contract property fields
 * @param {Object} legalData - Extracted Legal Registration data
 * @returns {Object} Property information
 */
export function mapLegalRegistrationToProperty(legalData) {
  if (!legalData || !legalData.extracted_fields) {
    return null;
  }

  const fields = legalData.extracted_fields;
  
  // Helper to get value from field object
  const getValue = (key) => {
    const field = fields[key];
    if (!field) return '';
    return typeof field === 'object' && field.value !== undefined ? field.value : field;
  };

  // Extract property information
  const property = {
    propID: 'XYZ123', // Hardcoded as requested
    propCertID: 'AA 230049', // Hardcoded as requested
    propCertIssuer: 'Văn phòng đăng ký đất đai', // Default
    propCertIssueDate: '', // Extract from document if available
    propCertOwner: getValue('Tên người sử dụng đất 1') || '',
    propDetailedID: `${getValue('Thửa đất số') || ''} - ${getValue('Tờ bản đồ số') || ''}`,
    propMapID: getValue('Tờ bản đồ số') || '',
    propAddress: getValue('Địa chỉ') || '',
    propArea: getValue('Diện tích') || '',
    propUsageMethod: getValue('Hình thức sử dụng đất') || '',
    propPurpose: Array.isArray(getValue('Loại đất')) 
      ? getValue('Loại đất').join(', ') 
      : getValue('Loại đất') || '',
    propPeriod: typeof getValue('Thời hạn sử dụng đất') === 'object'
      ? JSON.stringify(getValue('Thời hạn sử dụng đất'))
      : getValue('Thời hạn sử dụng đất') || '',
    propOrigin: typeof getValue('Nguồn gốc sử dụng đất') === 'object'
      ? JSON.stringify(getValue('Nguồn gốc sử dụng đất'))
      : getValue('Nguồn gốc sử dụng đất') || '',
    propValue: '', // User input required
  };

  // Extract attached property information
  const attachedProp = getValue('Tên tài sản gắn liền với đất 1');
  if (attachedProp && typeof attachedProp === 'object') {
    property.apropAddress = property.propAddress; // Same as property address
    property.apropConstructArea = attachedProp['Diện tích xây dựng'] || '';
    property.apropFloorArea = attachedProp['Diện tích sàn hoặc công suất'] || '';
    property.apropConstructionMethod = attachedProp['Kết cấu chủ yếu'] || '';
    property.apropLevel = attachedProp['Cấp công trình'] || '';
    property.apropFloor = attachedProp['Số tầng'] || '';
    property.apropYearBuilt = attachedProp['Năm HT xây dựng'] || '';
    property.apropPossessDue = attachedProp['Thời hạn sở hữu'] || '';
    property.apropNote = getValue('Ghi chú') || '';
  }

  return property;
}

/**
 * Build complete contract data from all extracted documents
 * @param {Object} params - Parameters
 * @param {Array} idDocuments - Array of ID card documents
 * @param {Object} legalDocument - Legal Registration document
 * @param {Object} branch - Selected branch
 * @param {Object} contractData - Base contract data
 * @param {number} selectedLenderIndex - Index of selected lender (0 or 1)
 * @returns {Object} Complete contract field mapping
 */
export function buildContractFields({
  idDocuments = [],
  legalDocument = null,
  branch = null,
  contractData = {},
  selectedLenderIndex = 0,
  propValue = ''
}) {
  const contractFields = {
    // Document info
    'doc.number': contractData.contract_number || '',
    'doc.signing_date': new Date().toLocaleDateString('vi-VN'),
    'doc.signing_location.office': branch?.branch_name || '',
    
    // Lender info (from first ID or selected ID)
    'lender.name': '',
    'lender.id.number': '',
    'lender.id.issuer': '',
    'lender.id.issue_date': '',
    'lender.address.original': '',
    
    // Spouse info (from second ID if available)
    'spouse.id.number': '',
    'spouse.id.issuer': '',
    'spouse.id.issue_date': '',
    'spouse.address.original': '',
    
    // Branch info
    'branch.name': branch?.branch_name || '',
    'branch.address': branch?.address || '',
    'branch.bizregcode': branch?.bizregcode || '',
    'branch.bizregissue': branch?.bizregissue || '',
    'branch.bizreg.first.issued.date': branch?.bizreg_first_issued_date || '',
    'branch.phone.number': branch?.phone_number || '',
    'branch.fax': branch?.fax || '',
    'branch.representative.name': branch?.representative_name || '',
    'branch.representative.title': branch?.representative_title || '',
    
    // Property info (from Legal Registration)
    'propID': 'XYZ123',
    'prop.certID': 'AA 230049',
    'prop.cert.issuer': '',
    'prop.cert.issue.date': '',
    'prop.cert.owner': '',
    'prop.detailed.id': '',
    'prop.mapID': '',
    'prop.address': '',
    'prop.area': '',
    'prop.usage.method': '',
    'prop.purpose': '',
    'prop.period': '',
    'prop.origin': '',
    'prop.value': propValue,
    
    // Attached property info
    'aprop.address': '',
    'aprop.construct.area': '',
    'aprop.floor.area': '',
    'aprop.construction.method': '',
    'aprop.level': '',
    'aprop.floor': '',
    'aprop.yearbuilt': '',
    'aprop.possessdue': '',
    'aprop.note': ''
  };

  // Extract lender from selected ID
  if (idDocuments.length > 0 && idDocuments[selectedLenderIndex]) {
    const lenderID = idDocuments[selectedLenderIndex];
    const lenderData = extractLenderFromID(lenderID.ocr_extracted_json?.raw_response || lenderID.ocr_extracted_json);
    if (lenderData) {
      contractFields['lender.name'] = lenderData.name;
      contractFields['lender.id.number'] = lenderData.idNumber;
      contractFields['lender.id.issuer'] = lenderData.idIssuer;
      contractFields['lender.id.issue_date'] = lenderData.idIssueDate;
      contractFields['lender.address.original'] = lenderData.address;
    }
  }

  // Extract spouse from other ID (if available)
  if (idDocuments.length > 1) {
    const spouseIndex = selectedLenderIndex === 0 ? 1 : 0;
    const spouseID = idDocuments[spouseIndex];
    const spouseData = extractSpouseFromID({
      data: [
        idDocuments[selectedLenderIndex]?.ocr_extracted_json?.raw_response?.data?.[0],
        spouseID?.ocr_extracted_json?.raw_response?.data?.[0]
      ]
    });
    if (spouseData) {
      contractFields['spouse.id.number'] = spouseData.idNumber;
      contractFields['spouse.id.issuer'] = spouseData.idIssuer;
      contractFields['spouse.id.issue_date'] = spouseData.idIssueDate;
      contractFields['spouse.address.original'] = spouseData.address;
    }
  }

  // Map Legal Registration to property fields
  if (legalDocument) {
    const propertyData = mapLegalRegistrationToProperty(legalDocument.ocr_extracted_json);
    if (propertyData) {
      Object.assign(contractFields, {
        'prop.cert.issuer': propertyData.propCertIssuer,
        'prop.cert.issue.date': propertyData.propCertIssueDate,
        'prop.cert.owner': propertyData.propCertOwner,
        'prop.detailed.id': propertyData.propDetailedID,
        'prop.mapID': propertyData.propMapID,
        'prop.address': propertyData.propAddress,
        'prop.area': propertyData.propArea,
        'prop.usage.method': propertyData.propUsageMethod,
        'prop.purpose': propertyData.propPurpose,
        'prop.period': propertyData.propPeriod,
        'prop.origin': propertyData.propOrigin,
        'prop.value': propertyData.propValue || propValue,
        'aprop.address': propertyData.apropAddress || '',
        'aprop.construct.area': propertyData.apropConstructArea || '',
        'aprop.floor.area': propertyData.apropFloorArea || '',
        'aprop.construction.method': propertyData.apropConstructionMethod || '',
        'aprop.level': propertyData.apropLevel || '',
        'aprop.floor': propertyData.apropFloor || '',
        'aprop.yearbuilt': propertyData.apropYearBuilt || '',
        'aprop.possessdue': propertyData.apropPossessDue || '',
        'aprop.note': propertyData.apropNote || ''
      });
    }
  }

  return contractFields;
}

