import React, { useState } from 'react';
import { uploadFile } from '../services/s3';

export default function UploadModal({ isOpen, onClose, currentPath, onUploadComplete }) {
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setError(null);
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setError(null);

        try {
            await uploadFile(file, currentPath);
            setUploading(false);
            setFile(null);
            onUploadComplete();
            onClose();
        } catch (err) {
            console.error(err);
            setError("Failed to upload file. Please check console for details.");
            setUploading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>Upload File</h2>
                <p className="mb-4 text-secondary">Uploading to: /{currentPath}</p>

                {error && <div className="p-4 mb-4" style={{ background: '#ef444420', color: '#ef4444', borderRadius: '4px' }}>{error}</div>}

                <input
                    type="file"
                    onChange={handleFileChange}
                    className="mb-4"
                    style={{ display: 'block', width: '100%', padding: '0.5rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                />

                <div className="flex justify-between mt-4">
                    <button onClick={onClose} disabled={uploading}>Cancel</button>
                    <button
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
                    >
                        {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                </div>
            </div>
        </div>
    );
}
