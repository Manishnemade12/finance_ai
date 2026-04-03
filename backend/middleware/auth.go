package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/csv-mongo-dreams/backend/services"
)

type contextKey string

const (
	UserIDKey   contextKey = "user_id"
	EmailKey    contextKey = "email"
	UserJWTKey  contextKey = "user_jwt"
)

// Auth middleware validates the Supabase JWT and injects user info + token into context.
func Auth(sb *services.SupabaseClient) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				fmt.Println("❌ AUTH: Missing Authorization header")
				http.Error(w, `{"error":"missing authorization header"}`, http.StatusUnauthorized)
				return
			}

			token := strings.TrimPrefix(authHeader, "Bearer ")
			if token == authHeader {
				fmt.Println("❌ AUTH: Invalid Bearer format")
				http.Error(w, `{"error":"invalid authorization format"}`, http.StatusUnauthorized)
				return
			}

			fmt.Println("🔐 AUTH: Validating token with Supabase...")
			userID, email, err := sb.ValidateToken(token)
			if err != nil {
				fmt.Printf("❌ AUTH ERROR: %v\n", err)
				http.Error(w, `{"error":"unauthorized: `+err.Error()+`"}`, http.StatusUnauthorized)
				return
			}

			fmt.Printf("✅ AUTH SUCCESS: User %s (%s)\n", userID, email)
			ctx := context.WithValue(r.Context(), UserIDKey, userID)
			ctx = context.WithValue(ctx, EmailKey, email)
			ctx = context.WithValue(ctx, UserJWTKey, token)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetUserID extracts the user ID from the request context.
func GetUserID(r *http.Request) string {
	v, _ := r.Context().Value(UserIDKey).(string)
	return v
}

// GetEmail extracts the email from the request context.
func GetEmail(r *http.Request) string {
	v, _ := r.Context().Value(EmailKey).(string)
	return v
}

// GetUserJWT extracts the raw JWT token from the request context.
func GetUserJWT(r *http.Request) string {
	v, _ := r.Context().Value(UserJWTKey).(string)
	return v
}
