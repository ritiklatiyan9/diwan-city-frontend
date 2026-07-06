import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
    FileSpreadsheet, Plus, Search, Trash2, Copy, Pencil,
    Download, MoreHorizontal, Loader2, FileX2, Clock,
    SortAsc, SortDesc, ArrowUpDown, Upload,
    FolderPlus, FolderOpen, ChevronRight, Home,
    FileText, Building2, ArrowLeft, ChevronLeft,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuTrigger, DropdownMenuSeparator,
} from '../components/ui/dropdown-menu';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogFooter, DialogDescription,
} from '../components/ui/dialog';
import { Separator } from '../components/ui/separator';
import { AnimatedFolder } from '../components/ui/animated-folder';

// Helpers
const FILE_ACCEPT = '.xlsx,.xls,.csv,.pdf,.doc,.docx';

// Generate SVG data URIs for folder preview cards
const folderPreviewImages = {
    excel: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="112" fill="none"><rect width="80" height="112" rx="8" fill="#ecfdf5"/><rect x="12" y="20" width="56" height="72" rx="4" fill="#d1fae5"/><g fill="#6ee7b7"><rect x="16" y="28" width="22" height="8" rx="2"/><rect x="42" y="28" width="22" height="8" rx="2"/><rect x="16" y="40" width="22" height="8" rx="2"/><rect x="42" y="40" width="22" height="8" rx="2"/><rect x="16" y="52" width="22" height="8" rx="2"/><rect x="42" y="52" width="22" height="8" rx="2"/><rect x="16" y="64" width="22" height="8" rx="2"/><rect x="42" y="64" width="22" height="8" rx="2"/></g><text x="40" y="104" text-anchor="middle" font-size="10" fill="#059669" font-family="sans-serif">XLS</text></svg>')}`,
    pdf: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="112" fill="none"><rect width="80" height="112" rx="8" fill="#fef2f2"/><rect x="16" y="16" width="48" height="64" rx="4" fill="#fecaca"/><path d="M16 16h30l18 18v46a4 4 0 01-4 4H20a4 4 0 01-4-4V20a4 4 0 014-4z" fill="#fca5a5"/><text x="40" y="104" text-anchor="middle" font-size="10" fill="#dc2626" font-family="sans-serif">PDF</text></svg>')}`,
    doc: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="112" fill="none"><rect width="80" height="112" rx="8" fill="#eff6ff"/><rect x="16" y="16" width="48" height="64" rx="4" fill="#bfdbfe"/><g fill="#93c5fd"><rect x="22" y="30" width="36" height="4" rx="2"/><rect x="22" y="38" width="28" height="4" rx="2"/><rect x="22" y="46" width="32" height="4" rx="2"/><rect x="22" y="54" width="24" height="4" rx="2"/></g><text x="40" y="104" text-anchor="middle" font-size="10" fill="#2563eb" font-family="sans-serif">DOC</text></svg>')}`,
    folder: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="112" fill="none"><rect width="80" height="112" rx="8" fill="#fefce8"/><rect x="14" y="32" width="52" height="48" rx="6" fill="#fde68a"/><rect x="14" y="24" width="24" height="12" rx="4" fill="#fbbf24"/><text x="40" y="104" text-anchor="middle" font-size="10" fill="#d97706" font-family="sans-serif">Files</text></svg>')}`,
};

const getFolderProjects = (folder) => {
    return [
        { id: `${folder.id}-1`, image: folderPreviewImages.excel, title: 'Spreadsheets' },
        { id: `${folder.id}-2`, image: folderPreviewImages.pdf, title: 'Documents' },
        { id: `${folder.id}-3`, image: folderPreviewImages.doc, title: 'Files' },
    ];
};

const getFileIcon = (fileType) => {
    switch (fileType) {
        case 'pdf': return <FileText className="w-10 h-10 text-red-400/50 absolute" />;
        case 'doc': return <FileText className="w-10 h-10 text-blue-400/50 absolute" />;
        default: return <FileSpreadsheet className="w-10 h-10 text-emerald-500/30 absolute" />;
    }
};

const getFileGradient = (fileType) => {
    switch (fileType) {
        case 'pdf': return 'from-red-50 to-orange-50';
        case 'doc': return 'from-blue-50 to-indigo-50';
        default: return 'from-emerald-50 to-teal-50';
    }
};

const getFileBadgeColor = (fileType) => {
    switch (fileType) {
        case 'pdf': return 'bg-red-100 text-red-700';
        case 'doc': return 'bg-blue-100 text-blue-700';
        default: return 'bg-emerald-100 text-emerald-700';
    }
};

export default function ExcelFiles() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { currentSite } = useAuth();

    const siteId = currentSite?.id;
    const currentFolderId = searchParams.get('folderId') || null;

    const [files, setFiles] = useState([]);
    const [folders, setFolders] = useState([]);
    const [breadcrumb, setBreadcrumb] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('updated_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [deleteDialog, setDeleteDialog] = useState({ open: false, file: null });
    const [deleteFolderDialog, setDeleteFolderDialog] = useState({ open: false, folder: null });
    const [renameDialog, setRenameDialog] = useState({ open: false, file: null, name: '' });
    const [renameFolderDialog, setRenameFolderDialog] = useState({ open: false, folder: null, name: '' });
    const [createFolderDialog, setCreateFolderDialog] = useState({ open: false, name: '' });
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchData();
    }, [currentFolderId, siteId]);

    const fetchData = async () => {
        if (!siteId) return;
        try {
            setLoading(true);
            const [filesRes, foldersRes] = await Promise.all([
                api.get('/excel', { params: { folderId: currentFolderId, site_id: siteId } }),
                api.get('/folders', { params: { parentId: currentFolderId, site_id: siteId } }),
            ]);
            setFiles(filesRes.data.files || []);
            setFolders(foldersRes.data.folders || []);
            setBreadcrumb(foldersRes.data.breadcrumb || []);
        } catch (error) {
            toast.error('Failed to load files');
        } finally {
            setLoading(false);
        }
    };

    // ─── Folder actions ───
    const handleCreateFolder = async () => {
        const name = createFolderDialog.name.trim();
        if (!name) return;
        try {
            await api.post('/folders', { name, parentId: currentFolderId, site_id: siteId });
            toast.success('Folder created');
            setCreateFolderDialog({ open: false, name: '' });
            fetchData();
        } catch (error) {
            toast.error('Failed to create folder');
        }
    };

    const handleRenameFolder = async () => {
        const name = renameFolderDialog.name.trim();
        if (!name) return;
        try {
            await api.put(`/folders/${renameFolderDialog.folder.id}/rename`, { name });
            toast.success('Folder renamed');
            setRenameFolderDialog({ open: false, folder: null, name: '' });
            fetchData();
        } catch (error) {
            toast.error('Failed to rename folder');
        }
    };

    const handleDeleteFolder = async () => {
        try {
            await api.delete(`/folders/${deleteFolderDialog.folder.id}`);
            toast.success('Folder deleted');
            setDeleteFolderDialog({ open: false, folder: null });
            fetchData();
        } catch (error) {
            toast.error('Failed to delete folder');
        }
    };

    const navigateToFolder = (folderId) => {
        if (folderId) {
            setSearchParams({ folderId: String(folderId) });
        } else {
            setSearchParams({});
        }
    };

    // ─── File actions ───
    const handleDelete = async () => {
        try {
            await api.delete(`/excel/${deleteDialog.file.id}`);
            toast.success('File deleted');
            setDeleteDialog({ open: false, file: null });
            fetchData();
        } catch (error) {
            toast.error('Failed to delete file');
        }
    };

    const handleRename = async () => {
        try {
            await api.put(`/excel/${renameDialog.file.id}/rename`, { name: renameDialog.name });
            toast.success('File renamed');
            setRenameDialog({ open: false, file: null, name: '' });
            fetchData();
        } catch (error) {
            toast.error('Failed to rename file');
        }
    };

    const handleDuplicate = async (file) => {
        try {
            await api.post(`/excel/${file.id}/duplicate`);
            toast.success('File duplicated');
            fetchData();
        } catch (error) {
            toast.error('Failed to duplicate file');
        }
    };

    const handleExport = async (file) => {
        try {
            toast.loading('Preparing download...', { id: 'csv-export' });
            const { data } = await api.get(`/excel/${file.id}`);

            if (data.downloadUrl) {
                window.location.href = data.downloadUrl;
                toast.success('Download starting...', { id: 'csv-export' });
            } else if (data.file && data.file.sheet_data) {
                const XLSX = await import('xlsx');
                const wb = XLSX.utils.book_new();
                const sheetData = data.file.sheet_data || [];

                sheetData.forEach((sheet) => {
                    const ws = XLSX.utils.aoa_to_sheet(sheet.data || []);
                    XLSX.utils.book_append_sheet(wb, ws, sheet.name || 'Sheet');
                });

                XLSX.writeFile(wb, `${file.name}.xlsx`);
                toast.success('Exported successfully', { id: 'csv-export' });
            } else {
                toast.error('No valid file found for export', { id: 'csv-export' });
            }
        } catch (error) {
            console.error('Export error:', error);
            toast.error('Export failed', { id: 'csv-export' });
        }
    };

    const handleManualUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const ext = file.name.split('.').pop().toLowerCase();
        const allowed = ['xlsx', 'xls', 'csv', 'pdf', 'doc', 'docx'];
        if (!allowed.includes(ext)) {
            toast.error('Supported formats: xlsx, xls, csv, pdf, doc, docx');
            return;
        }

        try {
            toast.loading('Uploading file...', { id: 'manual-upload' });
            const formData = new FormData();
            formData.append('file', file);
            formData.append('name', file.name.replace(/\.[^.]+$/, ''));
            if (currentFolderId) formData.append('folder_id', currentFolderId);
            formData.append('site_id', siteId);

            await api.post('/excel', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            toast.success('File uploaded successfully', { id: 'manual-upload' });
            fetchData();
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Failed to upload file', { id: 'manual-upload' });
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Filter and sort
    const filteredFolders = folders.filter((f) =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredFiles = files
        .filter((f) =>
            f.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => {
            const aVal = sortBy === 'name' ? a.name.toLowerCase() : new Date(a[sortBy]).getTime();
            const bVal = sortBy === 'name' ? b.name.toLowerCase() : new Date(b[sortBy]).getTime();
            if (sortOrder === 'asc') return aVal > bVal ? 1 : -1;
            return aVal < bVal ? 1 : -1;
        });

    const toggleSort = (field) => {
        if (sortBy === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
    };

    if (!currentSite) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <Building2 className="w-10 h-10 text-slate-200 mb-3" />
                <p className="text-sm text-slate-500">Select a site to view files</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-12rem)]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                    <span className="text-sm text-slate-500">Loading files...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => navigate(-1)}
                        className="h-10 w-10 p-0 rounded-full hover:bg-slate-100 hover:text-blue-600 transition-all border border-slate-100 bg-white shadow-sm"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">File Manager</h1>
                        <p className="text-sm text-slate-500">Files &amp; folders for <span className="font-medium text-slate-700">{currentSite.name}</span></p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleManualUpload}
                        accept={FILE_ACCEPT}
                        className="hidden"
                    />
                    <Button
                        onClick={() => setCreateFolderDialog({ open: true, name: '' })}
                        variant="outline"
                        className="border-blue-200 text-blue-700 hover:bg-blue-50 h-9"
                    >
                        <FolderPlus className="w-4 h-4 mr-1.5" /> New Folder
                    </Button>
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        variant="outline"
                        className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 h-9"
                    >
                        <Upload className="w-4 h-4 mr-1.5" /> Upload File
                    </Button>
                    <Button onClick={() => navigate('/excel/new')} className="bg-emerald-600 hover:bg-emerald-700 text-white h-9">
                        <Plus className="w-4 h-4 mr-1.5" /> Create Spreadsheet
                    </Button>
                </div>
            </div>

            {/* Breadcrumb */}
            <div className="flex items-center gap-1 text-sm bg-white rounded-lg border border-slate-200 px-3 py-2">
                {currentFolderId ? (
                    <button
                        onClick={() => {
                            const parentId = breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2].id : null;
                            navigateToFolder(parentId);
                        }}
                        className="flex items-center gap-1.5 text-slate-700 hover:text-emerald-600 transition-colors font-semibold group/back pr-2 border-r border-slate-100 mr-1"
                    >
                        <ArrowLeft className="w-4 h-4 transition-transform group-hover/back:-translate-x-0.5" />
                        <span>Back</span>
                    </button>
                ) : (
                    <button
                        onClick={() => navigateToFolder(null)}
                        className="flex items-center gap-1 text-slate-600 hover:text-emerald-600 transition-colors font-medium"
                    >
                        <Home className="w-4 h-4" />
                        <span>Root</span>
                    </button>
                )}
                {breadcrumb.map((crumb) => (
                    <div key={crumb.id} className="flex items-center gap-1">
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        <button
                            onClick={() => navigateToFolder(crumb.id)}
                            className={`text-slate-600 hover:text-emerald-600 transition-colors ${
                                String(crumb.id) === String(currentFolderId)
                                    ? 'font-semibold text-emerald-700'
                                    : ''
                            }`}
                        >
                            {crumb.name}
                        </button>
                    </div>
                ))}
            </div>

            {/* Search & Sort Controls */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                        placeholder="Search files & folders..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 text-sm"
                    />
                </div>
                <Separator orientation="vertical" className="h-6" />
                <div className="flex items-center gap-1">
                    <Button
                        variant={sortBy === 'updated_at' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => toggleSort('updated_at')}
                        className="h-8 text-xs"
                    >
                        <Clock className="w-3 h-3 mr-1" /> Date
                        {sortBy === 'updated_at' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3 ml-1" /> : <SortDesc className="w-3 h-3 ml-1" />)}
                    </Button>
                    <Button
                        variant={sortBy === 'name' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => toggleSort('name')}
                        className="h-8 text-xs"
                    >
                        <ArrowUpDown className="w-3 h-3 mr-1" /> Name
                        {sortBy === 'name' && (sortOrder === 'asc' ? <SortAsc className="w-3 h-3 ml-1" /> : <SortDesc className="w-3 h-3 ml-1" />)}
                    </Button>
                </div>
            </div>

            {/* Content */}
            {filteredFolders.length === 0 && filteredFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                        <FileX2 className="w-8 h-8 text-slate-400" />
                    </div>
                    <h3 className="text-sm font-medium text-slate-700 mb-1">
                        {searchQuery ? 'No results found' : 'This folder is empty'}
                    </h3>
                    <p className="text-xs text-slate-400 mb-4">
                        {searchQuery ? 'Try a different search term' : 'Create a folder or upload a file to get started'}
                    </p>
                    {!searchQuery && (
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={() => setCreateFolderDialog({ open: true, name: '' })}
                                size="sm"
                                variant="outline"
                                className="border-blue-200 text-blue-700"
                            >
                                <FolderPlus className="w-3.5 h-3.5 mr-1" /> New Folder
                            </Button>
                            <Button
                                onClick={() => fileInputRef.current?.click()}
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                                <Upload className="w-3.5 h-3.5 mr-1" /> Upload File
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Folders Grid - 3D Animated */}
                    {filteredFolders.length > 0 && (
                        <div>
                            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Folders</h2>
                            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-11 2xl:grid-cols-13 gap-2">
                                {filteredFolders.map((folder) => (
                                    <div key={`folder-${folder.id}`} className="relative group/card">
                                        <AnimatedFolder
                                            title={folder.name}
                                            projects={getFolderProjects(folder)}
                                            onClick={() => navigateToFolder(folder.id)}
                                            isCompact={true}
                                            className="w-full"
                                        />
                                        {/* Folder actions dropdown */}
                                        <div className="absolute top-3 right-3 z-40 opacity-0 group-hover/card:opacity-100 transition-opacity">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 bg-white/80 backdrop-blur-sm shadow-sm">
                                                        <MoreHorizontal className="w-3.5 h-3.5" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                                    <DropdownMenuItem
                                                        onClick={() => setRenameFolderDialog({ open: true, folder, name: folder.name })}
                                                        className="text-xs"
                                                    >
                                                        <Pencil className="w-3 h-3 mr-2" /> Rename
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem
                                                        onClick={() => setDeleteFolderDialog({ open: true, folder })}
                                                        className="text-xs text-red-600 focus:text-red-600"
                                                    >
                                                        <Trash2 className="w-3 h-3 mr-2" /> Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Files Grid */}
                    {filteredFiles.length > 0 && (
                        <div>
                            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Files</h2>
                            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-11 2xl:grid-cols-13 gap-2">
                                {filteredFiles.map((file) => (
                                    <div
                                        key={file.id}
                                        className="group bg-white rounded-lg border border-slate-200 hover:border-emerald-300 hover:shadow-sm transition-all cursor-pointer overflow-hidden flex flex-col items-center p-2 text-center"
                                        onClick={() => handleExport(file)}
                                    >
                                        <div className={`w-full aspect-square bg-gradient-to-br ${getFileGradient(file.file_type)} flex items-center justify-center rounded-sm border border-slate-50 relative mb-1`}>
                                            <div className="scale-50 flex items-center justify-center">
                                                {getFileIcon(file.file_type)}
                                            </div>
                                            
                                            <div className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                        <Button variant="ghost" size="sm" className="h-4 w-4 p-0 bg-white/95 backdrop-blur-sm shadow-sm hover:h-5 hover:w-5 transition-all">
                                                            <MoreHorizontal className="w-2.5 h-2.5" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                                        {(!file.file_type || file.file_type === 'excel') && (
                                                            <DropdownMenuItem onClick={() => navigate(`/excel/edit/${file.id}`)} className="text-xs">
                                                                <Pencil className="w-3 h-3 mr-2" /> Open
                                                            </DropdownMenuItem>
                                                        )}
                                                        <DropdownMenuItem onClick={() => setRenameDialog({ open: true, file, name: file.name })} className="text-xs">
                                                            <Pencil className="w-3 h-3 mr-2" /> Rename
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleDuplicate(file)} className="text-xs">
                                                            <Copy className="w-3 h-3 mr-2" /> Duplicate
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleExport(file)} className="text-xs">
                                                            <Download className="w-3 h-3 mr-2" /> Download
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => setDeleteDialog({ open: true, file })}
                                                            className="text-xs text-red-600 focus:text-red-600"
                                                        >
                                                            <Trash2 className="w-3 h-3 mr-2" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>

                                        <h3 className="text-[10px] font-medium text-slate-700 leading-tight w-full truncate h-6 px-0.5">{file.name}</h3>
                                        <div className="text-[8px] text-slate-400 truncate w-full px-0.5">
                                            {file.updated_at ? format(new Date(file.updated_at), 'dd/MM/yy') : '--'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Dialogs ─── */}

            {/* Create Folder Dialog */}
            <Dialog open={createFolderDialog.open} onOpenChange={(open) => setCreateFolderDialog({ open, name: '' })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base">Create New Folder</DialogTitle>
                        <DialogDescription className="text-sm text-slate-500">
                            Enter a name for your new folder
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        value={createFolderDialog.name}
                        onChange={(e) => setCreateFolderDialog({ ...createFolderDialog, name: e.target.value })}
                        placeholder="Folder name"
                        className="mt-2"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
                        autoFocus
                    />
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setCreateFolderDialog({ open: false, name: '' })}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleCreateFolder} className="bg-blue-600 hover:bg-blue-700 text-white">
                            Create Folder
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rename Folder Dialog */}
            <Dialog open={renameFolderDialog.open} onOpenChange={(open) => setRenameFolderDialog({ open, folder: null, name: '' })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base">Rename Folder</DialogTitle>
                        <DialogDescription className="text-sm text-slate-500">
                            Enter a new name for the folder
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        value={renameFolderDialog.name}
                        onChange={(e) => setRenameFolderDialog({ ...renameFolderDialog, name: e.target.value })}
                        placeholder="Folder name"
                        className="mt-2"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRenameFolder(); }}
                        autoFocus
                    />
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setRenameFolderDialog({ open: false, folder: null, name: '' })}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleRenameFolder} className="bg-blue-600 hover:bg-blue-700 text-white">
                            Rename
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Folder Dialog */}
            <Dialog open={deleteFolderDialog.open} onOpenChange={(open) => setDeleteFolderDialog({ open, folder: null })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base">Delete Folder</DialogTitle>
                        <DialogDescription className="text-sm text-slate-500">
                            Are you sure you want to delete <strong>{deleteFolderDialog.folder?.name}</strong> and all its contents? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setDeleteFolderDialog({ open: false, folder: null })}>
                            Cancel
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleDeleteFolder}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete File Dialog */}
            <Dialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, file: null })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base">Delete File</DialogTitle>
                        <DialogDescription className="text-sm text-slate-500">
                            Are you sure you want to delete <strong>{deleteDialog.file?.name}</strong>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setDeleteDialog({ open: false, file: null })}>
                            Cancel
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleDelete}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rename File Dialog */}
            <Dialog open={renameDialog.open} onOpenChange={(open) => setRenameDialog({ open, file: null, name: '' })}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base">Rename File</DialogTitle>
                        <DialogDescription className="text-sm text-slate-500">
                            Enter a new name for your file
                        </DialogDescription>
                    </DialogHeader>
                    <Input
                        value={renameDialog.name}
                        onChange={(e) => setRenameDialog({ ...renameDialog, name: e.target.value })}
                        placeholder="File name"
                        className="mt-2"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); }}
                        autoFocus
                    />
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setRenameDialog({ open: false, file: null, name: '' })}>
                            Cancel
                        </Button>
                        <Button size="sm" onClick={handleRename} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            Rename
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
