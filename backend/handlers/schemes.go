package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/csv-mongo-dreams/backend/middleware"
	"github.com/csv-mongo-dreams/backend/services"
)

type SchemesHandler struct {
	SB *services.SupabaseClient
}

func (h *SchemesHandler) GetSchemes(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	jwt := middleware.GetUserJWT(r)

	data, err := h.SB.QuerySingle("tax_analyses", "select=scheme_recommendations&user_id=eq."+userID+"&financial_year=eq.2025-26", jwt)
	if err != nil || data == nil {
		jsonResponse(w, map[string]interface{}{"schemes": nil})
		return
	}

	var result struct {
		SchemeRecommendations json.RawMessage `json:"scheme_recommendations"`
	}
	json.Unmarshal(data, &result)

	jsonResponse(w, map[string]interface{}{"schemes": result.SchemeRecommendations})
}

func (h *SchemesHandler) GetPersonalized(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	jwt := middleware.GetUserJWT(r)

	// Get financial data and profile
	finData, _ := h.SB.QuerySingle("financial_data", "select=*&user_id=eq."+userID+"&financial_year=eq.2025-26", jwt)
	profileData, _ := h.SB.QuerySingle("profiles", "select=*&user_id=eq."+userID, jwt)

	var fin, profile map[string]interface{}
	if finData != nil {
		json.Unmarshal(finData, &fin)
	} else {
		fin = map[string]interface{}{}
	}
	if profileData != nil {
		json.Unmarshal(profileData, &profile)
	} else {
		profile = map[string]interface{}{}
	}

	// Call the tax-analysis edge function for personalized schemes
	edgeFnBody := map[string]interface{}{
		"financialData": fin,
		"profile":       profile,
	}
	result, err := h.SB.InvokeEdgeFunction("tax-analysis", edgeFnBody, jwt)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var resultData map[string]interface{}
	json.Unmarshal(result, &resultData)

	jsonResponse(w, map[string]interface{}{
		"schemes": resultData["scheme_recommendations"],
		"data":    resultData,
	})
}
