'use client';

const platformsList = ['facebook', 'instagram', 'youtube', 'twitter', 'mastodon', 'telegram'];

export default function PlatformSelector({ selectedPlatforms, togglePlatform }) {
  const isSelected = (platform) => selectedPlatforms.includes(platform);

  return (
    <aside
      className="w-72 bg-white rounded-lg shadow-sm p-6 border border-gray-200"
      aria-label="Select social media platforms"
    >
      <h2 className="text-2xl font-semibold mb-6 text-gray-800">Select Platforms</h2>
      <ul className="space-y-4">
        {platformsList.map((platform) => (
          <li key={platform}>
            <label className="flex items-center cursor-pointer space-x-3 text-gray-800 font-medium select-none">
              <input
                type="checkbox"
                checked={isSelected(platform)}
                onChange={() => togglePlatform(platform)}
                className="form-checkbox h-5 w-5 text-blue-600"
                aria-checked={isSelected(platform)}
                aria-label={`Select ${platform} platform`}
              />
              <span className="capitalize">{platform}</span>
            </label>
          </li>
        ))}
      </ul>
    </aside>
  );
}
