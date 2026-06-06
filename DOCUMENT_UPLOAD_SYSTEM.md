# Comprehensive Document Upload System

## Overview
The Member Portal now includes a comprehensive document upload system that allows users to securely upload, organize, and share tax documents with assigned professionals.

## Features

### 1. Document Upload
- **Multi-file Upload**: Upload multiple documents at once
- **File Type Validation**: Supports PDF, JPG, PNG, DOCX
- **Size Limits**: Maximum 10MB per file
- **Categorization**: Organize documents into folders:
  - General
  - W-2 Forms
  - 1099 Forms
  - Receipts
  - Bank Statements

### 2. Document Organization
- **Folder System**: Automatic categorization by document type
- **Search Functionality**: Quick search across all documents
- **Filter by Category**: View documents by specific folder
- **Sorting**: Documents sorted by upload date (newest first)

### 3. Document Sharing
- **Share with Professionals**: Securely share documents with tax professionals
- **Permission Levels**:
  - View: Professional can only view the document
  - Edit: Professional can view and annotate
- **Share Status Tracking**:
  - Private: Not shared with anyone
  - Shared: Sent to professional
  - Viewed: Professional has accessed the document
- **Revoke Access**: Remove professional access at any time

### 4. File Preview
- **PDF Preview**: View PDF documents directly in browser
- **Image Preview**: Display image files (JPG, PNG)
- **Download Option**: Download any document to local device
- **Full-Screen View**: Expand preview to full screen

### 5. Security Features
- **User-Specific Storage**: Documents stored in user-specific folders
- **Authenticated Access**: Only authenticated users can upload/view
- **Secure URLs**: Time-limited signed URLs for document access
- **Access Control**: Share permissions managed per document

## Database Schema

### client_documents Table
```sql
CREATE TABLE client_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  folder TEXT NOT NULL,
  upload_date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### document_shares Table
```sql
CREATE TABLE document_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES client_documents(id) ON DELETE CASCADE,
  professional_id UUID REFERENCES professionals(id),
  shared_by TEXT NOT NULL,
  permission TEXT DEFAULT 'view',
  status TEXT DEFAULT 'pending',
  shared_at TIMESTAMP DEFAULT NOW(),
  viewed_at TIMESTAMP
);
```

## Setup Instructions

### 1. Create Database Tables
Run the SQL commands above in your Supabase SQL Editor.

### 2. Configure Storage Bucket
1. Go to Supabase Dashboard → Storage
2. Create bucket named `tax-documents`
3. Set bucket to private
4. Apply storage rules from FIREBASE_STORAGE_RULES.txt

### 3. Storage Security Rules
```javascript
// Allow authenticated users to upload to their own folder
allow read, write: if request.auth != null 
  && request.path.startsWith('/' + request.auth.uid + '/');

// Allow professionals to read shared documents
allow read: if request.auth != null 
  && exists(/databases/$(database)/documents/document_shares/$(documentId))
  && get(/databases/$(database)/documents/document_shares/$(documentId)).data.professional_id == request.auth.uid;
```

## Usage Guide

### For Clients

#### Uploading Documents
1. Navigate to Member Portal → Tax Docs tab
2. Click "Upload" tab
3. Select document category
4. Click upload area or drag files
5. Review selected files
6. Click "Upload Documents"

#### Organizing Documents
1. Use folder filters to view specific categories
2. Use search bar to find documents by name
3. Click folder buttons to filter by category

#### Sharing with Professionals
1. Find document in "My Documents" tab
2. Click Share icon
3. Select professional from dropdown
4. Choose permission level (View/Edit)
5. Click "Share" button
6. View share status in document list

#### Viewing Documents
1. Click Eye icon on any document
2. Preview opens in modal
3. Use Download button to save locally
4. Close preview when done

### For Professionals

#### Accessing Shared Documents
1. Navigate to Member Portal → Tax Docs tab
2. Click "Shared with Me" tab
3. View all documents shared by clients
4. Click to preview or download

## File Storage Structure
```
tax-documents/
├── {user_id}/
│   ├── general/
│   │   └── {timestamp}_{filename}
│   ├── w2/
│   │   └── {timestamp}_{filename}
│   ├── 1099/
│   │   └── {timestamp}_{filename}
│   ├── receipts/
│   │   └── {timestamp}_{filename}
│   └── statements/
│       └── {timestamp}_{filename}
```

## API Integration

### Upload Document
```typescript
const { error } = await supabase.storage
  .from('tax-documents')
  .upload(path, file);

await supabase.from('client_documents').insert({
  client_id: user.uid,
  file_name: file.name,
  file_type: file.type,
  file_size: file.size,
  storage_path: path,
  folder: category
});
```

### Share Document
```typescript
await supabase.from('document_shares').insert({
  document_id: documentId,
  professional_id: professionalId,
  shared_by: userId,
  permission: 'view',
  status: 'pending'
});
```

### Get Signed URL
```typescript
const { data } = await supabase.storage
  .from('tax-documents')
  .createSignedUrl(storagePath, 3600);
```

## Troubleshooting

### Upload Fails
- Check file size (must be under 10MB)
- Verify file type is supported
- Ensure Firebase Storage is configured
- Check user authentication status

### Cannot View Document
- Verify document was uploaded successfully
- Check storage bucket permissions
- Ensure signed URL hasn't expired
- Verify user has access rights

### Share Not Working
- Confirm professional exists in database
- Check document_shares table permissions
- Verify professional_id is correct
- Ensure user is authenticated

## Future Enhancements
- Bulk upload functionality
- Document versioning
- Annotation tools
- OCR text extraction
- Automatic document classification
- Email notifications for shares
- Document expiration dates
- Audit trail logging
