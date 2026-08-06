import { useRef, useState } from 'react';
import { Upload, X, Image, Loader2, ExternalLink, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import api from '@/api/api';

/** S3 keys are uuids, so fall back to the URL basename only when we never saw the File. */
const basename = (url) => {
  try { return decodeURIComponent(String(url).split('?')[0].split('/').pop()) || 'Voucher'; }
  catch { return 'Voucher'; }
};

/**
 * Reusable voucher/receipt upload component.
 * Uploads the file to S3 via /upload/single and returns the URL.
 *
 * Props:
 * - value: string|null (current voucher URL)
 * - onChange: (url: string|null) => void
 * - disabled: boolean
 * - compact: boolean — paperclip button + filename chip, for a modal footer strip
 *   (the full dashed drop zone costs a whole form row)
 */
export default function VoucherUpload({ value, onChange, disabled = false, compact = false }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview
    setPreview(URL.createObjectURL(file));
    setName(file.name);
    setUploading(true);

    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/upload/single?provider=s3', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(res.data.url || res.data.fileUrl);
    } catch {
      onChange(null);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    onChange(null);
    setPreview(null);
    setName('');
  };

  const displayUrl = value || preview;

  if (compact) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        <Button
          type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0"
          disabled={disabled || uploading}
          onClick={() => inputRef.current?.click()}
          title="Voucher / Receipt"
          aria-label={displayUrl ? 'Replace voucher' : 'Attach voucher'}
        >
          {uploading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Paperclip className={`h-4 w-4 ${displayUrl ? 'text-blue-600' : 'text-muted-foreground'}`} />}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || uploading}
        />
        {displayUrl && (
          <span className="flex min-w-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]">
            <a href={displayUrl} target="_blank" rel="noopener noreferrer"
              className="max-w-28 truncate text-blue-600 hover:underline">
              {name || basename(value)}
            </a>
            {!disabled && (
              <button type="button" onClick={handleRemove} aria-label="Remove voucher"
                className="shrink-0 text-muted-foreground hover:text-red-600">
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Voucher / Receipt</label>
      {displayUrl ? (
        <div className="relative inline-block">
          <a href={displayUrl} target="_blank" rel="noopener noreferrer">
            <img
              src={displayUrl}
              alt="Voucher"
              className="h-24 w-24 rounded-lg border object-cover hover:opacity-80 transition"
            />
          </a>
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <label
          className={`flex items-center gap-2 border-2 border-dashed rounded-lg p-3 cursor-pointer transition
            ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:border-blue-400 hover:bg-blue-50'}`}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          ) : (
            <Upload className="h-5 w-5 text-gray-400" />
          )}
          <span className="text-sm text-gray-500">
            {uploading ? 'Uploading...' : 'Upload voucher photo'}
          </span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled || uploading}
          />
        </label>
      )}
    </div>
  );
}

/**
 * Small inline voucher thumbnail for table rows.
 * Props:
 * - url: string|null
 */
export function VoucherThumbnail({ url }) {
  if (!url) return <span className="text-gray-400 text-xs">No voucher</span>;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800">
      <Image className="h-4 w-4" />
      <span className="text-xs underline">View</span>
    </a>
  );
}
