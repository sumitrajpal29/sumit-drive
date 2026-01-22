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
            setError(`Some files exceed the 50MB limit. You are not allowed to upload files larger than ${formatBytes(MAX_FILE_SIZE)}.`);
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
        for (let i = 0; i < Math.min(files.length, CONCURRENCY_LIMIT); i++) {
            promises.push(uploadNext());
        }

        try {
            await Promise.all(promises);

            if (isAborted) return;

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
            <div className="modal-content animate-fade-in" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3>Upload Files</h3>
                    <button
                        onClick={handleClose}
                        className="btn btn-ghost"
                        style={{ fontSize: '1.25rem', padding: '0.25rem 0.75rem' }}
                    >
                        ×
                    </button>
                </div>
                <p className="mb-4 text-muted text-sm">Target: /{currentPath || 'root'}</p>

                {error && (
                    <div className="p-4 mb-4 text-sm" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', borderRadius: 'var(--radius-sm)' }}>
                        {error}
                    </div>
                )}

                {!uploading && (
                    <div className="mb-4">
                        <div className="flex gap-4">
                            <div className="w-full">
                                <input
                                    type="file"
                                    id="file-upload"
                                    multiple
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                                <label
                                    htmlFor="file-upload"
                                    className="btn btn-ghost w-full"
                                    style={{ border: '1px dashed var(--color-border)', justifyContent: 'center' }}
                                >
                                    📄 Select Files
                                </label>
                            </div>
                            <div className="w-full">
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
                                    className="btn btn-ghost w-full"
                                    style={{ border: '1px dashed var(--color-border)', justifyContent: 'center' }}
                                >
                                    📁 Select Folder
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                {files.length > 0 && !uploading && (
                    <div className="mb-4 p-3" style={{ background: 'var(--color-bg-main)', borderRadius: 'var(--radius-sm)', maxHeight: '200px', overflowY: 'auto' }}>
                        <div className="flex justify-between mb-2 pb-2 text-sm font-bold" style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <span>{files.length} selected</span>
                            <span>{formatBytes(totalSize)}</span>
                        </div>
                        <div className="flex flex-col gap-2">
                            {files.slice(0, 50).map((file, idx) => {
                                const isOversized = file.size > MAX_FILE_SIZE;
                                return (
                                    <div key={idx} className="flex justify-between text-muted text-xs">
                                        <span style={{ maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isOversized ? 'var(--color-danger)' : 'inherit' }}>
                                            {file.webkitRelativePath || file.name}
                                        </span>
                                        <span>{formatBytes(file.size)}</span>
                                    </div>
                                );
                            })}
                            {files.length > 50 && (
                                <div className="text-muted text-center italic text-xs">
                                    ...and {files.length - 50} more
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {uploading && (
                    <div className="mb-4">
                        <div className="flex justify-between mb-2 text-sm">
                            <span>Uploading...</span>
                            <span>{Math.round((progress.current / progress.total) * 100)}% ({progress.current}/{progress.total})</span>
                        </div>
                        <div className="progress-container">
                            <div
                                className="progress-bar"
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                <div className="flex justify-between mt-4">
                    <button onClick={handleClose} className="btn btn-ghost">
                        {uploading ? 'Cancel' : 'Close'}
                    </button>
                    {!uploading && (
                        <button
                            onClick={handleUpload}
                            disabled={files.length === 0 || isAnyFileOversized}
                            className="btn btn-primary"
                        >
                            Start Upload
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
