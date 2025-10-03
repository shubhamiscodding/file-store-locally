import React, { useState, useEffect, useCallback } from 'react';
import {
  Upload, FolderPlus, Search, User, LogOut, Folder, File, Download,
  Edit2 as EditIcon, Share2, Trash2, RotateCcw, X, HardDrive, Calendar, ArrowLeft
} from 'lucide-react';
import apiClient from '../api/apiClient';
import { formatDate, formatFileSize } from '../utils/helpers';

import Modal from '../components/Modal';
import Toast from '../components/Toast';
import ContextMenu from '../components/ContextMenu';
import FileUpload from '../components/FileUpload';
import ShareModal from '../components/ShareModal';

const FilePreview = ({ file, onBack }) => {
  const [objectUrl, setObjectUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setObjectUrl(null);
    setIsLoading(true);
    setError('');

    const fetchFile = async () => {
      try {
        const response = await apiClient.downloadFile(file.id);
        if (!response.ok) {
           throw new Error("File not found or access denied.");
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setObjectUrl(url);
      } catch (err) {
        setError('Could not load file preview.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFile();

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file]);

  const renderPreview = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      );
    }
    if (error) {
      return <p className="text-center text-red-600">{error}</p>;
    }
    if (!objectUrl) {
      return <p className="text-center">Loading preview...</p>;
    }

    if (file.mimetype.startsWith('image/')) {
      return <img src={objectUrl} alt={file.name} className="max-w-full max-h-full object-contain mx-auto" />;
    }
    if (file.mimetype === 'application/pdf' || file.mimetype.startsWith('video/')) {
      return <iframe src={objectUrl} title={file.name} className="w-full h-full border-0" />;
    }
    
    return (
      <div className="text-center p-8 bg-gray-100 rounded-lg flex flex-col items-center justify-center h-full">
        <p className="font-semibold text-gray-700 text-lg">Preview not available for this file type.</p>
        <p className="text-sm text-gray-500 mb-6">{file.name}</p>
        <a href={objectUrl} download={file.name} className="inline-flex items-center justify-center space-x-2 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 font-medium">
            <Download className="w-5 h-5" />
            <span>Download File</span>
        </a>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-gray-200 flex items-center">
        <button onClick={onBack} className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 mr-4">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </button>
        <span className="font-semibold text-gray-800 truncate">{file.name}</span>
      </div>
      <div className="flex-grow p-4 flex items-center justify-center overflow-auto">
        {renderPreview()}
      </div>
    </div>
  );
};


const DashboardPage = ({ user, onLogout }) => {
  const [viewingFile, setViewingFile] = useState(null);
  const [currentView, setCurrentView] = useState('explorer');
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [breadcrumbs, setBreadcrumbs] = useState([{ id: null, name: 'My Files' }]);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [trashItems, setTrashItems] = useState({ files: [], folders: [] });
  const [sharedLinks, setSharedLinks] = useState([]);
  const [storageInfo, setStorageInfo] = useState({ storageUsed: 0, storageLimit: 1 });
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(null);
  const [showShareModal, setShowShareModal] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (message, type) => {
    setToast({ message, type });
  };

  const loadExplorerData = useCallback(async () => {
    try {
      const [foldersRes, filesRes] = await Promise.all([
        apiClient.getFolders(currentFolderId),
        apiClient.getFiles(currentFolderId, 1, 100, searchQuery),
      ]);
      setFolders(foldersRes.folders);
      setFiles(filesRes.files);
    } catch (error) {
      console.error('Failed to load explorer data:', error);
      showToast('Failed to load files', 'error');
    }
  }, [currentFolderId, searchQuery]);

  const loadTrashItems = useCallback(async () => {
    try {
      const result = await apiClient.getTrashItems();
      setTrashItems({ files: result.files || [], folders: result.folders || [] });
    } catch (error) {
      console.error('Failed to load trash items:', error);
      showToast('Failed to load trash', 'error');
    }
  }, []);

  const loadSharedLinks = useCallback(async () => {
    try {
      const result = await apiClient.getShares();
      setSharedLinks(result.shares);
    } catch (error) {
      console.error('Failed to load shared links:', error);
      showToast('Failed to load shares', 'error');
    }
  }, []);

  const fetchStorageInfo = useCallback(async () => {
    try {
      const result = await apiClient.getCurrentUser();
      if (result.user && result.user.storageInfo) {
        setStorageInfo(result.user.storageInfo);
      }
    } catch (error) {
      console.error("Could not fetch user storage info:", error);
    }
  }, []);

  useEffect(() => {
    fetchStorageInfo();
  }, [fetchStorageInfo]);

  useEffect(() => {
    if (currentView === 'explorer') {
      loadExplorerData();
    } else if (currentView === 'trash') {
      loadTrashItems();
    } else if (currentView === 'sharedLinks') {
      loadSharedLinks();
    }
  }, [currentView, loadExplorerData, loadTrashItems, loadSharedLinks]);

  const navigateToFolder = (folderId, folderName) => {
    const newBreadcrumb = { id: folderId, name: folderName };
    const existingIndex = breadcrumbs.findIndex(bc => bc.id === folderId);
    if (existingIndex !== -1) {
      setBreadcrumbs(prev => prev.slice(0, existingIndex + 1));
    } else {
      setBreadcrumbs(prev => [...prev, newBreadcrumb]);
    }
    setCurrentFolderId(folderId);
  };

  const navigateToBreadcrumb = (index) => {
    const targetBreadcrumb = breadcrumbs[index];
    setCurrentFolderId(targetBreadcrumb.id);
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
  };

  const handleCreateFolder = async (name) => {
    try {
      await apiClient.createFolder(name, currentFolderId);
      showToast('Folder created successfully', 'success');
      loadExplorerData();
      setShowNewFolderModal(false);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleRename = async () => {
    if (!showRenameModal) return;
    try {
      if (showRenameModal.type === 'file') {
        await apiClient.renameFile(showRenameModal.id, renameValue);
      } else {
        await apiClient.updateFolder(showRenameModal.id, renameValue);
      }
      showToast('Renamed successfully', 'success');
      setShowRenameModal(null);
      setRenameValue('');
      loadExplorerData();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleDownload = async (file) => {
    try {
      const response = await apiClient.downloadFile(file.id);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      showToast('Download failed', 'error');
    }
  };

  const handleMoveToTrash = async (type, id, name) => {
    try {
      await apiClient.moveToTrash(type, id);
      showToast(`${name} moved to trash`, 'success');
      loadExplorerData();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleRestoreFromTrash = async (type, id, name) => {
    try {
      await apiClient.restoreFromTrash(type, id);
      showToast(`${name} restored successfully`, 'success');
      loadTrashItems();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handlePermanentDelete = async (type, id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await apiClient.permanentDelete(type, id);
      showToast(`${name} deleted permanently`, 'success');
      loadTrashItems();
      fetchStorageInfo();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleEmptyTrash = async () => {
    if (!window.confirm('Are you sure you want to empty the trash? This action cannot be undone.')) {
      return;
    }
    try {
      await apiClient.emptyTrash();
      showToast('Trash emptied successfully', 'success');
      loadTrashItems();
      fetchStorageInfo();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleRevokeShare = async (shareId) => {
    try {
      await apiClient.deleteShare(shareId);
      showToast('Share link revoked successfully', 'success');
      loadSharedLinks();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      console.error("Logout failed on server but proceeding on client.");
    }
    onLogout();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="inline-flex items-center justify-center w-10 h-10 bg-blue-600 rounded-lg">
                  <HardDrive className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">File-Store</h1>
              </div>
              {currentView === 'explorer' && !viewingFile && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search files..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                  />
                </div>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative group">
                <button className="flex items-center space-x-2 text-gray-700 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100">
                  <User className="w-5 h-5" />
                  <span className="font-medium">{user.name}</span>
                </button>
              </div>
              <button onClick={handleLogout} className="flex items-center space-x-2 text-red-600 hover:text-red-700 px-3 py-2 rounded-lg hover:bg-red-50">
                <LogOut className="w-5 h-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex" style={{ height: 'calc(100vh - 81px)' }}>
        <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto p-6 flex flex-col">
          <div className="space-y-4">
            <div className="space-y-2">
              <button onClick={() => setShowUploadModal(true)} className="w-full flex items-center justify-center space-x-3 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                <Upload className="w-5 h-5" />
                <span>Upload File</span>
              </button>
              <button onClick={() => setShowNewFolderModal(true)} className="w-full flex items-center justify-center space-x-3 border border-gray-300 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                <FolderPlus className="w-5 h-5" />
                <span>New Folder</span>
              </button>
            </div>
            <nav className="space-y-1">
              <button
                onClick={() => { setCurrentView('explorer'); setViewingFile(null); }}
                className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${currentView === 'explorer' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <Folder className="w-5 h-5" />
                <span>My Files</span>
              </button>
              <button
                onClick={() => { setCurrentView('trash'); setViewingFile(null); }}
                className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${currentView === 'trash' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <Trash2 className="w-5 h-5" />
                <span>Trash</span>
              </button>
              <button
                onClick={() => { setCurrentView('sharedLinks'); setViewingFile(null); }}
                className={`w-full flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors ${currentView === 'sharedLinks' ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}
              >
                <Share2 className="w-5 h-5" />
                <span>Shared Links</span>
              </button>
            </nav>
          </div>
          <div className="mt-auto pt-4 border-t border-gray-200">
            <div className="text-sm font-semibold text-gray-700 mb-2">Storage</div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-800">{formatFileSize(storageInfo.storageUsed)}</span>
                <span className="text-gray-500">of {formatFileSize(storageInfo.storageLimit)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${Math.min((storageInfo.storageUsed / storageInfo.storageLimit) * 100, 100)}%` }} />
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 overflow-auto">
          {viewingFile && currentView === 'explorer' ? (
            <FilePreview file={viewingFile} onBack={() => setViewingFile(null)} />
          ) : (
            <div className="h-full flex flex-col">
              {currentView === 'explorer' && (
                <div className="px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
                  <nav className="flex items-center space-x-2">
                    {breadcrumbs.map((item, index) => (
                      <React.Fragment key={index}>
                        {index > 0 && <span className="text-gray-400">/</span>}
                        <button
                          onClick={() => navigateToBreadcrumb(index)}
                          disabled={index === breadcrumbs.length - 1}
                          className={`text-sm font-medium ${index === breadcrumbs.length - 1 ? 'text-gray-900 cursor-default' : 'text-blue-600 hover:text-blue-700'}`}
                        >
                          {item.name}
                        </button>
                      </React.Fragment>
                    ))}
                  </nav>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-6">
                {currentView === 'explorer' && (
                  <>
                    {folders.length === 0 && files.length === 0 ? (
                      <div className="text-center py-12 h-full flex flex-col justify-center items-center">
                        <Folder className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">This folder is empty</h3>
                        <p className="text-gray-600">Get started by uploading a file or creating a new folder.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {folders.map((folder) => (
                          <div key={folder._id} onDoubleClick={() => navigateToFolder(folder._id, folder.name)} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, item: { id: folder._id, name: folder.name, type: 'folder' } }); }} className="group p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-sm cursor-pointer transition-all flex flex-col items-center text-center">
                            <Folder className="w-12 h-12 text-blue-500 mb-2 flex-shrink-0" />
                            <span className="text-sm font-medium text-gray-900 break-words w-full">{folder.name}</span>
                          </div>
                        ))}
                        {files.map((file) => (
                          <div key={file._id} onClick={() => setViewingFile(file)} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, item: { id: file._id, name: file.name, type: 'file' } }); }} className="group p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-sm cursor-pointer transition-all flex flex-col items-center text-center">
                            <File className="w-12 h-12 text-gray-400 mb-2 flex-shrink-0" />
                            <span className="text-sm font-medium text-gray-900 break-words w-full">{file.name}</span>
                            <span className="text-xs text-gray-500 mt-1">{formatFileSize(file.size)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {currentView === 'trash' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h2 className="text-xl font-semibold text-gray-900">Trash</h2>
                      <button onClick={handleEmptyTrash} disabled={!trashItems.files.length && !trashItems.folders.length} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium">
                        Empty Trash
                      </button>
                    </div>
                    {!trashItems.files.length && !trashItems.folders.length ? (
                      <div className="text-center py-12 h-full flex flex-col justify-center items-center">
                        <Trash2 className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Trash is empty</h3>
                        <p className="text-gray-600">Items you move to trash will appear here.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {[...(trashItems.folders || []), ...(trashItems.files || [])].map((item) => (
                          <div key={item._id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                            <div className="flex items-center space-x-3">
                              {item.size === undefined ? <Folder className="w-6 h-6 text-gray-400" /> : <File className="w-6 h-6 text-gray-400" />}
                              <div>
                                <div className="font-medium text-gray-900">{item.name}</div>
                                <div className="text-sm text-gray-500">
                                  {item.size === undefined ? 'Folder' : `File • ${formatFileSize(item.size)}`}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <button onClick={() => handleRestoreFromTrash(item.size === undefined ? 'folder' : 'file', item._id, item.name)} className="text-blue-600 hover:text-blue-700 p-2" title="Restore">
                                <RotateCcw className="w-4 h-4" />
                              </button>
                              <button onClick={() => handlePermanentDelete(item.size === undefined ? 'folder' : 'file', item._id, item.name)} className="text-red-600 hover:text-red-700 p-2" title="Delete permanently">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {currentView === 'sharedLinks' && (
                  <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-900">Shared Links</h2>
                    {sharedLinks.length === 0 ? (
                      <div className="text-center py-12 h-full flex flex-col justify-center items-center">
                        <Share2 className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No active shared links</h3>
                        <p className="text-gray-600">Right-click a file and select "Share" to create a link.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {sharedLinks.map((share) => (
                          <div key={share._id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                            <div className="flex items-center space-x-3">
                              <File className="w-6 h-6 text-gray-400" />
                              <div>
                                <div className="font-medium text-gray-900">{share.file ? share.file.name : 'Deleted File'}</div>
                                <div className="text-sm text-gray-500 flex items-center space-x-2">
                                  <span>Shared: {formatDate(share.createdAt)}</span>
                                  {share.expiresAt && (
                                    <span className="flex items-center"><Calendar className="w-3 h-3 mr-1" /> Expires: {formatDate(share.expiresAt)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <button onClick={() => handleRevokeShare(share._id)} className="text-red-600 hover:text-red-700 px-3 py-1 text-sm rounded-md hover:bg-red-50 font-medium">
                              Revoke
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)}>
          {contextMenu.item.type === 'file' && (
            <button onClick={() => { const file = files.find(f => f._id === contextMenu.item.id); if (file) handleDownload(file); setContextMenu(null); }} className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left">
              <Download className="w-4 h-4" /><span>Download</span>
            </button>
          )}
          <button onClick={() => { setShowRenameModal({ id: contextMenu.item.id, name: contextMenu.item.name, type: contextMenu.item.type }); setRenameValue(contextMenu.item.name); setContextMenu(null); }} className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left">
            <EditIcon className="w-4 h-4" /><span>Rename</span>
          </button>
          {contextMenu.item.type === 'file' && (
            <button onClick={() => { const file = files.find(f => f._id === contextMenu.item.id); if (file) setShowShareModal(file); setContextMenu(null); }} className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 w-full text-left">
              <Share2 className="w-4 h-4" /><span>Share</span>
            </button>
          )}
          <button onClick={() => { handleMoveToTrash(contextMenu.item.type, contextMenu.item.id, contextMenu.item.name); setContextMenu(null); }} className="flex items-center space-x-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left">
            <Trash2 className="w-4 h-4" /><span>Move to Trash</span>
          </button>
        </ContextMenu>
      )}

      <Modal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} title="Upload File">
        <FileUpload
          folderId={currentFolderId}
          onUploadComplete={(storage) => {
            setStorageInfo(storage);
            loadExplorerData();
            showToast('File uploaded successfully', 'success');
          }}
          onClose={() => setShowUploadModal(false)}
        />
      </Modal>

      <Modal isOpen={showNewFolderModal} onClose={() => setShowNewFolderModal(false)} title="Create New Folder">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const name = formData.get('name');
            if (name && name.trim()) {
              handleCreateFolder(name.trim());
            }
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Folder Name</label>
            <input
              type="text"
              name="name"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter folder name"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button type="button" onClick={() => setShowNewFolderModal(false)} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Create Folder</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!showRenameModal} onClose={() => { setShowRenameModal(null); setRenameValue(''); }} title={`Rename ${showRenameModal?.type}`}>
        <form
          onSubmit={(e) => { e.preventDefault(); handleRename(); }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Name</label>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end space-x-3">
            <button type="button" onClick={() => { setShowRenameModal(null); setRenameValue(''); }} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Rename</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!showShareModal} onClose={() => setShowShareModal(null)} title="Share File">
        {showShareModal && (
          <ShareModal file={showShareModal} onClose={() => setShowShareModal(null)} />
        )}
      </Modal>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
};

export default DashboardPage;

