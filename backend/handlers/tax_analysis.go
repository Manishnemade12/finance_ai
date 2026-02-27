package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/csv-mongo-dreams/backend/middleware"
	"github.com/csv-mongo-dreams/backend/services"
)

type TaxAnalysisHandler struct {
	SB *services.SupabaseClient
}

func (h *TaxAnalysisHandler) GetAnalysis(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	jwt := middleware.GetUserJWT(r)

	data, err := h.SB.QuerySingle("tax_analyses", "select=*&user_id=eq."+userID+"&financial_year=eq.2025-26", jwt)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if data == nil {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("null"))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func (h *TaxAnalysisHandler) RunAnalysis(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	jwt := middleware.GetUserJWT(r)

	var body struct {
		FinancialData map[string]interface{} `json:"financialData"`
		Profile       map[string]interface{} `json:"profile"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	// Save financial data first
	if body.FinancialData != nil {
		finUpdate := make(map[string]interface{})
		for k, v := range body.FinancialData {
			if k != "id" && k != "user_id" && k != "created_at" && k != "updated_at" {
				finUpdate[k] = v
			}
		}
		h.SB.Update("financial_data", "user_id=eq."+userID+"&financial_year=eq.2025-26", finUpdate, jwt)
	}

	// Call the tax-analysis edge function (which has the Lovable API key)
	edgeFnBody := map[string]interface{}{
		"financialData": body.FinancialData,
		"profile":       body.Profile,
	}
	result, err := h.SB.InvokeEdgeFunction("tax-analysis", edgeFnBody, jwt)
	if err != nil {
		jsonError(w, "analysis failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Parse result to return to frontend
	var resultData map[string]interface{}
	json.Unmarshal(result, &resultData)

	jsonResponse(w, map[string]interface{}{"success": true, "data": resultData})
}
