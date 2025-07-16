package controllers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"

	"social-sync-backend/lib"
	"social-sync-backend/middleware"
)

type TelegramPostRequest struct {
	Message   string   `json:"message"`
	MediaUrls []string `json:"mediaUrls"`
}

// POST /api/telegram/post
func PostToTelegram(w http.ResponseWriter, r *http.Request) {
	userID, err := middleware.GetUserIDFromContext(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req TelegramPostRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Message == "" && len(req.MediaUrls) == 0 {
		http.Error(w, "Message or media required", http.StatusBadRequest)
		return
	}

	db := lib.GetDB()
	var chatID string
	err = db.QueryRow(`SELECT access_token FROM social_accounts WHERE user_id = $1 AND platform = 'telegram'`, userID).Scan(&chatID)
	if err == sql.ErrNoRows {
		http.Error(w, "Telegram not connected", http.StatusBadRequest)
		return
	} else if err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	if botToken == "" {
		http.Error(w, "Telegram bot token not set", http.StatusInternalServerError)
		return
	}

	results := []map[string]interface{}{}

	// Helper to send a POST to Telegram API
	sendToTelegram := func(api string, payload map[string]interface{}) (int, []byte, error) {
		apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/%s", botToken, api)
		body, _ := json.Marshal(payload)
		resp, err := http.Post(apiURL, "application/json", bytes.NewBuffer(body))
		if err != nil {
			return 0, nil, err
		}
		defer resp.Body.Close()
		respBody, _ := ioutil.ReadAll(resp.Body)
		return resp.StatusCode, respBody, nil
	}

	// Separate media into images and videos
	var images, videos []string
	for _, url := range req.MediaUrls {
		if isImage(url) {
			images = append(images, url)
		} else if isVideo(url) {
			videos = append(videos, url)
		}
	}

	// If multiple images and no videos, use sendMediaGroup
	if len(images) > 1 && len(videos) == 0 {
		media := []map[string]interface{}{}
		for i, url := range images {
			item := map[string]interface{}{
				"type":  "photo",
				"media": url,
			}
			if i == 0 && req.Message != "" {
				item["caption"] = req.Message
				item["parse_mode"] = "HTML"
			}
			media = append(media, item)
		}
		payload := map[string]interface{}{
			"chat_id": chatID,
			"media":   media,
		}
		status, respBody, err := sendToTelegram("sendMediaGroup", payload)
		results = append(results, map[string]interface{}{"type": "media_group", "status": status, "response": string(respBody), "error": err})
	} else {
		// Send each image as photo
		for _, url := range images {
			payload := map[string]interface{}{
				"chat_id":    chatID,
				"photo":      url,
				"caption":    req.Message,
				"parse_mode": "HTML",
			}
			status, respBody, err := sendToTelegram("sendPhoto", payload)
			results = append(results, map[string]interface{}{"type": "photo", "status": status, "response": string(respBody), "error": err})
		}
	}

	// Send each video as video
	for _, url := range videos {
		payload := map[string]interface{}{
			"chat_id":    chatID,
			"video":      url,
			"caption":    req.Message,
			"parse_mode": "HTML",
		}
		status, respBody, err := sendToTelegram("sendVideo", payload)
		results = append(results, map[string]interface{}{"type": "video", "status": status, "response": string(respBody), "error": err})
	}

	// If no media, or if message is present and no media sent, send as text
	if len(req.MediaUrls) == 0 {
		payload := map[string]interface{}{
			"chat_id":    chatID,
			"text":       req.Message,
			"parse_mode": "HTML",
		}
		status, respBody, err := sendToTelegram("sendMessage", payload)
		results = append(results, map[string]interface{}{"type": "text", "status": status, "response": string(respBody), "error": err})
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Message sent to Telegram channel!",
		"results": results,
	})
}

// Helper functions to check file type
func isImage(url string) bool {
	return hasAnySuffix(url, ".jpg", ".jpeg", ".png", ".gif", ".webp")
}

func isVideo(url string) bool {
	return hasAnySuffix(url, ".mp4", ".mov", ".avi", ".mkv", ".wmv", ".flv", ".webm")
}

func hasAnySuffix(url string, suffixes ...string) bool {
	for _, s := range suffixes {
		if len(url) >= len(s) && url[len(url)-len(s):] == s {
			return true
		}
	}
	return false
}
