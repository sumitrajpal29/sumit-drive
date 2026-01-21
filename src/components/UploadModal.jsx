import React, { useState, useMemo } from 'react';
import { uploadFile } from '../services/s3';
import { formatBytes } from '../utils/format';

export default function UploadModal({ isOpen, onClose, currentPath, onUploadComplete }) {
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [error, setError] = useState(null);

    const totalSize = useMemo(() => {
        return files.reduce((acc, file) => acc + file.size, 0);
    }, [files]);

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
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>Select Content:</label>
                    <div className="flex gap-4">
                        <div style={{ flex: 1 }}>
                            <input
                                type="file"
                                id="file-upload"
                                multiple
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />
                            <label
                                htmlFor="file-upload"
                                className="button"
                                style={{
                                    display: 'block',
                                    textAlign: 'center',
                                    padding: '0.5rem',
                                    background: 'var(--color-bg)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Select Files
                            </label>
                        </div>
                        <div style={{ flex: 1 }}>
                            <input
                                type="file"
                                id="folder-upload"
                                multiple
                                webkitdirectory=""
                                directory=""
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                            />
                            <label
                                htmlFor="folder-upload"
                                className="button"
                                style={{
                                    display: 'block',
                                    textAlign: 'center',
                                    padding: '0.5rem',
                                    background: 'var(--color-bg)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Select Folder
                            </label>
                        </div>
                    </div>
                    <p className="text-secondary" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                        Supports multiple files or recursive folder uploads.
                    </p>
                </div>

                {files.length > 0 && (
                    <div className="mb-4 p-3" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                        <div className="flex justify-between mb-2 pb-2" style={{ borderBottom: '1px solid var(--color-border)', fontWeight: 'bold' }}>
                            <span>{files.length} {files.length === 1 ? 'file' : 'files'} selected</span>
                            <span>Total: {formatBytes(totalSize)}</span>
                        </div>
                        <div className="flex flex-col gap-1" style={{ gap: '0.25rem' }}>
                            {files.slice(0, 50).map((file, idx) => (
                                <div key={idx} className="flex justify-between text-secondary" style={{ fontSize: '0.85rem' }}>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                                        {file.webkitRelativePath || file.name}
                                    </span>
                                    <span>{formatBytes(file.size)}</span>
                                </div>
                            ))}
                            {files.length > 50 && (
                                <div className="text-secondary text-center italic" style={{ fontSize: '0.8rem' }}>
                                    ...and {files.length - 50} more files
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {uploading && (
                    <div className="mb-4">
                        <div className="flex justify-between mb-1">
                            <span>Uploading...</span>
                            <span>{progress.current} / {progress.total}</span>
                        </div>
                        <div style={{ background: 'var(--color-border)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                            <div
                                style={{
                                    background: 'var(--color-primary)',
                                    height: '100%',
                                    width: `${(progress.current / progress.total) * 100}%`,
                                    transition: 'width 0.3s ease'
                                }}
                            />
                        </div>
                    </div>
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
