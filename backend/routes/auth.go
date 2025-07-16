package routes

import (
	"net/http"
	"social-sync-backend/controllers"
	"social-sync-backend/lib"
	"social-sync-backend/middleware"

	"github.com/gorilla/mux"
)

// AuthRoutes configures authentication and social routes
func AuthRoutes(r *mux.Router) {
	// ----------- Auth ----------- //
	r.HandleFunc("/api/register", controllers.SignupHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/auth/login", controllers.LoginHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/auth/refresh", controllers.RefreshTokenHandler).Methods("POST", "OPTIONS")
	r.HandleFunc("/api/auth/verify", controllers.VerifyEmailHandler).Methods("POST")

	// ----------- Google OAuth ----------- //
	r.HandleFunc("/auth/google/login", controllers.GoogleRedirectHandler()).Methods("GET")
	r.HandleFunc("/auth/google/callback", controllers.GoogleCallbackHandler(lib.DB)).Methods("GET")

	// ----------- Facebook OAuth ----------- //
	r.Handle("/auth/facebook/login", middleware.EnableCORS(middleware.JWTMiddleware(
		http.HandlerFunc(controllers.FacebookRedirectHandler()),
	))).Methods("GET")
	r.HandleFunc("/auth/facebook/callback", controllers.FacebookCallbackHandler(lib.DB)).Methods("GET")
	r.Handle("/api/facebook/post", middleware.JWTMiddleware(
		http.HandlerFunc(controllers.PostToFacebookHandler(lib.DB)),
	)).Methods("POST")

	// ----------- Instagram Oauth ----------- //
	r.Handle("/connect/instagram", middleware.JWTMiddleware(
		http.HandlerFunc(controllers.ConnectInstagramHandler(lib.DB)),
	)).Methods("POST")
	r.Handle("/api/instagram/post", middleware.JWTMiddleware(
		http.HandlerFunc(controllers.PostToInstagramHandler(lib.DB)),
	)).Methods("POST")

	// ----------- YouTube Oauth ----------- //
	r.Handle("/auth/youtube/login", middleware.EnableCORS(middleware.JWTMiddleware(
		http.HandlerFunc(controllers.YouTubeRedirectHandler()),
	))).Methods("GET")
	r.HandleFunc("/auth/youtube/callback", controllers.YouTubeCallbackHandler(lib.DB)).Methods("GET")
	r.Handle("/api/youtube/post", middleware.JWTMiddleware(
		http.HandlerFunc(controllers.PostToYouTubeHandler(lib.DB)),
	)).Methods("POST")

	// ----------- Twitter Oauth (X) ----------- //
	r.Handle("/auth/twitter/login", middleware.EnableCORS(middleware.JWTMiddleware(
		http.HandlerFunc(controllers.TwitterRedirectHandler()),
	))).Methods("GET")
	r.HandleFunc("/auth/twitter/callback", controllers.TwitterCallbackHandler(lib.DB)).Methods("GET")
	r.Handle("/api/twitter/post", middleware.JWTMiddleware(
		http.HandlerFunc(controllers.PostToTwitterHandler(lib.DB)),
	)).Methods("POST")

	// ----------- TikTok Upload ----------- //
	// r.Handle("/api/tiktok/post", middleware.JWTMiddleware(
	// 	http.HandlerFunc(controllers.PostToTikTokHandler(lib.DB)),
	// )).Methods("POST")

	// ----------- Mastodon OAuth ----------- //
	r.Handle("/auth/mastodon/login", middleware.EnableCORS(middleware.JWTMiddleware(
		http.HandlerFunc(controllers.MastodonRedirectHandler()),
	))).Methods("GET")
	r.HandleFunc("/auth/mastodon/callback", controllers.MastodonCallbackHandler(lib.DB)).Methods("GET")
	r.Handle("/api/mastodon/post", middleware.JWTMiddleware(
		http.HandlerFunc(controllers.PostToMastodonHandler(lib.DB)),
	)).Methods("POST")

	// ----------- Telegram Connect ----------- //
	r.Handle("/connect/telegram", middleware.JWTMiddleware(
		http.HandlerFunc(controllers.ConnectTelegram),
	)).Methods("POST")

	r.Handle("/api/telegram/post", middleware.JWTMiddleware(
		http.HandlerFunc(controllers.PostToTelegram),
	)).Methods("POST")
	
	// ----------- Social Account Management ----------- //
	r.Handle("/api/social-accounts", middleware.EnableCORS(middleware.JWTMiddleware(
		http.HandlerFunc(controllers.GetSocialAccountsHandler(lib.DB)),
	))).Methods("GET")
	r.Handle("/api/social-accounts/{platform}", middleware.EnableCORS(middleware.JWTMiddleware(
		http.HandlerFunc(controllers.DisconnectSocialAccountHandler(lib.DB)),
	))).Methods("DELETE")

}
