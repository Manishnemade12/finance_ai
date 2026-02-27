package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/csv-mongo-dreams/backend/middleware"
	"github.com/csv-mongo-dreams/backend/services"
)

type FinancialHandler struct {
	SB *services.SupabaseClient
}

func (h *FinancialHandler) GetFinancialData(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	jwt := middleware.GetUserJWT(r)

	data, err := h.SB.QuerySingle("financial_data", "select=*&user_id=eq."+userID+"&financial_year=eq.2025-26", jwt)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if data == nil {
		newData := map[string]interface{}{
			"user_id":        userID,
			"financial_year": "2025-26",
		}
		result, err := h.SB.Insert("financial_data", newData, jwt)
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		var arr []json.RawMessage
		if json.Unmarshal(result, &arr) == nil && len(arr) > 0 {
			w.Write(arr[0])
		} else {
			w.Write(result)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func (h *FinancialHandler) UpdateFinancialData(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	jwt := middleware.GetUserJWT(r)

	var body map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	delete(body, "id")
	delete(body, "user_id")
	delete(body, "created_at")
	delete(body, "updated_at")

	result, err := h.SB.Update("financial_data", "user_id=eq."+userID+"&financial_year=eq.2025-26", body, jwt)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(result)
}
