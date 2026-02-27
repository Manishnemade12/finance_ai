package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/csv-mongo-dreams/backend/middleware"
	"github.com/csv-mongo-dreams/backend/services"
)

type ProfileHandler struct {
	SB *services.SupabaseClient
}

func (h *ProfileHandler) GetProfile(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	jwt := middleware.GetUserJWT(r)

	data, err := h.SB.QuerySingle("profiles", "select=*&user_id=eq."+userID, jwt)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if data == nil {
		jsonError(w, "profile not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func (h *ProfileHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	jwt := middleware.GetUserJWT(r)

	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	allowed := map[string]bool{
		"full_name":       true,
		"employment_type": true,
		"age_group":       true,
		"tax_regime":      true,
		"income_sources":  true,
	}
	update := make(map[string]interface{})
	for k, v := range body {
		if allowed[k] {
			update[k] = v
		}
	}

	result, err := h.SB.Update("profiles", "user_id=eq."+userID, update, jwt)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(result)
}

func (h *ProfileHandler) CompleteOnboarding(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	jwt := middleware.GetUserJWT(r)

	var body struct {
		EmploymentType string   `json:"employment_type"`
		IncomeSources  []string `json:"income_sources"`
		AgeGroup       string   `json:"age_group"`
		TaxRegime      string   `json:"tax_regime"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	profileUpdate := map[string]interface{}{
		"employment_type":      body.EmploymentType,
		"income_sources":       body.IncomeSources,
		"age_group":            body.AgeGroup,
		"tax_regime":           body.TaxRegime,
		"onboarding_completed": true,
	}
	_, err := h.SB.Update("profiles", "user_id=eq."+userID, profileUpdate, jwt)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	finData := map[string]interface{}{
		"user_id":        userID,
		"financial_year": "2025-26",
	}
	h.SB.Insert("financial_data", finData, jwt)

	jsonResponse(w, map[string]interface{}{"success": true})
}
