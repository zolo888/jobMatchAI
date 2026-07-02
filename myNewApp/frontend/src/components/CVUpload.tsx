import React, { useCallback, useState } from 'react';
import styles from './CVUpload.module.css';

interface Props {
  onUpload: (file: File) => void;
  isLoading: boolean;
}

const CVUpload: React.FC<Props> = ({ onUpload, isLoading }) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFile = useCallback(
    (file: File) => {
      setSelectedFile(file);
      onUpload(file);
    },
    [onUpload]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={styles.wrapper}>
      <label
        id="cv-upload-zone"
        className={`${styles.dropzone} ${dragOver ? styles.dragOver : ''} ${selectedFile ? styles.hasFile : ''} ${isLoading ? styles.loading : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        htmlFor="cv-file-input"
        role="button"
        aria-label="Ladda upp CV"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') document.getElementById('cv-file-input')?.click(); }}
      >
        <input
          id="cv-file-input"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          onChange={handleInputChange}
          className={styles.hiddenInput}
          disabled={isLoading}
          aria-hidden="true"
        />

        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} aria-label="Analyserar..." />
            <p className={styles.loadingTitle}>Analyserar CV med AI…</p>
            <p className={styles.loadingSubtitle}>Extraherar kompetenser och erfarenhet</p>
          </div>
        ) : selectedFile ? (
          <div className={styles.fileState}>
            <div className={styles.fileIcon}>📄</div>
            <div className={styles.fileInfo}>
              <p className={styles.fileName}>{selectedFile.name}</p>
              <p className={styles.fileSize}>{formatSize(selectedFile.size)}</p>
            </div>
            <div className={styles.checkmark}>✓</div>
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.uploadIcon}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M24 32V16M24 16L18 22M24 16L30 22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 32v4a4 4 0 004 4h24a4 4 0 004-4v-4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <p className={styles.uploadTitle}>Dra & släpp ditt CV här</p>
            <p className={styles.uploadSubtitle}>eller klicka för att välja fil</p>
            <div className={styles.formatBadges}>
              {['PDF', 'PNG', 'JPG', 'WEBP'].map((fmt) => (
                <span key={fmt} className="chip chip-primary">{fmt}</span>
              ))}
            </div>
            <p className={styles.sizeLimit}>Max 10 MB</p>
          </div>
        )}
      </label>
    </div>
  );
};

export default CVUpload;
