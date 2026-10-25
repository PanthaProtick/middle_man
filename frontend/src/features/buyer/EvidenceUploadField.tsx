import React, { useState } from 'react';
import { Image, Upload, CheckCircle2, X, AlertCircle, Loader2 } from 'lucide-react';
import { uploadBuyerEvidence } from './api';

interface EvidenceUploadFieldProps {
  portalToken: string;
  evidenceId?: string;
  fileName?: string;
  onUploaded: (evidenceId: string, fileName: string) => void;
  onRemoved: () => void;
  disabled?: boolean;
}

export function EvidenceUploadField({
  portalToken,
  evidenceId,
  fileName,
  onUploaded,
  onRemoved,
  disabled = false,
}: EvidenceUploadFieldProps): React.JSX.Element {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastFailedFile, setLastFailedFile] = useState<File | null>(null);

  const uploadFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image exceeds 5 MiB limit / ফাইলের সাইজ ৫ মেগাবাইটের বেশি হতে পারবে না');
      setLastFailedFile(null);
      return;
    }

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setUploadError('Only JPEG and PNG formats are supported / শুধুমাত্র JPEG ও PNG ফরম্যাট গ্রহণযোগ্য');
      setLastFailedFile(null);
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      const res = await uploadBuyerEvidence(portalToken, file);
      setLastFailedFile(null);
      onUploaded(res.evidence_id, file.name);
    } catch (err: unknown) {
      setLastFailedFile(file);
      setUploadError(
        err instanceof Error
          ? `${err.message} — You can still submit manually below.`
          : 'Upload failed. You can still submit manually below.',
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadFile(file);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleRetry = async () => {
    if (lastFailedFile && !disabled && !isUploading) {
      await uploadFile(lastFailedFile);
    }
  };

  const handleRemove = () => {
    setLastFailedFile(null);
    setUploadError(null);
    onRemoved();
  };

  return (
    <div
      className="form-group"
      style={{
        marginBottom: '16px',
        padding: '12px',
        background: 'var(--bg-surface)',
        border: '1px dashed var(--border-subtle)',
        borderRadius: '8px',
      }}
    >
      <label
        htmlFor="evidence_file"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.85rem',
          color: 'var(--text-primary)',
          marginBottom: '6px',
        }}
      >
        <Image size={15} color="var(--primary-accent)" />
        <span>Payment Screenshot / পেমেন্টের স্ক্রিনশট</span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>(Optional / ঐচ্ছিক)</span>
      </label>

      {uploadError && (
        <div
          role="alert"
          style={{
            padding: '8px 10px',
            borderRadius: '6px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'var(--rose-accent)',
            fontSize: '0.8rem',
            marginBottom: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertCircle size={14} />
            <span>{uploadError}</span>
          </div>
          {lastFailedFile && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={disabled || isUploading}
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '4px',
                color: 'var(--rose-accent)',
                padding: '2px 8px',
                fontSize: '0.75rem',
                cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {evidenceId ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            padding: '8px 12px',
            borderRadius: '6px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
            <CheckCircle2 size={16} color="var(--emerald-accent)" />
            <div style={{ fontSize: '0.85rem', color: 'var(--emerald-accent)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {fileName || 'Screenshot attached / স্ক্রিনশট যুক্ত হয়েছে'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--rose-accent)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
              padding: '2px 6px',
            }}
          >
            <X size={14} />
            <span>Remove</span>
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label
              htmlFor="evidence_file"
              className="btn btn-secondary"
              style={{
                cursor: disabled || isUploading ? 'not-allowed' : 'pointer',
                opacity: disabled || isUploading ? 0.6 : 1,
                fontSize: '0.8rem',
                padding: '6px 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isUploading ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
              <span>{isUploading ? 'Uploading / আপলোড হচ্ছে...' : 'Choose Screenshot / ছবি নির্বাচন করুন'}</span>
            </label>
            <input
              id="evidence_file"
              name="evidence_file"
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleFileChange}
              disabled={disabled || isUploading}
              style={{ display: 'none' }}
            />
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
            JPEG/PNG up to 5 MiB. Optional — manual submission works without a screenshot.
          </div>
        </div>
      )}
    </div>
  );
}
