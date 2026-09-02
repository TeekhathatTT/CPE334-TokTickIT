import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useState } from "react";
const VALID_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".pdf"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
export function AttachmentPicker({ value, onChange, maxFiles = 5 }) {
    const inputRef = useRef(null);
    const [rejected, setRejected] = useState([]);
    const sizeLabel = (bytes) => {
        if (bytes < 1024)
            return `${bytes} B`;
        if (bytes < 1024 * 1024)
            return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };
    const addFiles = (incoming) => {
        const fileList = Array.from(incoming);
        const nextRejected = [];
        const accepted = [];
        fileList.forEach((file) => {
            const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
            const isSupported = VALID_EXTENSIONS.includes(extension);
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
    return (_jsxs("div", { className: "attachment-picker", children: [_jsxs("div", { className: "attachment-dropzone", onClick: () => inputRef.current?.click(), role: "button", tabIndex: 0, onKeyDown: (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        inputRef.current?.click();
                    }
                }, children: [_jsx("input", { ref: inputRef, type: "file", multiple: true, accept: ".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf", hidden: true, onChange: (event) => {
                            if (event.target.files) {
                                addFiles(event.target.files);
                            }
                        } }), _jsx("div", { className: "attachment-dropzone__label", children: "Drag files here or Add" }), _jsxs("div", { className: "attachment-dropzone__count", children: [value.length, " of ", maxFiles, " attachments"] })] }), rejected.length > 0 && (_jsx("div", { className: "attachment-errors", "aria-live": "polite", children: rejected.map((item) => (_jsxs("div", { className: "attachment-error", children: [item.name, " \u2014 ", item.reason] }, `${item.name}-${item.reason}`))) })), value.length > 0 && (_jsx("ul", { className: "attachment-list", children: value.map((file, index) => (_jsxs("li", { className: "attachment-item", children: [_jsx("span", { children: file.name }), _jsx("span", { children: sizeLabel(file.size) }), _jsx("button", { type: "button", className: "icon-button", "aria-label": `Remove ${file.name}`, onClick: () => onChange(value.filter((_, itemIndex) => itemIndex !== index)), children: "\u2715" })] }, `${file.name}-${index}`))) })), _jsxs("div", { className: "attachment-picker__footer", children: [_jsxs("span", { children: [value.length, " of ", maxFiles, " attachments"] }), _jsx("button", { type: "button", className: "secondary-button", disabled: hasReachedLimit || remaining <= 0, onClick: () => inputRef.current?.click(), children: "Add" })] })] }));
}
