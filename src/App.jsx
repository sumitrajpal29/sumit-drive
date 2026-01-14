import React, { useEffect, useState } from 'react';
import { listBucketContent, deleteFiles } from './services/s3';
import FileExplorer from './components/FileExplorer';
import UploadModal from './components/UploadModal';

function App() {
  const [currentPath, setCurrentPath] = useState("");
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [error, setError] = useState(null);

  const [selectedKeys, setSelectedKeys] = useState(new Set());

  const fetchContent = async (path) => {
    setLoading(true);
    setError(null);
    try {
      const { folders, files } = await listBucketContent(path);
      setFolders(folders);
      setFiles(files);
    } catch (err) {
      console.error(err);
      setError("Failed to load bucket content. Check your credentials.");
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    setSelectedKeys(new Set());
    fetchContent(currentPath);
  }, [currentPath]);

  const handleToggleSelect = (key) => {
    setSelectedKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleDelete = async () => {
    if (selectedKeys.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedKeys.size} file(s)?`)) return;

    setLoading(true);
    try {
      await deleteFiles(Array.from(selectedKeys));
      setSelectedKeys(new Set());
      await fetchContent(currentPath);
    } catch (err) {
      console.error(err);
      setError("Failed to delete files. Check permissions.");
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (folderName) => {
    setCurrentPath(prev => prev ? `${prev}/${folderName}` : folderName);
  };

  const handleBreadcrumbClick = (index, parts) => {
    const newPath = parts.slice(0, index + 1).join('/');
    setCurrentPath(newPath);
  };

  const handleRootClick = () => {
    setCurrentPath("");
  };

  const pathParts = currentPath ? currentPath.split('/') : [];

  return (
    <div className="app-container">
      <header className="flex justify-between items-center mb-4 p-4 card" style={{ marginBottom: '2rem' }}>
        <h1>S3 Explorer</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          {selectedKeys.size > 0 && (
            <button
              onClick={handleDelete}
              style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
            >
              Delete Selected ({selectedKeys.size})
            </button>
          )}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            style={{ backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-primary)' }}
          >
            Upload File
          </button>
        </div>
      </header>

      <div className="breadcrumb card">
        <span className="breadcrumb-item" onClick={handleRootClick}>root</span>
        {pathParts.map((part, index) => (
          <React.Fragment key={index}>
            <span>/</span>
            <span className="breadcrumb-item" onClick={() => handleBreadcrumbClick(index, pathParts)}>
              {part}
            </span>
          </React.Fragment>
        ))}
      </div>

      <main>
        {error && <div className="p-4 mb-4 card" style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>{error}</div>}

        {loading ? (
          <div className="p-4 text-center">Loading...</div>
        ) : (
          <FileExplorer
            files={files}
            folders={folders}
            onNavigate={handleNavigate}
            currentPath={currentPath}
            selectedKeys={selectedKeys}
            onToggleSelect={handleToggleSelect}
          />
        )}
      </main>

      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        currentPath={currentPath}
        onUploadComplete={() => fetchContent(currentPath)}
      />
    </div>
  );
}

export default App;
