package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/csv-mongo-dreams/backend/middleware"
	"github.com/csv-mongo-dreams/backend/services"
)

type DashboardHandler struct {
	SB *services.SupabaseClient
}

func (h *DashboardHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	jwt := middleware.GetUserJWT(r)

	docCount, _ := h.SB.Count("documents", "user_id=eq."+userID, jwt)
	finData, _ := h.SB.QuerySingle("financial_data", "select=*&user_id=eq."+userID+"&financial_year=eq.2025-26", jwt)
	analysisData, _ := h.SB.QuerySingle("tax_analyses", "select=*&user_id=eq."+userID+"&financial_year=eq.2025-26", jwt)

	var totalIncome, estimatedTax, savings float64

	if finData != nil {
		var fin map[string]interface{}
		json.Unmarshal(finData, &fin)
		totalIncome = toFloat(fin["gross_salary"]) + toFloat(fin["other_income"]) + toFloat(fin["rental_income"]) + toFloat(fin["interest_income"]) + toFloat(fin["business_income"])
	}

	if analysisData != nil {
		var analysis map[string]interface{}
		json.Unmarshal(analysisData, &analysis)
		oldTax := toFloat(analysis["old_regime_tax"])
		newTax := toFloat(analysis["new_regime_tax"])
		if oldTax < newTax {
			estimatedTax = oldTax
		} else {
			estimatedTax = newTax
		}
		if oldTax > newTax {
			savings = oldTax - newTax
		} else {
			savings = newTax - oldTax
		}
	}

	jsonResponse(w, map[string]interface{}{
		"documents":    docCount,
		"totalIncome":  totalIncome,
		"estimatedTax": estimatedTax,
		"savings":      savings,
		"incomeData":   buildIncomeData(finData),
	})
}

func toFloat(v interface{}) float64 {
	switch n := v.(type) {
	case float64:
		return n
	case json.Number:
		f, _ := n.Float64()
		return f
	default:
		return 0
	}
}

func buildIncomeData(finData json.RawMessage) []map[string]interface{} {
	if finData == nil {
		return nil
	}
	var fin map[string]interface{}
	json.Unmarshal(finData, &fin)

	items := []struct {
		name string
		key  string
	}{
		{"Salary", "gross_salary"},
		{"Rental", "rental_income"},
		{"Interest", "interest_income"},
		{"Other", "other_income"},
		{"Business", "business_income"},
	}

	var result []map[string]interface{}
	for _, item := range items {
		val := toFloat(fin[item.key])
		if val > 0 {
			result = append(result, map[string]interface{}{
				"name":  item.name,
				"value": val,
			})
		}
	}
	return result
}
