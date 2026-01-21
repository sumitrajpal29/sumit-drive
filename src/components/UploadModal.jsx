import React, { useState, useMemo, useRef } from 'react';
import { uploadFile } from '../services/s3';
import { formatBytes } from '../utils/format';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export default function UploadModal({ isOpen, onClose, currentPath, onUploadComplete }) {
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [error, setError] = useState(null);
    const abortControllerRef = useRef(null);

    const totalSize = useMemo(() => {
        return files.reduce((acc, file) => acc + file.size, 0);
    }, [files]);

    const isAnyFileOversized = useMemo(() => {
        return files.some(file => file.size > MAX_FILE_SIZE);
    }, [files]);

    if (!isOpen) return null;

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        const oversizedFiles = selectedFiles.filter(file => file.size > MAX_FILE_SIZE);

        if (oversizedFiles.length > 0) {
            setError(`Some files exceed the 50MB limit. You are not allowed to upload files larger than ${formatBytes(MAX_FILE_SIZE)}. Please contact developer for support.`);
        } else {
            setError(null);
        }

        setFiles(selectedFiles);
    };

    const handleClose = () => {
        if (uploading) {
            handleCancel();
        }
        setFiles([]);
        setError(null);
        setProgress({ current: 0, total: 0 });
        onClose();
    };

    const handleCancel = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setUploading(false);
        // We don't clear files immediately here if they just want to stop the upload but maybe retry or change selection,
        // but the requirement says "upload data should clear from the upload form".
        setFiles([]);
        setProgress({ current: 0, total: 0 });
    };

    const handleUpload = async () => {
        if (files.length === 0) return;

        setUploading(true);
        setError(null);
        setProgress({ current: 0, total: files.length });

        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;

        const CONCURRENCY_LIMIT = 5;
        let currentIndex = 0;
        let failures = [];
        let isAborted = false;

        const uploadNext = async () => {
            if (currentIndex >= files.length || isAborted) return;

            const fileIndex = currentIndex++;
            const file = files[fileIndex];

            try {
                await uploadFile(file, currentPath, signal);
                if (!isAborted) {
                    setProgress(prev => ({ ...prev, current: prev.current + 1 }));
                }
            } catch (err) {
                if (err.name === 'AbortError') {
                    isAborted = true;
                    return;
                }
                console.error(`Failed to upload ${file.name}:`, err);
                failures.push(file.name);
                if (!isAborted) {
                    setProgress(prev => ({ ...prev, current: prev.current + 1 }));
                }
            }

            if (currentIndex < files.length && !isAborted) {
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

            if (isAborted) {
                // Already handled in handleCancel
                return;
            }

            if (failures.length > 0) {
                setError(`Failed to upload ${failures.length} files. Check console.`);
            } else {
                setFiles([]);
                onUploadComplete();
                onClose();
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error("Critical upload error:", err);
                setError("Upload process failed.");
            }
        } finally {
            if (!isAborted) {
                setUploading(false);
                abortControllerRef.current = null;
            }
        }
    };

    return (
        <div className="modal-overlay" onClick={handleClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h2>Upload Files</h2>
                    <button
                        onClick={handleClose}
                        style={{ background: 'none', border: 'none', fontSize: '1.5rem', padding: '0 0.5rem' }}
                    >
                        ×
                    </button>
                </div>
                <p className="mb-4 text-secondary">Uploading to: /{currentPath}</p>

                {error && <div className="p-4 mb-4" style={{ background: '#ef444420', color: '#ef4444', borderRadius: '4px' }}>{error}</div>}

                {!uploading && (
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
                )}

                {files.length > 0 && !uploading && (
                    <div className="mb-4 p-3" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                        <div className="flex justify-between mb-2 pb-2" style={{ borderBottom: '1px solid var(--color-border)', fontWeight: 'bold' }}>
                            <span>{files.length} {files.length === 1 ? 'file' : 'files'} selected</span>
                            <span>Total: {formatBytes(totalSize)}</span>
                        </div>
                        <div className="flex flex-col gap-1" style={{ gap: '0.25rem' }}>
                            {files.slice(0, 50).map((file, idx) => {
                                const isOversized = file.size > MAX_FILE_SIZE;
                                return (
                                    <div key={idx} className="flex justify-between text-secondary" style={{ fontSize: '0.85rem', color: isOversized ? 'var(--color-danger)' : 'inherit' }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                                            {file.webkitRelativePath || file.name}
                                            {isOversized && " (Exceeds limit)"}
                                        </span>
                                        <span>{formatBytes(file.size)}</span>
                                    </div>
                                );
                            })}
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
                            <span>Uploading {progress.total} files...</span>
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
                    <button onClick={handleClose}>
                        {uploading ? 'Stop Upload' : 'Cancel'}
                    </button>
                    {!uploading && (
                        <button
                            onClick={handleUpload}
                            disabled={files.length === 0 || isAnyFileOversized}
                            style={{
                                backgroundColor: isAnyFileOversized ? 'var(--color-border)' : 'var(--color-primary)',
                                borderColor: isAnyFileOversized ? 'var(--color-border)' : 'var(--color-primary)',
                                cursor: isAnyFileOversized ? 'not-allowed' : 'pointer'
                            }}
                        >
                            Upload {files.length > 0 ? `(${formatBytes(totalSize)})` : ''}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
