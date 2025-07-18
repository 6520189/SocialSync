package controllers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"social-sync-backend/middleware"
)

type FacebookPostRequest struct {
	Message    string   `json:"message"`
	MediaUrls  []string `json:"mediaUrls"`
}

func PostToFacebookHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID, err := middleware.GetUserIDFromContext(r)
		if err != nil {
			http.Error(w, "Unauthorized: User not authenticated", http.StatusUnauthorized)
			return
		}

		var req FacebookPostRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid JSON body", http.StatusBadRequest)
			return
		}

		if strings.TrimSpace(req.Message) == "" {
			http.Error(w, "Message cannot be empty", http.StatusBadRequest)
			return
		}

		var accessToken, pageID string
		err = db.QueryRow(`
			SELECT access_token, social_id
			FROM social_accounts
			WHERE user_id = $1 AND platform = 'facebook'`,
			userID).Scan(&accessToken, &pageID)
		if err != nil {
			http.Error(w, "Facebook Page not connected", http.StatusBadRequest)
			return
		}

		urlEncode := func(s string) string {
			return url.QueryEscape(s)
		}

		// CASE 1: Text only
		if len(req.MediaUrls) == 0 {
			postURL := fmt.Sprintf("https://graph.facebook.com/%s/feed", pageID)
			payload := strings.NewReader(fmt.Sprintf("message=%s&access_token=%s", urlEncode(req.Message), urlEncode(accessToken)))

			resp, err := http.Post(postURL, "application/x-www-form-urlencoded", payload)
			if err != nil {
				http.Error(w, "Failed to publish text post", http.StatusInternalServerError)
				return
			}
			defer resp.Body.Close()

			body, _ := io.ReadAll(resp.Body)
			if resp.StatusCode != http.StatusOK {
				http.Error(w, fmt.Sprintf("Facebook API error: %s", body), http.StatusInternalServerError)
				return
			}

			w.WriteHeader(http.StatusOK)
			w.Write([]byte("Text post published successfully"))
			return
		}

		// Separate images and videos
		var imageUrls, videoUrls []string
		for _, url := range req.MediaUrls {
			if strings.Contains(url, ".mp4") || strings.Contains(url, "/video/") {
				videoUrls = append(videoUrls, url)
			} else {
				imageUrls = append(imageUrls, url)
			}
		}

		// CASE 2: Single video only
		if len(videoUrls) > 0 && len(imageUrls) == 0 {
			if len(videoUrls) > 1 {
				http.Error(w, "Facebook only supports posting one video at a time", http.StatusBadRequest)
				return
			}

			videoURL := fmt.Sprintf("https://graph.facebook.com/%s/videos", pageID)
			payload := strings.NewReader(fmt.Sprintf("file_url=%s&description=%s&access_token=%s",
				urlEncode(videoUrls[0]), urlEncode(req.Message), urlEncode(accessToken)))

			resp, err := http.Post(videoURL, "application/x-www-form-urlencoded", payload)
			if err != nil {
				http.Error(w, "Failed to upload video", http.StatusInternalServerError)
				return
			}
			defer resp.Body.Close()

			body, _ := io.ReadAll(resp.Body)
			if resp.StatusCode != http.StatusOK {
				http.Error(w, fmt.Sprintf("Facebook video upload failed: %s", body), http.StatusInternalServerError)
				return
			}

			w.WriteHeader(http.StatusOK)
			w.Write([]byte("Video post published successfully"))
			return
		}

		// CASE 3: Multiple images only
		if len(imageUrls) > 0 && len(videoUrls) == 0 {
			var attachedMediaIDs []string

			for _, mediaURL := range imageUrls {
				uploadURL := fmt.Sprintf("https://graph.facebook.com/%s/photos?access_token=%s", pageID, urlEncode(accessToken))
				payload := fmt.Sprintf("url=%s&published=false", urlEncode(mediaURL))

				resp, err := http.Post(uploadURL, "application/x-www-form-urlencoded", strings.NewReader(payload))
				if err != nil {
					http.Error(w, "Failed to upload image", http.StatusInternalServerError)
					return
				}
				body, _ := io.ReadAll(resp.Body)
				resp.Body.Close()

				if resp.StatusCode != http.StatusOK {
					http.Error(w, fmt.Sprintf("Image upload failed: %s", body), http.StatusInternalServerError)
					return
				}

				var fbRes struct {
					ID string `json:"id"`
				}
				if err := json.Unmarshal(body, &fbRes); err != nil || fbRes.ID == "" {
					http.Error(w, "Failed to parse media ID", http.StatusInternalServerError)
					return
				}
				attachedMediaIDs = append(attachedMediaIDs, fbRes.ID)
			}

			// Post with attached images
			var mediaParams []string
			for i, id := range attachedMediaIDs {
				mediaParams = append(mediaParams, fmt.Sprintf(`attached_media[%d]={"media_fbid":"%s"}`, i, id))
			}

			postURL := fmt.Sprintf("https://graph.facebook.com/%s/feed", pageID)
			finalPayload := fmt.Sprintf(
				"message=%s&%s&access_token=%s",
				urlEncode(req.Message),
				strings.Join(mediaParams, "&"),
				urlEncode(accessToken),
			)

			resp, err := http.Post(postURL, "application/x-www-form-urlencoded", strings.NewReader(finalPayload))
			if err != nil {
				http.Error(w, "Failed to publish image post", http.StatusInternalServerError)
				return
			}
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				http.Error(w, fmt.Sprintf("Post failed: %s", body), http.StatusInternalServerError)
				return
			}

			w.WriteHeader(http.StatusOK)
			w.Write([]byte("Image post published successfully"))
			return
		}

		// CASE 4: Mixed media not supported
		http.Error(w, "Facebook does not support mixed image and video posts", http.StatusBadRequest)
	}
}
