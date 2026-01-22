import React from 'react';
import { formatBytes } from '../utils/format';

export default function FileExplorer({ files, folders, onNavigate, selectedKeys, onToggleSelect }) {
    const isEmpty = files.length === 0 && folders.length === 0;

    if (isEmpty) {
        return (
            <div className="flex justify-center items-center p-4" style={{ height: '300px', border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-lg)' }}>
                <div className="text-center">
                    <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>📂</div>
                    <h3 className="text-muted">Empty Directory</h3>
                    <p className="text-xs text-muted">Upload a file to get started</p>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="file-grid">
                {/* Folders */}
                {folders.map(folder => (
                    <div
                        key={folder.prefix}
                        className="file-card"
                        onClick={() => onNavigate(folder.name)}
                    >
                        <div className="file-icon">📁</div>
                        <div className="file-name">{folder.name}</div>
                        <div className="file-meta">Folder</div>
                    </div>
                ))}

                {/* Files */}
                {files.map(file => {
                    const isSelected = selectedKeys?.has(file.key);
                    return (
                        <div
                            key={file.key}
                            className={`file-card ${isSelected ? 'selected' : ''}`}
                            onClick={() => window.open(file.url, '_blank')}
                        >
                            <div
                                className="checkbox-overlay"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSelect(file.key);
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={!!isSelected}
                                    onChange={() => { }} // handled by div click
                                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--color-primary)' }}
                                />
                            </div>

                            <div className="file-icon">📄</div>

                            {/* Wrapper for info to help with mobile flex layout */}
                            <div className="file-info">
                                <div className="file-name">{file.name}</div>
                                <div className="file-meta">
                                    {formatBytes(file.size)}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
