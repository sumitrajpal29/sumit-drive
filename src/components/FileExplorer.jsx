import React from 'react';

export default function FileExplorer({ files, folders, onNavigate, currentPath, selectedKeys, onToggleSelect }) {
    return (
        <div>
            <h3 className="mb-4">
                {files.length === 0 && folders.length === 0 ? "Empty Directory" : "Contents"}
            </h3>

            <div className="file-grid">
                {folders.map(folder => (
                    <div key={folder.prefix} className="file-item" onClick={() => onNavigate(folder.name)}>
                        <div className="file-icon">📁</div>
                        <div className="file-name">{folder.name}</div>
                    </div>
                ))}

                {files.map(file => {
                    const isSelected = selectedKeys?.has(file.key);
                    return (
                        <div key={file.key} className={`file-item ${isSelected ? 'selected' : ''}`} style={{ position: 'relative', cursor: 'default' }}>
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '5px',
                                    left: '5px',
                                    zIndex: 10
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleSelect(file.key);
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={!!isSelected}
                                    onChange={() => { }} // handled by div click
                                    style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                                />
                            </div>
                            <a
                                href={file.url || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}
                            >
                                <div className="file-icon">📄</div>
                                <div className="file-name">{file.name}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: '0.2rem' }}>
                                    {(file.size / 1024).toFixed(1)} KB
                                </div>
                            </a>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
