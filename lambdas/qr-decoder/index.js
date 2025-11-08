// Simple parser that takes decodedText and maps to fields
// Input: { decodedText: string }
exports.handler = async (event) => {
  const decodedText = event.decodedText || (event.body && event.body.decodedText);
  if (!decodedText) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing decodedText' }) };
  }

  // TODO: Adjust parsing rules to match QR payload format from legal docs
  // Placeholder parsing: split by newlines and try to map known labels
  const lines = decodedText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const fields = {};
  for (const line of lines) {
    const [k, v] = line.split(/:\s*/);
    if (k && v) {
      fields[k] = { value: v, confidence: 0.95 };
    }
  }

  return { statusCode: 200, body: JSON.stringify({ fields, overall_confidence: 0.95, source: 'qr' }) };
};


