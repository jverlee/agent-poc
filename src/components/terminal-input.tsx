"use client";

import { useCallback, useRef, useState } from "react";

interface TerminalInputProps {
  machineId: string;
  onSend: (text: string) => void;
}

interface UploadedFile {
  name: string;
  remotePath: string;
}

export default function TerminalInput({ machineId, onSend }: TerminalInputProps) {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasFiles = files.length > 0;
  const expanded = hasFiles || uploading;

  const uploadFile = useCallback(
    async (file: File) => {
      const form = new FormData();
      form.append("machineId", machineId);
      form.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return { name: file.name, remotePath: data.path as string };
    },
    [machineId]
  );

  async function handleFiles(fileList: FileList) {
    setUploading(true);
    try {
      const results = await Promise.all(
        Array.from(fileList).map((f) => uploadFile(f))
      );
      setFiles((prev) => [...prev, ...results]);
    } catch (err) {
      alert(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  function handleSubmit() {
    const filePaths = files.map((f) => f.remotePath);
    const parts: string[] = [];
    if (filePaths.length > 0) {
      parts.push(filePaths.join(" "));
    }
    if (value.trim()) {
      parts.push(value.trim());
    }
    if (parts.length === 0) return;

    onSend(parts.join(" "));
    setValue("");
    setFiles([]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className="relative"
    >
      {/* Drag overlay — always available even when collapsed */}
      {dragOver && (
        <div className="absolute inset-0 z-10 flex items-center justify-center border-2 border-dashed border-blue-500/50 bg-blue-500/10 text-sm text-blue-400">
          Drop files to upload
        </div>
      )}

      {/* Collapsed: subtle drop hint bar */}
      {!expanded && !dragOver && (
        <div className="border-t border-zinc-800 bg-zinc-900/50 px-3 py-1 text-center text-[11px] text-zinc-600">
          Drop files here to attach
        </div>
      )}

      {/* Expanded: file chips + text input */}
      {expanded && (
        <div className="flex flex-col gap-2 border-t border-zinc-700 bg-zinc-900 px-3 py-2">
          {/* Attached files */}
          <div className="flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
              >
                {f.name}
                <button
                  onClick={() => removeFile(i)}
                  className="text-zinc-500 hover:text-zinc-200"
                >
                  x
                </button>
              </span>
            ))}
            {uploading && (
              <span className="text-xs text-zinc-500 animate-pulse">Uploading...</span>
            )}
          </div>

          {/* Input row */}
          {hasFiles && (
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add a message with these files..."
                rows={1}
                className="min-h-[36px] max-h-[120px] flex-1 resize-none rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 outline-none focus:border-zinc-500"
              />
              <button
                onClick={handleSubmit}
                className="shrink-0 rounded-md bg-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-600"
              >
                Send
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
