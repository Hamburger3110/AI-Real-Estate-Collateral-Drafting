import json
import os
import boto3
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client('s3')
lambda_client = boto3.client('lambda')

def process_legal_document(bucket, key):
    """
    Process Legal Registration documents through QR-first pipeline
    Returns True if processed, False if not a legal document
    """
    try:
        # Check document type from S3 metadata
        head = s3.head_object(Bucket=bucket, Key=key)
        doc_type = head.get('Metadata', {}).get('document-type', '').lower()
        
        if doc_type != 'legal registration':
            return False
        
        logger.info(f'Processing Legal Registration document: {bucket}/{key}')
        
        # Step 1: Check for QR code
        qr_response = lambda_client.invoke(
            FunctionName=os.environ['QR_DETECTOR_FN_ARN'],
            InvocationType='RequestResponse',
            Payload=json.dumps({'bucket': bucket, 'key': key})
        )
        
        qr_payload = json.loads(qr_response['Payload'].read())
        qr_result = json.loads(qr_payload.get('body', '{}')) if isinstance(qr_payload.get('body'), str) else qr_payload
        
        if qr_result.get('hasQR') and qr_result.get('decodedText'):
            # QR path: Decode QR and save
            logger.info('QR code detected, decoding...')
            decode_response = lambda_client.invoke(
                FunctionName=os.environ['QR_DECODER_FN_ARN'],
                InvocationType='RequestResponse',
                Payload=json.dumps({'decodedText': qr_result['decodedText']})
            )
            
            decode_payload = json.loads(decode_response['Payload'].read())
            decoded_result = json.loads(decode_payload.get('body', '{}')) if isinstance(decode_payload.get('body'), str) else decode_payload
            
            # Save results (async)
            lambda_client.invoke(
                FunctionName=os.environ['RESULT_SAVER_FN_ARN'],
                InvocationType='Event',
                Payload=json.dumps({
                    'bucket': bucket,
                    'key': key,
                    'result': decoded_result
                })
            )
            
            logger.info('QR path completed successfully')
            return True
        
        # No QR: Use VietOCR + Bedrock QA
        logger.info('No QR code detected, using VietOCR...')
        ocr_response = lambda_client.invoke(
            FunctionName=os.environ['VIETOCR_FN_ARN'],
            InvocationType='RequestResponse',
            Payload=json.dumps({'bucket': bucket, 'key': key})
        )
        
        ocr_payload = json.loads(ocr_response['Payload'].read())
        ocr_result = json.loads(ocr_payload.get('body', '{}')) if isinstance(ocr_payload.get('body'), str) else ocr_payload
        
        if not ocr_result.get('text'):
            raise Exception('VietOCR returned no text')
        
        # QA with Bedrock
        logger.info('Sending extracted text to Bedrock QA...')
        qa_response = lambda_client.invoke(
            FunctionName=os.environ['BEDROCK_QA_FN_ARN'],
            InvocationType='RequestResponse',
            Payload=json.dumps({'text': ocr_result['text']})
        )
        
        qa_payload = json.loads(qa_response['Payload'].read())
        qa_result = json.loads(qa_payload.get('body', '{}')) if isinstance(qa_payload.get('body'), str) else qa_payload
        
        # Save results (async)
        lambda_client.invoke(
            FunctionName=os.environ['RESULT_SAVER_FN_ARN'],
            InvocationType='Event',
            Payload=json.dumps({
                'bucket': bucket,
                'key': key,
                'result': qa_result
            })
        )
        
        logger.info('VietOCR + Bedrock QA path completed successfully')
        return True
        
    except Exception as e:
        logger.error(f'Error processing legal document: {str(e)}', exc_info=True)
        raise


def process_with_existing_bedrock(bucket, key):
    """
    Process non-legal documents with existing Bedrock flow
    TODO: Replace with your actual Bedrock processing logic
    """
    logger.info(f'Processing with existing Bedrock flow: {bucket}/{key}')
    
    # TODO: Add your existing Bedrock processing code here
    # For example:
    # - Call Bedrock directly
    # - Or invoke another Lambda
    # - Save results to database
    
    logger.info('Existing Bedrock flow completed')
    return True


def lambda_handler(event, context):
    """
    Main handler for trigger-upload Lambda
    Processes SQS messages containing S3 events
    """
    try:
        logger.info(f'Received event: {json.dumps(event)}')
        
        # Process each SQS record
        for record in event.get('Records', []):
            # Parse SQS message body (contains S3 event)
            if 'body' in record:
                s3_event = json.loads(record['body'])
            else:
                s3_event = record
            
            # Extract S3 details
            s3_records = s3_event.get('Records', [])
            if not s3_records:
                logger.warning('No S3 records found in event')
                continue
            
            for s3_record in s3_records:
                bucket = s3_record['s3']['bucket']['name']
                key = s3_record['s3']['object']['key']
                # Decode URL-encoded key
                key = key.replace('+', ' ')
                try:
                    import urllib.parse
                    key = urllib.parse.unquote(key)
                except:
                    pass
                
                logger.info(f'Processing document: s3://{bucket}/{key}')
                
                # Step 1: Try legal registration pipeline first
                processed_as_legal = process_legal_document(bucket, key)
                
                if processed_as_legal:
                    logger.info('Document processed as Legal Registration')
                    continue
                
                # Step 2: Not a legal doc, use existing Bedrock flow
                logger.info('Document is not Legal Registration, using existing Bedrock flow')
                process_with_existing_bedrock(bucket, key)
        
        return {
            'statusCode': 200,
            'body': json.dumps('Processing completed')
        }
        
    except Exception as e:
        logger.error(f'Error in lambda_handler: {str(e)}', exc_info=True)
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error: {str(e)}')
        }

