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
      {/* Header Section */}
      <header className="flex justify-between items-center mb-4 p-4 card" style={{ marginBottom: '1.5rem', background: 'var(--color-bg-card)' }}>
        <div className="flex items-center gap-2">
          <div style={{ fontSize: '1.5rem' }}>☁️</div>
          <h1 style={{ marginBottom: 0, fontSize: '1.25rem' }}>Sumit's Drive</h1>
        </div>

        <div className="flex gap-2">
          {selectedKeys.size > 0 && (
            <button
              onClick={handleDelete}
              className="btn btn-danger"
            >
              Delete ({selectedKeys.size})
            </button>
          )}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="btn btn-primary"
          >
            <span style={{ fontSize: '1.1rem' }}>+</span> Upload
          </button>
        </div>
      </header>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-2 mb-4 text-sm" style={{ padding: '0 0.5rem', overflowX: 'auto', whiteSpace: 'nowrap' }}>
        <button
          className="btn btn-ghost p-2"
          onClick={handleRootClick}
          style={{ padding: '0.25rem 0.5rem', borderRadius: '4px' }}
        >
          Home
        </button>
        {pathParts.map((part, index) => (
          <React.Fragment key={index}>
            <span className="text-muted">/</span>
            <button
              className="btn btn-ghost p-2"
              onClick={() => handleBreadcrumbClick(index, pathParts)}
              style={{ padding: '0.25rem 0.5rem', borderRadius: '4px' }}
            >
              {part}
            </button>
          </React.Fragment>
        ))}
      </nav>

      <main>
        {error && (
          <div className="card p-4 mb-4" style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center p-4" style={{ height: '200px' }}>
            <div className="text-muted animate-fade-in">Loading content...</div>
          </div>
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
