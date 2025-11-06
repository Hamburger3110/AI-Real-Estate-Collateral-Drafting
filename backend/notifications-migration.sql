-- Migration: Create notifications table
-- This should be run as a new migration file

CREATE TABLE IF NOT EXISTS notifications (
    notification_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    contract_id INTEGER REFERENCES contracts(contract_id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'MEDIUM',
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(user_id),
    metadata JSONB DEFAULT '{}'
);

-- Create notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
    preference_id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    email_enabled BOOLEAN DEFAULT TRUE,
    browser_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one preference per user per type
    UNIQUE(user_id, notification_type)
);

-- Create indexes for notifications table performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_contract_id ON notifications (contract_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications (read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications (type);

-- Create notification templates table for consistent messaging
CREATE TABLE IF NOT EXISTS notification_templates (
    template_id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL UNIQUE,
    title_template VARCHAR(255) NOT NULL,
    message_template TEXT NOT NULL,
    default_priority VARCHAR(20) DEFAULT 'MEDIUM',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default notification templates
INSERT INTO notification_templates (type, title_template, message_template, default_priority) VALUES
('CONTRACT_CREATED', 'New Contract Created', 'Contract {{contract_number}} has been created by {{creator_name}} and requires your attention.', 'MEDIUM'),
('CONTRACT_APPROVED', 'Contract Approved', 'Contract {{contract_number}} has been approved at the {{stage}} stage by {{approver_name}}.', 'MEDIUM'),
('CONTRACT_REJECTED', 'Contract Rejected', 'Contract {{contract_number}} has been rejected at the {{stage}} stage by {{approver_name}}. Reason: {{reason}}', 'HIGH'),
('DOCUMENT_REVIEW_REQUIRED', 'Document Review Required', 'Document {{document_name}} in contract {{contract_number}} requires manual review due to low confidence score.', 'HIGH'),
('APPROVAL_PENDING', 'Approval Pending', 'Contract {{contract_number}} is pending your approval at the {{stage}} stage.', 'MEDIUM'),
('WORKFLOW_COMPLETED', 'Workflow Completed', 'Contract {{contract_number}} has completed the approval workflow and is now {{final_status}}.', 'MEDIUM'),
('SYSTEM_ALERT', 'System Alert', '{{message}}', 'LOW');

-- Create function to automatically create notifications for contract events
CREATE OR REPLACE FUNCTION notify_contract_event()
RETURNS TRIGGER AS $$
DECLARE
    template_record notification_templates%ROWTYPE;
    target_users INTEGER[];
    target_user INTEGER;
    notification_title VARCHAR(255);
    notification_message TEXT;
BEGIN
    -- Determine notification type based on the change
    IF TG_OP = 'INSERT' THEN
        -- New contract created
        SELECT * INTO template_record FROM notification_templates WHERE type = 'CONTRACT_CREATED';
        
        -- Notify managers and admins
        SELECT ARRAY(
            SELECT user_id FROM users 
            WHERE role IN ('ADMIN', 'MANAGER') 
            AND user_id != NEW.generated_by
        ) INTO target_users;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Contract status or stage changed
        IF OLD.status != NEW.status OR OLD.current_approval_stage != NEW.current_approval_stage THEN
            
            IF NEW.status = 'approved' THEN
                SELECT * INTO template_record FROM notification_templates WHERE type = 'CONTRACT_APPROVED';
            ELSIF NEW.status = 'rejected' THEN
                SELECT * INTO template_record FROM notification_templates WHERE type = 'CONTRACT_REJECTED';
            ELSE
                -- Stage progression - notify next approver
                SELECT * INTO template_record FROM notification_templates WHERE type = 'APPROVAL_PENDING';
            END IF;
            
            -- Determine target users based on approval stage
            CASE NEW.current_approval_stage
                WHEN 'credit_analysis' THEN
                    SELECT ARRAY(SELECT user_id FROM users WHERE role = 'CREDIT_OFFICER') INTO target_users;
                WHEN 'legal_review' THEN
                    SELECT ARRAY(SELECT user_id FROM users WHERE role = 'LEGAL_OFFICER') INTO target_users;
                WHEN 'risk_assessment', 'final_approval' THEN
                    SELECT ARRAY(SELECT user_id FROM users WHERE role IN ('MANAGER', 'ADMIN')) INTO target_users;
                ELSE
                    -- Default to managers for unknown stages
                    SELECT ARRAY(SELECT user_id FROM users WHERE role IN ('MANAGER', 'ADMIN')) INTO target_users;
            END CASE;
        END IF;
    END IF;
    
    -- Create notifications for target users
    IF template_record.template_id IS NOT NULL AND array_length(target_users, 1) > 0 THEN
        FOREACH target_user IN ARRAY target_users
        LOOP
            -- Simple template replacement (can be enhanced with proper templating)
            notification_title := replace(template_record.title_template, '{{contract_number}}', NEW.contract_number);
            notification_message := replace(template_record.message_template, '{{contract_number}}', NEW.contract_number);
            notification_message := replace(notification_message, '{{stage}}', NEW.current_approval_stage);
            
            INSERT INTO notifications (
                user_id, 
                contract_id, 
                type, 
                title, 
                message, 
                priority,
                created_by
            ) VALUES (
                target_user,
                NEW.contract_id,
                template_record.type,
                notification_title,
                notification_message,
                template_record.default_priority,
                COALESCE(NEW.approved_by, NEW.generated_by)
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic notifications
DROP TRIGGER IF EXISTS contract_notification_trigger ON contracts;
CREATE TRIGGER contract_notification_trigger
    AFTER INSERT OR UPDATE ON contracts
    FOR EACH ROW
    EXECUTE FUNCTION notify_contract_event();

-- Create function for document review notifications
CREATE OR REPLACE FUNCTION notify_document_review()
RETURNS TRIGGER AS $$
DECLARE
    template_record notification_templates%ROWTYPE;
    contract_record contracts%ROWTYPE;
    target_users INTEGER[];
    target_user INTEGER;
BEGIN
    -- Only trigger for documents that need manual review
    IF NEW.needs_manual_review = TRUE AND (OLD.needs_manual_review IS NULL OR OLD.needs_manual_review = FALSE) THEN
        SELECT * INTO template_record FROM notification_templates WHERE type = 'DOCUMENT_REVIEW_REQUIRED';
        
        -- Get contract information
        SELECT * INTO contract_record FROM contracts WHERE contract_id = NEW.contract_id;
        
        -- Notify the contract creator and managers
        SELECT ARRAY(
            SELECT DISTINCT user_id FROM users 
            WHERE (user_id = contract_record.generated_by OR role IN ('ADMIN', 'MANAGER'))
        ) INTO target_users;
        
        -- Create notifications
        FOREACH target_user IN ARRAY target_users
        LOOP
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
                template_record.type,
                replace(template_record.title_template, '{{document_name}}', NEW.file_name),
                replace(replace(template_record.message_template, '{{document_name}}', NEW.file_name), '{{contract_number}}', contract_record.contract_number),
                template_record.default_priority,
                json_build_object('document_id', NEW.document_id, 'confidence_score', NEW.confidence_score)
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for document review notifications
DROP TRIGGER IF EXISTS document_review_notification_trigger ON documents;
CREATE TRIGGER document_review_notification_trigger
    AFTER INSERT OR UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION notify_document_review();