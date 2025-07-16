package controllers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"social-sync-backend/lib"
	"social-sync-backend/middleware"
)

type TelegramConnectRequest struct {
	ChatID string `json:"chat_id"`
}

// POST /connect/telegram
func ConnectTelegram(w http.ResponseWriter, r *http.Request) {
	log.Printf("[Telegram] ConnectTelegram called")
	userID, err := middleware.GetUserIDFromContext(r)
	if err != nil {
		log.Printf("[Telegram] Unauthorized: %v", err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	log.Printf("[Telegram] userID: %v", userID)

	var req TelegramConnectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("[Telegram] Invalid request body: %v", err)
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	log.Printf("[Telegram] Received chat_id: %v", req.ChatID)

	if req.ChatID == "" {
		log.Printf("[Telegram] chat_id is required")
		http.Error(w, "chat_id is required", http.StatusBadRequest)
		return
	}

	db := lib.GetDB()
	var id string
	err = db.QueryRow(`SELECT id FROM social_accounts WHERE user_id = $1 AND platform = 'telegram'`, userID).Scan(&id)
	now := time.Now()

	// Fetch channel info from Telegram API
	botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	if botToken == "" {
		log.Printf("[Telegram] TELEGRAM_BOT_TOKEN not set")
		http.Error(w, "Telegram bot token not set", http.StatusInternalServerError)
		return
	}

	getChatURL := fmt.Sprintf("https://api.telegram.org/bot%s/getChat?chat_id=%s", botToken, req.ChatID)
	resp, err := http.Get(getChatURL)
	if err != nil {
		log.Printf("[Telegram] Failed to call getChat: %v", err)
		http.Error(w, "Failed to fetch channel info from Telegram", http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()
	var chatResp struct {
		Ok     bool `json:"ok"`
		Result struct {
			Photo *struct {
				BigFileID   string `json:"big_file_id"`
				SmallFileID string `json:"small_file_id"`
			} `json:"photo"`
			Title string `json:"title"`
		} `json:"result"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&chatResp); err != nil {
		log.Printf("[Telegram] Failed to decode getChat response: %v", err)
	}

	var profilePicURL *string
	if chatResp.Ok && chatResp.Result.Photo != nil {
		// Prefer big_file_id
		fileID := chatResp.Result.Photo.BigFileID
		if fileID == "" {
			fileID = chatResp.Result.Photo.SmallFileID
		}
		if fileID != "" {
			getFileURL := fmt.Sprintf("https://api.telegram.org/bot%s/getFile?file_id=%s", botToken, fileID)
			fileResp, err := http.Get(getFileURL)
			if err == nil {
				defer fileResp.Body.Close()
				var fileData struct {
					Ok     bool `json:"ok"`
					Result struct {
						FilePath string `json:"file_path"`
					} `json:"result"`
				}
				if err := json.NewDecoder(fileResp.Body).Decode(&fileData); err == nil && fileData.Ok {
					url := fmt.Sprintf("https://api.telegram.org/file/bot%s/%s", botToken, fileData.Result.FilePath)
					profilePicURL = &url
				}
			}
		}
	}

	var channelTitle *string
	if chatResp.Ok {
		if t := chatResp.Result.Title; t != "" {
			channelTitle = &t
		}
	}

	if err == sql.ErrNoRows || id == "" {
		log.Printf("[Telegram] No existing Telegram social account, inserting new record")
		_, err = db.Exec(`INSERT INTO social_accounts (user_id, platform, social_id, access_token, connected_at, profile_picture_url, profile_name) VALUES ($1, 'telegram', $2, $2, $3, $4, $5)`, userID, req.ChatID, now, profilePicURL, channelTitle)
		if err != nil {
			log.Printf("[Telegram] Failed to connect Telegram (insert): %v", err)
			http.Error(w, "Failed to connect Telegram", http.StatusInternalServerError)
			return
		}
	} else if err == nil {
		log.Printf("[Telegram] Existing Telegram social account found, updating record")
		_, err = db.Exec(`UPDATE social_accounts SET access_token = $1, connected_at = $2, profile_picture_url = $3, profile_name = $4 WHERE id = $5`, req.ChatID, now, profilePicURL, channelTitle, id)
		if err != nil {
			log.Printf("[Telegram] Failed to update Telegram connection: %v", err)
			http.Error(w, "Failed to update Telegram connection", http.StatusInternalServerError)
			return
		}
	} else {
		log.Printf("[Telegram] Database error: %v", err)
		http.Error(w, "Database error", http.StatusInternalServerError)
		return
	}

	log.Printf("[Telegram] Telegram group connected successfully!")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"message": "Telegram group connected successfully!"}`))
}
