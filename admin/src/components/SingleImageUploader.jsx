import { useRef, useState } from "react";
import api from "../api/axios";

/**
 * Single-image drag-and-drop / click-to-browse picker - the same Cloudinary upload
 * flow as ImageUploader.jsx (see that file's comment), just for fields that only ever
 * hold one image (e.g. Category.image) instead of an array.
 */
export default function SingleImageUploader({ value, onChange }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const uploadFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }

    setError("");
    setUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append("images", file); // same field name the backend's upload.array expects

    try {
      const { data } = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      onChange(data.urls[0]);
    } catch (err) {
      setError(err.response?.data?.message || "Image upload failed");
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    uploadFile(e.dataTransfer.files[0]);
  };

  const handleFileInput = (e) => {
    uploadFile(e.target.files[0]);
    e.target.value = ""; // allow re-selecting the same file again later
  };

  // Already has an image - show the preview instead of the drop zone, with a way to
  // remove it and go back to the picker (or a coloured-initial fallback tile).
  if (value) {
    return (
      <div className="flex items-center gap-3">
        <img src={value} alt="" className="w-16 h-16 rounded object-cover border border-gray-200" />
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-sm text-red-600 hover:underline"
        >
          Remove image
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg px-4 py-4 text-center cursor-pointer transition-colors ${
          dragActive ? "border-emerald-500 bg-emerald-50" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInput}
          className="hidden"
        />
        <p className="text-sm text-gray-600">
          <span className="text-emerald-700 font-medium">Click to browse</span> or drag and drop an
          image here
        </p>
      </div>

      {uploading && (
        <div className="mt-2">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">Uploading... {progress}%</p>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
