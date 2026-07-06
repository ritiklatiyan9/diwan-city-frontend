import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { Save, ArrowLeft, Loader2, Download, CloudOff, Check, FileSpreadsheet } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Separator } from '../components/ui/separator';
import { exportFortuneSheetToXLSXFile } from '../utils/excelExport.js';
import LuckyExcel from 'luckyexcel';

export default function ExcelEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const sheetRef = useRef(null);
    const { currentSite } = useAuth();
    const siteId = currentSite?.id;

    const [fileId, setFileId] = useState(id || null);
    const [fileName, setFileName] = useState('Untitled Spreadsheet');
    const [isEditingName, setIsEditingName] = useState(false);
    const [saveState, setSaveState] = useState('new');
    const [loading, setLoading] = useState(!!id);

    // Initial default sheets for a new file
    const [sheets, setSheets] = useState([{
        name: 'Sheet1',
        id: '1',
        status: 1, // active
        celldata: []
    }]);

    // Load existing file
    useEffect(() => {
        if (id) {
            (async () => {
                try {
                    setLoading(true);
                    const { data } = await api.get(`/excel/${id}`);
                    const { file, downloadUrl } = data;
                    setFileId(file.id);
                    setFileName(file.name);

                    // If file has an S3 url, download and parse it
                    if (downloadUrl) {
                        try {
                            const response = await fetch(downloadUrl);
                            const blob = await response.blob();
                            const fileObj = new File([blob], file.name);

                            LuckyExcel.transformExcelToLucky(fileObj, function (exportJson, luckysheetfile) {
                                if (exportJson.sheets == null || exportJson.sheets.length === 0) {
                                    toast.error('Failed to read Excel file');
                                    return;
                                }
                                // FortuneSheet uses the same data format as LuckySheet
                                setSheets(exportJson.sheets);
                                setSaveState('saved');
                            });
                        } catch (e) {
                            console.error('Download error:', e);
                            toast.error('Failed to read from AWS S3');
                        }
                    } else if (file.sheet_data && file.sheet_data.length > 0) {
                        // Legacy JSON fallback
                        setSheets(file.sheet_data);
                        setSaveState('saved');
                    } else {
                        setSaveState('saved');
                    }
                } catch (error) {
                    toast.error('Failed to load file');
                    navigate('/excel/files');
                } finally {
                    setLoading(false);
                }
            })();
        }
    }, [id]);

    const markUnsaved = () => {
        setSaveState((prev) => prev === 'new' ? 'new' : 'unsaved');
    };

    const saveFile = async () => {
        try {
            setSaveState('saving');
            // sheetRef.current gives us the current workbook state array
            const currentSheets = sheetRef.current ? sheetRef.current.getAllSheets() : sheets;

            // Build actual .xlsx file payload
            const excelFile = exportFortuneSheetToXLSXFile(currentSheets, fileName);

            const formData = new FormData();
            formData.append('name', fileName);
            formData.append('file', excelFile);

            if (fileId) {
                await api.put(`/excel/${fileId}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
            } else {
                if (!siteId) {
                    toast.error('Please select a site first');
                    setSaveState('unsaved');
                    return;
                }
                formData.append('site_id', siteId);
                const { data } = await api.post('/excel', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                setFileId(data.file.id);
                // Update URL without reloading
                window.history.replaceState(null, '', `/excel/edit/${data.file.id}`);
            }
            setSaveState('saved');
            toast.success('Saved successfully to S3');
        } catch (error) {
            setSaveState('unsaved');
            toast.error('Failed to save to S3');
        }
    };

    // Quick Download action
    const handleDownload = async () => {
        try {
            if (fileId) {
                const { data } = await api.get(`/excel/${fileId}`);
                if (data.downloadUrl) {
                    window.location.href = data.downloadUrl;
                } else {
                    toast.error('No S3 file found');
                }
            } else {
                toast.error('Save file first before downloading');
            }
        } catch (error) {
            toast.error('Download failed');
        }
    };

    // Keyboard shortcut for saving
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                saveFile();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [fileId, fileName, sheets]);

    const saveIndicatorText = saveState === 'saving' ? 'Saving...'
        : saveState === 'saved' ? '✓ Saved'
            : saveState === 'new' ? 'New file'
                : '● Unsaved';

    const saveIndicatorColor = saveState === 'saving' ? 'text-amber-600'
        : saveState === 'saved' ? 'text-emerald-600'
            : saveState === 'new' ? 'text-slate-400'
                : 'text-orange-500';

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                    <span className="text-sm text-slate-500">Loading spreadsheet...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-56px)] -m-6 bg-white excel-editor-root">
            {/* Title Bar - Only minimal since FortuneSheet has its own full toolbar */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#f5f6f7] border-b border-[#e1e1e1] shrink-0 h-10">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate('/excel/files')} className="h-7 text-xs text-slate-600 hover:bg-[#e6e6e6]">
                        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
                    </Button>
                    <Separator orientation="vertical" className="h-5" style={{ backgroundColor: '#d0d0d0' }} />
                    <FileSpreadsheet className="w-4 h-4 text-[#217346] shrink-0" />
                    {isEditingName ? (
                        <Input autoFocus value={fileName}
                            onChange={(e) => { setFileName(e.target.value); markUnsaved(); }}
                            onBlur={() => setIsEditingName(false)}
                            onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingName(false); }}
                            className="h-7 w-56 text-sm font-medium border-[#217346] focus-visible:ring-[#217346]" />
                    ) : (
                        <button onClick={() => setIsEditingName(true)}
                            className="text-sm font-medium text-slate-800 hover:bg-[#e6e6e6] px-2 py-0.5 rounded transition-colors truncate max-w-[300px]">
                            {fileName}
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-3 pr-2">
                    <span className={`text-xs font-medium ${saveIndicatorColor}`}>{saveIndicatorText}</span>
                    <Button variant="outline" size="sm" onClick={handleDownload} className="h-7 text-xs text-slate-700">
                        <Download className="w-3.5 h-3.5 mr-1" /> Download .xlsx
                    </Button>
                    <Button size="sm" onClick={saveFile} className="h-7 text-xs bg-[#217346] hover:bg-[#185c37] text-white">
                        <Save className="w-3.5 h-3.5 mr-1.5" /> Save File
                    </Button>
                </div>
            </div>

            {/* FortuneSheet Container */}
            <div className="flex-1 w-full relative" style={{ overflow: 'hidden' }}>
                <div className="absolute inset-0">
                    <Workbook
                        ref={sheetRef}
                        data={sheets}
                        onChange={(data) => {
                            // Mark as unsaved when user edits
                            markUnsaved();
                            // Sync sheets ref just in case we need it outside
                            setSheets(data);
                        }}
                        lang="en"
                    />
                </div>
            </div>
        </div>
    );
}
