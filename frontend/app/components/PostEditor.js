'use client';

import { useRef, useState } from 'react';
import { uploadToCloudinary } from '../hooks/api/uploadToCloudinary';
import {
  FaFacebookF,
  FaInstagram,
  FaYoutube,
  FaTwitter,
  FaMastodon,
  FaCloudUploadAlt,
  FaTimes,
  FaTelegramPlane,
} from 'react-icons/fa';

const platformsList = ['facebook', 'instagram', 'youtube', 'twitter', 'mastodon', 'telegram'];

const platformIcons = {
  facebook: FaFacebookF,
  instagram: FaInstagram,
  youtube: FaYoutube,
  twitter: FaTwitter,
  mastodon: FaMastodon,
  telegram: FaTelegramPlane,
};

const platformColors = {
  facebook: '#1877F2',
  instagram: '#E4405F',
  youtube: '#FF0000',
  twitter: '#1DA1F2',
  mastodon: '#6364FF',
  telegram: '#229ED9',
};

export default function PostEditor({
  message,
  setMessage,
  mediaFiles,
  setMediaFiles,
  youtubeConfig,
  setYoutubeConfig,
  selectedPlatforms,
  togglePlatform,
  handlePublish,
  isPublishing,
  status,
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState([]);
  const [uploadControllers, setUploadControllers] = useState([]);
  const inputFileRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showProgressBarSection, setShowProgressBarSection] = useState(false);


  const isSelected = (platform) => selectedPlatforms.includes(platform);

  const handleDragOver = (e) => {
    e.preventDefault();
    if (!isPublishing && !uploading) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isPublishing || uploading) return;

    const droppedFiles = Array.from(e.dataTransfer.files);
    const mockEvent = { target: { files: droppedFiles } };
    handleMediaChange(mockEvent);
  };

  const handleMediaChange = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const containsVideo = files.some(file => file.type.startsWith('video/'));
    setShowProgressBarSection(containsVideo);

    setUploading(true);

    const controllers = files.map(() => new AbortController());
    setUploadControllers((prev) => [...prev, ...controllers]);

    try {
      const uploads = await Promise.all(
        files.map((file, index) =>
          uploadToCloudinary(
            file,
            (percent) => {
              setUploadProgress((prev) => {
                const newProgress = [...prev];
                newProgress[index] = percent;
                return newProgress;
              });
            },
            controllers[index].signal
          )
        )
      );

      if (typeof setMediaFiles === 'function') {
        setMediaFiles((prev) => [...(prev || []), ...uploads]);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('Upload canceled');
      } else {
        console.error('Cloudinary upload error:', err);
      }
    } finally {
      setUploading(false);
      setUploadControllers([]);
      setUploadProgress([]);
      setShowProgressBarSection(false);
      if (inputFileRef.current) inputFileRef.current.value = null;
    }
  };

  const cancelUploads = () => {
    uploadControllers.forEach((ctrl) => ctrl.abort());
    setUploading(false);
    setUploadControllers([]);
    setUploadProgress([]);
    setShowProgressBarSection(false);
    if (inputFileRef.current) inputFileRef.current.value = null;
  };

  const removeMediaFile = (index) => {
    if (!setMediaFiles) return;
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const isVideoFile = (url) => /\.(mp4|mov|avi|mkv|wmv|flv|webm)$/i.test(url) || url.includes('video');

  return (
    <section className="flex flex-col h-full">
      <h2 className="text-2xl font-semibold mb-6 text-gray-900">Compose Your Post</h2>

      {/* Platform Selection Section */}
      <div className="mb-6 border-b pb-4 border-gray-200">
        <h3 className="text-lg font-medium text-gray-700 mb-3">Select Platforms</h3>
        <div className="flex flex-wrap items-center gap-4">
          {platformsList.map((platform) => {
            const IconComponent = platformIcons[platform];
            const isPlatformSelected = isSelected(platform);

            return (
              <button
                key={platform}
                onClick={() => togglePlatform(platform)}
                className={`flex items-center justify-center p-3 rounded-lg w-16 h-12 transition-all duration-200 ease-in-out relative
                  ${isPlatformSelected
                    ? 'bg-indigo-500 text-white shadow-lg transform scale-105'
                    : 'bg-gray-100 hover:bg-gray-200'
                  }
                `}
                style={isPlatformSelected ? {} : { color: platformColors[platform] }}
                aria-pressed={isPlatformSelected}
                aria-label={`Toggle ${platform} selection`}
                title={platform.charAt(0).toUpperCase() + platform.slice(1)}
                disabled={isPublishing}
              >
                {IconComponent && <IconComponent className="text-2xl" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Message Textarea */}
      <div className="mb-4">
        <label htmlFor="post-message" className="block text-sm font-medium text-gray-700 mb-1">
          Your Message
        </label>
        <textarea
          id="post-message"
          className="border border-gray-300 rounded p-3 resize-none min-h-[120px] w-full
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     transition-all duration-200"
          placeholder="Write your post message here..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isPublishing || uploading}
        />
      </div>

      {/* Media Previews */}
      {mediaFiles && mediaFiles.length > 0 && (
        <div className="flex flex-wrap gap-4 mt-4 mb-4">
          {mediaFiles.map((url, i) => {
            const isVideo = isVideoFile(url);
            return (
              <div
                key={i}
                className="relative w-28 h-28 rounded shadow overflow-hidden group border border-gray-300"
              >
                {isVideo ? (
                  <video src={url} controls className="w-full h-full object-cover" />
                ) : (
                  <img
                    src={url}
                    alt={`Media preview ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                )}

                <button
                  type="button"
                  onClick={() => removeMediaFile(i)}
                  className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1
                    flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  aria-label={`Remove media file ${i + 1}`}
                >
                  <FaTimes />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Media Upload Section - with Drag & Drop - RESET TO OLD VERSION */}
      <div className="mb-4">
        <label
          htmlFor="media-upload"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 text-gray-600 cursor-pointer {/* Reverted classes */}
            ${isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'} {/* Reverted conditional */}
            ${isPublishing || uploading ? 'opacity-50 cursor-not-allowed' : ''} transition-all duration-200`}
        >
          <FaCloudUploadAlt className="text-3xl mb-2" />
          <p className="font-semibold text-center">Drag & drop your files here, or <span className="text-blue-600 hover:underline">click to upload</span></p> {/* Reverted text */}
          <p className="text-xs text-gray-500 mt-1">(Images or Videos)</p> {/* Reverted text */}
          <input
            id="media-upload"
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            ref={inputFileRef}
            onChange={handleMediaChange}
            disabled={isPublishing || uploading}
          />
        </label>
      </div>

      {/* Upload Progress and Cancel */}
      {uploading && showProgressBarSection && (
        <div className="my-2 space-y-2">
          {uploadProgress.map((percent, i) => (
            <div key={i} className="flex items-center gap-2 w-full">
              <div className="relative w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-indigo-500 h-full rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${percent}%` }}
                  aria-label={`Upload progress for file ${i + 1}`}
                />
              </div>
              <span className="text-xs text-gray-700 font-medium w-10 text-right">{percent}%</span>
            </div>
          ))}
          <button
            type="button"
            onClick={cancelUploads}
            className="mt-2 px-3 py-1 rounded bg-red-500 text-white font-semibold hover:bg-red-600 transition"
          >
            Cancel Uploads
          </button>
        </div>
      )}

      {/* YouTube specific fields only if YouTube is selected */}
      {selectedPlatforms.includes('youtube') && (
        <div className="mt-6 space-y-4 border-t pt-4 border-gray-300">
          <h3 className="text-lg font-medium text-gray-700">YouTube Details</h3>
          <div>
            <label htmlFor="yt-title" className="block font-medium mb-1 text-gray-800">
              YouTube Video Title <span className="text-red-600">*</span>
            </label>
            <input
              id="yt-title"
              type="text"
              value={youtubeConfig.title}
              onChange={(e) =>
                setYoutubeConfig((prev) => ({ ...prev, title: e.target.value }))
              }
              disabled={isPublishing || uploading}
              className="w-full border border-gray-300 rounded p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              placeholder="Enter video title"
              required
            />
          </div>

          <div>
            <label htmlFor="yt-description" className="block font-medium mb-1 text-gray-800">
              YouTube Video Description
            </label>
            <textarea
              id="yt-description"
              value={youtubeConfig.description}
              onChange={(e) =>
                setYoutubeConfig((prev) => ({ ...prev, description: e.target.value }))
              }
              disabled={isPublishing || uploading}
              className="w-full border border-gray-300 rounded p-2 resize-none min-h-[80px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              placeholder="Enter video description"
            />
          </div>
        </div>
      )}

      {/* Publish Button and Status */}
      <div className="mt-6 flex items-center space-x-4">
        <button
          type="button"
          onClick={handlePublish}
          disabled={
            isPublishing || uploading || selectedPlatforms.length === 0 || !message.trim()
          }
          className={`px-6 py-2 rounded font-semibold text-white transition-all duration-200
            ${isPublishing || uploading || selectedPlatforms.length === 0 || !message.trim()
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
            }`}
        >
          {isPublishing ? 'Publishing...' : 'Publish Post'}
        </button>

        {status && (
          <p
            className={`font-medium ${
              status.success ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {status.message}
          </p>
        )}
      </div>
    </section>
  );
}