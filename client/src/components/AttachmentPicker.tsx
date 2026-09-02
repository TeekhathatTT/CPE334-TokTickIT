import { useMemo, useRef, useState } from "react";

export interface AttachmentPickerProps {
  value: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
}

const VALID_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"] as const;
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

export function AttachmentPicker({ value, onChange, maxFiles = 5 }: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [rejected, setRejected] = useState<Array<{ name: string; reason: string }>>([]);

  const sizeLabel = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const addFiles = (incoming: FileList | File[]) => {
    const fileList = Array.from(incoming);
    const nextRejected: Array<{ name: string; reason: string }> = [];
    const accepted: File[] = [];

    fileList.forEach((file) => {
      const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
      const isSupported = VALID_EXTENSIONS.includes(extension as (typeof VALID_EXTENSIONS)[number]);
      const isUnderLimit = file.size <= MAX_SIZE_BYTES;

      if (!isSupported) {
        nextRejected.push({ name: file.name, reason: "unsupported file type. Allowed: JPG, PNG, WEBP, PDF" });
        return;
      }

      if (!isUnderLimit) {
        nextRejected.push({ name: file.name, reason: "file exceeds 5MB limit." });
        return;
      }

      accepted.push(file);
    });

    const combined = [...value, ...accepted].slice(0, maxFiles);
    onChange(combined);
    setRejected(nextRejected);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const remaining = maxFiles - value.length;
  const hasReachedLimit = value.length >= maxFiles;

  return (
    <div className="attachment-picker">
      <div className="attachment-dropzone" onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
          hidden
          onChange={(event) => {
            if (event.target.files) {
              addFiles(event.target.files);
            }
          }}
        />
        <div className="attachment-dropzone__label">Drag files here or Add</div>
        <div className="attachment-dropzone__count">{value.length} of {maxFiles} attachments</div>
      </div>

      {rejected.length > 0 && (
        <div className="attachment-errors" aria-live="polite">
          {rejected.map((item) => (
            <div key={`${item.name}-${item.reason}`} className="attachment-error">
              {item.name} — {item.reason}
            </div>
          ))}
        </div>
      )}

      {value.length > 0 && (
        <ul className="attachment-list">
          {value.map((file, index) => (
            <li key={`${file.name}-${index}`} className="attachment-item">
              <span>{file.name}</span>
              <span>{sizeLabel(file.size)}</span>
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove ${file.name}`}
                onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="attachment-picker__footer">
        <span>{value.length} of {maxFiles} attachments</span>
        <button
          type="button"
          className="secondary-button"
          disabled={hasReachedLimit || remaining <= 0}
          onClick={() => inputRef.current?.click()}
        >
          Add
        </button>
      </div>
    </div>
  );
}
