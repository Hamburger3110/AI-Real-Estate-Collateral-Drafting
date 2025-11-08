/**
 * Field Display Order Configuration
 * 
 * Define the order in which fields should be displayed for each document type.
 * Fields not in this list will appear at the end in their original order.
 */

export const FIELD_ORDER = {
  'Legal Registration': [
    'Tên người sử dụng đất 1',
    'Tên người sử dụng đất 2',
    'Thửa đất số',
    'Tờ bản đồ số',
    'Diện tích',
    'Loại đất',
    'Thời hạn sử dụng đất',
    'Hình thức sử dụng đất',
    'Nguồn gốc sử dụng đất',
    'Địa chỉ',
    'Tên tài sản gắn liền với đất 1',
    'Tên tài sản gắn liền với đất 2',
    'Ghi chú'
  ],
  'ID Card': [
    'Full Name',
    'ID Number',
    'Date of Birth',
    'Gender',
    'Nationality',
    'Place of Origin',
    'Address',
    'Date of Expiry'
  ],
  'Passport': [
    'Full Name',
    'Passport Number',
    'Date of Birth',
    'Gender',
    'Nationality',
    'Place of Birth',
    'Date of Issue',
    'Date of Expiry'
  ],
  'Business Registration': [
    // Add field order for Business Registration if needed
  ],
  'Financial Statement': [
    // Add field order for Financial Statement if needed
  ]
};

/**
 * Sort fields according to the configured order
 * @param {Array} entries - Array of [key, value] pairs from Object.entries()
 * @param {String} documentType - Type of document (e.g., 'Legal Registration')
 * @returns {Array} - Sorted array of [key, value] pairs
 */
export function sortFieldsByOrder(entries, documentType = 'Legal Registration') {
  const order = FIELD_ORDER[documentType] || [];
  
  if (order.length === 0) {
    // No order defined, return original order
    return entries;
  }
  
  // Create a map for quick lookup
  const orderMap = new Map();
  order.forEach((field, index) => {
    orderMap.set(field, index);
  });
  
  // Separate fields into ordered and unordered
  const ordered = [];
  const unordered = [];
  
  entries.forEach(([key, value]) => {
    const index = orderMap.get(key);
    if (index !== undefined) {
      ordered.push({ key, value, index });
    } else {
      unordered.push([key, value]);
    }
  });
  
  // Sort ordered fields by their index
  ordered.sort((a, b) => a.index - b.index);
  
  // Combine: ordered fields first, then unordered fields
  return [
    ...ordered.map(({ key, value }) => [key, value]),
    ...unordered
  ];
}

