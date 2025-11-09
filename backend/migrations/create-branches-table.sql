-- Migration: Create branches table
-- This table stores bank branch information

CREATE TABLE IF NOT EXISTS branches (
    branch_id SERIAL PRIMARY KEY,
    branch_name VARCHAR(255) NOT NULL UNIQUE,
    branch_location VARCHAR(255) NOT NULL,
    address TEXT,
    bizregcode VARCHAR(50),
    bizregissue VARCHAR(255),
    bizreg_first_issued_date VARCHAR(50),
    phone_number VARCHAR(50),
    fax VARCHAR(50),
    representative_name VARCHAR(255),
    representative_title VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_branches_name ON branches(branch_name);
CREATE INDEX IF NOT EXISTS idx_branches_location ON branches(branch_location);

-- Insert default branches (hardcoded values)
INSERT INTO branches (branch_name, branch_location, address, bizregcode, bizregissue, bizreg_first_issued_date, phone_number, fax, representative_name, representative_title) VALUES
('NGÂN HÀNG TMCP VIỆT NAM THỊNH VƯỢNG - Chi Nhánh Hà Nội', 'Ba Đình', 'Tòa nhà 5 Điện Biên Phủ, Phường Điện Biên, Quận Ba Đình, Hà Nội, Việt Nam', '0100233583-040', 'Sở KHĐT TP Hà Nội', '2010-08-10', '024-38222838', '024-39424182', 'Trịnh Viết Thuân', 'Branch Director'),
('NGÂN HÀNG TMCP VIỆT NAM THỊNH VƯỢNG - Chi Nhánh Sở Giao Dịch', 'Hoàn Kiếm', '34 Phố Hai Bà Trưng, Phường Tràng Tiền, Quận Hoàn Kiếm, Hà Nội, Việt Nam', '0100233583-051', 'Sở KHĐT TP Hà Nội', '2010-12-20', '024-32669363', NULL, 'Nguyễn Đăng Hải', 'Branch Director')
ON CONFLICT (branch_name) DO NOTHING;

