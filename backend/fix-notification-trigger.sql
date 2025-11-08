-- Fix the notify_document_review() function to handle null values gracefully
-- This prevents "null value in column message" errors

CREATE OR REPLACE FUNCTION notify_document_review()
RETURNS TRIGGER AS $$
DECLARE
    template_record notification_templates%ROWTYPE;
    contract_record contracts%ROWTYPE;
    target_users INTEGER[];
    target_user INTEGER;
    notification_title VARCHAR(255);
    notification_message TEXT;
    contract_number_text VARCHAR(255);
BEGIN
    -- Only trigger for documents that need manual review
    IF NEW.needs_manual_review = TRUE AND (OLD.needs_manual_review IS NULL OR OLD.needs_manual_review = FALSE) THEN
        -- Get template, but handle if it doesn't exist or has null fields
        SELECT * INTO template_record FROM notification_templates WHERE type = 'DOCUMENT_REVIEW_REQUIRED';
        
        -- If template doesn't exist OR has null/empty message_template, use defaults
        IF template_record.template_id IS NULL OR template_record.message_template IS NULL OR trim(template_record.message_template) = '' THEN
            template_record.type := 'DOCUMENT_REVIEW_REQUIRED';
            template_record.title_template := COALESCE(NULLIF(trim(template_record.title_template), ''), 'Document Review Required');
            template_record.message_template := 'Document {{document_name}} requires manual review due to low confidence score.';
            template_record.default_priority := COALESCE(template_record.default_priority, 'HIGH');
        END IF;
        
        -- Ensure title_template is not null
        IF template_record.title_template IS NULL OR trim(template_record.title_template) = '' THEN
            template_record.title_template := 'Document Review Required';
        END IF;
        
        -- Get contract information if contract_id exists
        IF NEW.contract_id IS NOT NULL THEN
            SELECT * INTO contract_record FROM contracts WHERE contract_id = NEW.contract_id;
            contract_number_text := COALESCE(contract_record.contract_number, 'N/A');
        ELSE
            contract_number_text := 'N/A';
        END IF;
        
        -- Determine target users
        IF NEW.contract_id IS NOT NULL AND contract_record.contract_id IS NOT NULL THEN
            -- Notify the contract creator and managers
            SELECT ARRAY(
                SELECT DISTINCT user_id FROM users 
                WHERE (user_id = contract_record.generated_by OR role IN ('ADMIN', 'MANAGER'))
            ) INTO target_users;
        ELSE
            -- If no contract, just notify managers and admins
            SELECT ARRAY(
                SELECT DISTINCT user_id FROM users 
                WHERE role IN ('ADMIN', 'MANAGER')
            ) INTO target_users;
        END IF;
        
        -- Create notifications only if we have target users
        IF array_length(target_users, 1) > 0 THEN
            FOREACH target_user IN ARRAY target_users
            LOOP
                -- Build notification title with safe replacements
                notification_title := COALESCE(
                    NULLIF(trim(replace(COALESCE(template_record.title_template, 'Document Review Required'), '{{document_name}}', COALESCE(NEW.file_name, 'Unknown Document'))), ''),
                    'Document Review Required'
                );
                
                -- Build notification message with safe replacements
                notification_message := COALESCE(
                    NULLIF(trim(template_record.message_template), ''),
                    'Document {{document_name}} requires manual review due to low confidence score.'
                );
                
                -- Replace placeholders in message
                notification_message := replace(notification_message, '{{document_name}}', COALESCE(NEW.file_name, 'Unknown Document'));
                notification_message := replace(notification_message, '{{contract_number}}', contract_number_text);
                
                -- Final safety check - ensure message is never null or empty
                notification_message := COALESCE(
                    NULLIF(trim(notification_message), ''),
                    'Document ' || COALESCE(NEW.file_name, 'Unknown Document') || ' requires manual review due to low confidence score.'
                );
                
                -- Ensure title is not null
                notification_title := COALESCE(NULLIF(trim(notification_title), ''), 'Document Review Required');
                
                INSERT INTO notifications (
                    user_id,
                    contract_id,
                    type,
                    title,
                    message,
                    priority,
                    metadata
                ) VALUES (
                    target_user,
                    NEW.contract_id,
                    COALESCE(template_record.type, 'DOCUMENT_REVIEW_REQUIRED'),
                    notification_title,
                    notification_message,
                    COALESCE(template_record.default_priority, 'HIGH'),
                    json_build_object('document_id', NEW.document_id, 'confidence_score', COALESCE(NEW.confidence_score, 0))
                );
            END LOOP;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

