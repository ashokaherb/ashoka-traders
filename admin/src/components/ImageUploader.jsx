import { useRef, useState } from "react";
import api from "../api/axios";
import { getCloudinaryThumbnail } from "../utils/cloudinary";

/**
 * Drag-and-drop / click-to-browse product image picker.
 *
 * Each file goes straight to Cloudinary via POST /api/upload (see backend/middleware/
 * cloudinaryUpload.js, which resizes to max 1000px wide and lets Cloudinary pick the
 * best format/compression) - this component only ever deals with the URLs that come
 * back, which is exactly what Product.images stores. ProductForm owns the actual
 * `images` array as state; this is a controlled component over it (same pattern as
 * the variants list below it).
 */
export default function ImageUploader({ images, onImagesChange }) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const inputRef = useRef(null);
  // Which thumbnail a reorder-drag started on. A ref (not state) because drag events
  // fire rapidly and don't need a re-render of their own.
  const dragIndexRef = useRef(null);

  const uploadFiles = async (fileList) => {
    const files = [...fileList].filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) {
      setError("Please choose image files only");
      return;
    }

    setError("");
    setUploading(true);
    setProgress(0);

    // One request, all files under the same "images" field - matches
    // upload.array("images", 6) on the backend.
    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));

    try {
      const { data } = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      onImagesChange([...images, ...data.urls]);
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
    uploadFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e) => {
    uploadFiles(e.target.files);
    e.target.value = ""; // allow re-selecting the same file(s) again later
  };

  const removeImage = (index) => {
    onImagesChange(images.filter((_, i) => i !== index));
  };

  // Reordering: drag a thumbnail and drop it on another to swap its position.
  // Plain HTML5 drag-and-drop - no library needed for something this small.
  const handleThumbDrop = (index) => (e) => {
    e.preventDefault();
    e.stopPropagation(); // don't also trigger the drop-zone's own onDrop below
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from === null || from === index) return;

    const next = [...images];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    onImagesChange(next);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Product Images</label>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg px-4 py-6 text-center cursor-pointer transition-colors ${
          dragActive ? "border-emerald-500 bg-emerald-50" : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInput}
          className="hidden"
        />
        <p className="text-sm text-gray-600">
          <span className="text-emerald-700 font-medium">Click to browse</span> or drag and drop
          images here
        </p>
        <p className="text-xs text-gray-400 mt-1">Up to 6 at a time, 5MB each</p>
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

      {images.length > 0 && (
        <>
          <div className="flex flex-wrap gap-3 mt-3">
            {images.map((url, index) => (
              <div
                key={url + index}
                draggable
                onDragStart={() => {
                  dragIndexRef.current = index;
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleThumbDrop(index)}
                className="relative w-20 h-20 rounded border border-gray-200 overflow-hidden bg-gray-50 cursor-move"
                title="Drag to reorder"
              >
                <img src={getCloudinaryThumbnail(url, 160)} alt="" className="w-full h-full object-cover" />
                {index === 0 && (
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] text-center py-0.5">
                    Primary
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  aria-label="Remove image"
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 text-white text-xs leading-none flex items-center justify-center hover:bg-red-600"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Drag thumbnails to reorder - the first image is used as the product's main photo.
          </p>
        </>
      )}
    </div>
  );
}
