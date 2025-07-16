export function useMultiPlatformPublish({ message, mediaFiles, youtubeConfig }) {
  const publish = async (platforms) => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      return platforms.map((p) => ({
        platform: p,
        success: false,
        error: 'Missing token',
      }));
    }

    const results = [];

    for (const platform of platforms) {
      try {
        let res;

        switch (platform) {
          case 'facebook':
            // Facebook expects JSON: { message, mediaUrls: [...] }
            res = await fetch('http://localhost:8080/api/facebook/post', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ message, mediaUrls: mediaFiles }),
            });
            break;

          case 'instagram':
            // Instagram expects JSON: { caption, mediaUrls: [...] }
            res = await fetch('http://localhost:8080/api/instagram/post', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ caption: message, mediaUrls: mediaFiles }),
            });
            break;

          case 'twitter':
            res = await fetch('http://localhost:8080/api/twitter/post', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ message }),
            });
            break;

          case 'youtube':
            if (!mediaFiles || mediaFiles.length === 0) {
              results.push({ platform, success: false, error: 'No video file provided' });
              continue;
            }

            const formData = new FormData();
            formData.append('video', await fetch(mediaFiles[0]).then((r) => r.blob()), 'video.mp4');
            formData.append('title', youtubeConfig.title || '');
            formData.append('description', youtubeConfig.description || '');
            formData.append('tags', youtubeConfig.tags?.join(',') || '');
            formData.append('privacy', youtubeConfig.privacy || 'private');
            formData.append('category_id', youtubeConfig.categoryId || '22');

            res = await fetch('http://localhost:8080/api/youtube/post', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: formData,
            });
            break;

          case 'mastodon': {
            // Mastodon expects multipart form with 'message' and 'images[]'
            const formData = new FormData();
            formData.append('message', message);
            formData.append('visibility', 'public'); // or dynamically

            for (let i = 0; i < Math.min(mediaFiles.length, 4); i++) {
              const blob = await fetch(mediaFiles[i]).then((r) => r.blob());
              formData.append('images', blob, `image${i}.jpg`);
            }

            res = await fetch('http://localhost:8080/api/mastodon/post', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: formData,
            });
            break;
          }

          case 'telegram':
            res = await fetch('http://localhost:8080/api/telegram/post', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ message, mediaUrls: mediaFiles }),
            });
            break;

          default:
            results.push({ platform, success: false, error: 'Unsupported platform' });
            continue;
        }

        const responseData = await res.json().catch(() => ({}));

        if (!res.ok) {
          results.push({
            platform,
            success: false,
            error: responseData?.error || res.statusText || 'Unknown error',
          });
        } else {
          results.push({ platform, success: true, data: responseData });
        }
      } catch (err) {
        results.push({ platform, success: false, error: err.message });
      }
    }

    return results;
  };

  return { publish };
}
