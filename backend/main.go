package main

import (
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/csv-mongo-dreams/backend/handlers"
	mw "github.com/csv-mongo-dreams/backend/middleware"
	"github.com/csv-mongo-dreams/backend/services"
	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env file (ignore error if not present, e.g. in production)
	godotenv.Load()

	// Initialize services
	sb := services.NewSupabaseClient()

	// Initialize handlers
	profileH := &handlers.ProfileHandler{SB: sb}
	documentsH := &handlers.DocumentsHandler{SB: sb}
	financialH := &handlers.FinancialHandler{SB: sb}
	taxAnalysisH := &handlers.TaxAnalysisHandler{SB: sb}
	taxBuddyH := &handlers.TaxBuddyHandler{}
	dashboardH := &handlers.DashboardHandler{SB: sb}
	schemesH := &handlers.SchemesHandler{SB: sb}

	// Setup router
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RealIP)
	r.Use(cors.Handler(cors.Options{
		AllowOriginFunc: func(r *http.Request, origin string) bool {
			// Allow all localhost origins (any port) and the configured FRONTEND_URL
			if strings.HasPrefix(origin, "http://localhost") || strings.HasPrefix(origin, "http://127.0.0.1") {
				return true
			}
			frontendURL := os.Getenv("FRONTEND_URL")
			return frontendURL != "" && origin == frontendURL
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Health check (public)
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Protected API routes
	r.Route("/api", func(r chi.Router) {
		r.Use(mw.Auth(sb))

		// Profile
		r.Get("/profile", profileH.GetProfile)
		r.Put("/profile", profileH.UpdateProfile)
		r.Post("/onboarding/complete", profileH.CompleteOnboarding)

		// Documents
		r.Get("/documents", documentsH.List)
		r.Post("/documents/upload", documentsH.Upload)
		r.Delete("/documents/{id}", documentsH.Delete)
		r.Post("/documents/{id}/analyze", documentsH.Analyze)

		// Financial Data
		r.Get("/financial-data", financialH.GetFinancialData)
		r.Put("/financial-data", financialH.UpdateFinancialData)

		// Tax Analysis
		r.Get("/tax-analysis", taxAnalysisH.GetAnalysis)
		r.Post("/tax-analysis/run", taxAnalysisH.RunAnalysis)
		r.Post("/taxbuddy/strategy", taxBuddyH.GenerateStrategy)

		// Dashboard
		r.Get("/dashboard/stats", dashboardH.GetStats)

		// Schemes
		r.Get("/schemes", schemesH.GetSchemes)
		r.Post("/schemes/personalized", schemesH.GetPersonalized)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 TaxSathi Backend running on :%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
