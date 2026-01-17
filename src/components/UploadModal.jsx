import React, { useState } from 'react';
import { uploadFile } from '../services/s3';

export default function UploadModal({ isOpen, onClose, currentPath, onUploadComplete }) {
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        setFiles(Array.from(e.target.files));
        setError(null);
    };

    const handleUpload = async () => {
        if (files.length === 0) return;

        setUploading(true);
        setError(null);
        setProgress({ current: 0, total: files.length });

        const CONCURRENCY_LIMIT = 5;
        let activeUploads = 0;
        let currentIndex = 0;
        let failures = [];

        const uploadNext = async () => {
            if (currentIndex >= files.length) return;

            const fileIndex = currentIndex++;
            const file = files[fileIndex];

            try {
                await uploadFile(file, currentPath);
            } catch (err) {
                console.error(`Failed to upload ${file.name}:`, err);
                failures.push(file.name);
            } finally {
                setProgress(prev => ({ ...prev, current: prev.current + 1 }));
            }

            if (currentIndex < files.length) {
                await uploadNext();
            }
        };

        const promises = [];
        // Start initial batch
        for (let i = 0; i < Math.min(files.length, CONCURRENCY_LIMIT); i++) {
            promises.push(uploadNext());
        }

        try {
            await Promise.all(promises);

            if (failures.length > 0) {
                setError(`Failed to upload ${failures.length} files. Check console.`);
            } else {
                setFiles([]);
                onUploadComplete();
                onClose();
            }
        } catch (err) {
            console.error("Critical upload error:", err);
            setError("Upload process failed.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <h2>Upload Files</h2>
                <p className="mb-4 text-secondary">Uploading to: /{currentPath}</p>

                {error && <div className="p-4 mb-4" style={{ background: '#ef444420', color: '#ef4444', borderRadius: '4px' }}>{error}</div>}

                <div className="mb-4">
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Select Files or Folder:</label>
                    <input
                        type="file"
                        multiple
                        webkitdirectory=""
                        directory=""
                        onChange={handleFileChange}
                        style={{ display: 'block', width: '100%', padding: '0.5rem', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '4px' }}
                    />
                    <p className="text-secondary" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                        Note: To upload a folder, just select it. Recursive upload is supported.
                    </p>
                </div>

                {files.length > 0 && (
                    <p className="mb-4">{files.length} files selected</p>
                )}

                {uploading && (
                    <p className="mb-4">Uploading: {progress.current} / {progress.total}</p>
                )}

                <div className="flex justify-between mt-4">
                    <button onClick={onClose} disabled={uploading}>Cancel</button>
                    <button
                        onClick={handleUpload}
                        disabled={files.length === 0 || uploading}
                        style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
                    >
                        {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                </div>
            </div>
        </div>
    );
}
