# Implementation Notes

## Manual Review UI Layout (For Future Steps)

When implementing the manual review/validation screen for low-confidence documents (confidence < 95%):

### Layout:
```
┌─────────────────────────────────────────────────────────┐
│  Contract Details - Manual Review Required              │
├──────────────────────┬──────────────────────────────────┤
│                      │                                  │
│   LEFT SIDE:         │   RIGHT SIDE:                    │
│   Document Preview   │   Extracted Fields (Editable)    │
│   (Image/PDF Viewer) │                                  │
│                      │   Field Name:    [Value] ✏️      │
│   [Document Image]   │   DOB:          [01/01/1990] ✏️  │
│                      │   ID Number:    [123456] ⚠️       │
│                      │   Address:      [Sample St] ✏️    │
│                      │                                  │
│                      │   Confidence: 92% ⚠️              │
│                      │                                  │
│                      │   [Save Corrections] Button      │
└──────────────────────┴──────────────────────────────────┘
```

### Key Points:
- **LEFT**: Document image/PDF preview (for reference)
- **RIGHT**: Editable form with extracted fields
- Show confidence scores per field
- Highlight low-confidence fields with warning icons
- Allow credit officer to correct values while viewing document

## Step 3 Completed

### What was implemented:
1. ✅ Modified `/upload` endpoint in `backend/index.js`
2. ✅ Integrated document-processor service
3. ✅ FPT.AI documents (ID Card, Passport):
   - Process immediately (synchronous)
   - Return extracted data with confidence score
   - Set `needs_manual_review` flag if < 95%
   - Status: "Extracted"
4. ✅ Bedrock documents (Legal/Business/Financial):
   - Upload to S3 with contract-specific path
   - Return immediately with "Processing" status
   - Lambda will be triggered by S3 event
   - Status: "Processing"
5. ✅ S3 path structure: `documents/{contractId}/{timestamp}_{filename}`
6. ✅ Error handling for both processing paths

### Response Format:

**FPT.AI (Immediate):**
```json
{
  "success": true,
  "message": "File uploaded and extracted successfully",
  "data": {
    "document_id": 123,
    "status": "Extracted",
    "confidence_score": 97.5,
    "needs_manual_review": false,
    "extracted_data": { "name": "John Doe", ... }
  }
}
```

**Bedrock (Async):**
```json
{
  "success": true,
  "message": "File uploaded successfully. OCR processing in progress.",
  "data": {
    "document_id": 124,
    "status": "Processing",
    "processing_method": "Lambda/Bedrock",
    "message": "Document is being processed. You will be notified when complete."
  }
}
```

## Step 5 Completed ✅

### What was implemented:
1. ✅ Custom polling hook (`useDocumentPolling.js`)
2. ✅ Automatic polling every 5 seconds for "Processing" documents
3. ✅ Browser notifications when extraction completes
4. ✅ Auto-stop polling when user leaves or all complete
5. ✅ Status badges: Processing (blue), Extracted (green), Needs Review (orange)
6. ✅ Toast notifications with confidence scores

### User Experience:
- FPT.AI: Immediate results (~1-2 sec)
- Bedrock: Background processing with notifications
- Real-time status updates

## Step 6 Completed ✅

### What was implemented:
1. ✅ Created `DocumentReviewPanel` component
2. ✅ Split-view layout: Document preview LEFT, Editable fields RIGHT
3. ✅ Overall confidence score displayed at top
4. ✅ Warning alert for documents needing review (<95%)
5. ✅ Success alert for high-confidence documents (≥95%)
6. ✅ Editable form with all extracted fields
7. ✅ Save corrections via `/fptai/validate-extraction/:id`
8. ✅ "Review" button appears for low-confidence documents
9. ✅ 1200px wide modal for comfortable viewing
10. ✅ Support for both PDF and image document preview

### Layout Specifications:
- **LEFT (50%)**: Document preview (PDF iframe or image)
- **RIGHT (50%)**: Editable form with extracted fields
- **Top**: Confidence score badge (warning if <95%, success if ≥95%)
- **Bottom**: Cancel and Save buttons

### Features:
- Low-confidence fields highlighted with warning icon
- Form fields auto-populated with extracted data
- Handles both object format `{value: "...", confidence: 0.95}` and simple strings
- Updates database when corrections saved
- Refreshes contract details after save
- Clean, modern Ant Design interface

## Next Steps

### Step 4: Create Lambda Function for Bedrock (When Ready to Deploy)
- Python handler for S3 events
- Bedrock (Mistral) integration
- Confidence score calculation
- Webhook callback to Express
- Environment setup for Lambda

