package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"

	"github.com/csv-mongo-dreams/backend/services"
)

type TaxBuddyHandler struct {
	SB *services.SupabaseClient
}

type taxBuddyRequest struct {
	Age         int     `json:"age"`
	ResStatus   string  `json:"res_status"`
	HasBusiness bool    `json:"has_business"`
	HasCapGains bool    `json:"has_cap_gains"`
	EstIncome   float64 `json:"est_income"`
	HasAgri     bool    `json:"has_agri"`
	IsDirector  bool    `json:"is_director"`
}

func (h *TaxBuddyHandler) GenerateStrategy(w http.ResponseWriter, r *http.Request) {
	var req taxBuddyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Age <= 0 {
		jsonError(w, "age is required", http.StatusBadRequest)
		return
	}
	if req.ResStatus == "" {
		jsonError(w, "residential status is required", http.StatusBadRequest)
		return
	}

	verdict, reason := determineITR(req)
	alerts := buildAlerts(req)
	contextSummary := buildContextSummary(req)

	apiKey := os.Getenv("GROQ_API_KEY")
	if apiKey == "" {
		jsonError(w, "GROQ_API_KEY is not configured", http.StatusInternalServerError)
		return
	}

	systemPrompt := `Role: You are "TaxBuddy," an intelligent, empathetic, and witty AI Tax Assistant helping Pranav with Indian taxes for FY 2025-26.

Core directives:
1) Context First: Start by acknowledging backend-provided facts.
2) The Why Behind ITR: Explain specific reason for ITR choice.
3) One Step at a Time: Ask exactly ONE follow-up question.
4) Be Proactive:
   - If senior citizen (60+), mention Section 80TTB deduction of ₹50,000.
   - If agriculture income exists, explain Partial Integration simply.

Output rules:
- Return plain text only (no markdown symbols like ###, *, **, -, backticks).
- Keep this exact readable structure:
	Your Personalized Tax Strategy
	The Verdict: ...
	Big Wins: ...
	Smart Alerts: ...

	Let's Get Started
	... exactly one follow-up question ...

	Disclaimer: I provide AI-guided strategy for informational purposes. Please verify final filings with a CA.`

	userPrompt := fmt.Sprintf(`Use this backend context (do not override these facts):
%s

Backend verdict:
- ITR form: %s
- Primary reason: %s
- Smart alerts: %s

Now generate the final user-facing strategy in the exact required format.`, contextSummary, verdict, reason, alerts)

	aiText, err := callGroq(apiKey, systemPrompt, userPrompt)
	if err != nil {
		jsonError(w, "taxbuddy generation failed: "+err.Error(), http.StatusBadGateway)
		return
	}
	aiText = sanitizeTaxBuddyOutput(aiText)

	jsonResponse(w, map[string]interface{}{
		"success": true,
		"data": map[string]interface{}{
			"strategy":       aiText,
			"itr_form":       verdict,
			"primary_reason": reason,
			"smart_alerts":   alerts,
		},
	})
}

func sanitizeTaxBuddyOutput(raw string) string {
	text := strings.TrimSpace(raw)
	replacements := []struct {
		old string
		new string
	}{
		{"### 📝 Your Personalized Tax Strategy", "Your Personalized Tax Strategy"},
		{"### 💬 Let's Get Started", "Let's Get Started"},
		{"**Disclaimer:**", "Disclaimer:"},
		{"* **The Verdict:**", "The Verdict:"},
		{"* **Big Wins:**", "Big Wins:"},
		{"* **Smart Alerts:**", "Smart Alerts:"},
		{"**The Verdict:**", "The Verdict:"},
		{"**Big Wins:**", "Big Wins:"},
		{"**Smart Alerts:**", "Smart Alerts:"},
		{"---", ""},
	}

	for _, r := range replacements {
		text = strings.ReplaceAll(text, r.old, r.new)
	}

	lines := strings.Split(text, "\n")
	cleaned := make([]string, 0, len(lines))
	seenTitle := false
	for _, line := range lines {
		line = strings.TrimSpace(line)
		line = strings.TrimPrefix(line, "*")
		line = strings.TrimSpace(line)
		if line == "" {
			if len(cleaned) == 0 || cleaned[len(cleaned)-1] == "" {
				continue
			}
			cleaned = append(cleaned, "")
			continue
		}
		if strings.EqualFold(line, "Your Personalized Tax Strategy") {
			if seenTitle {
				continue
			}
			seenTitle = true
		}
		cleaned = append(cleaned, line)
	}

	return strings.TrimSpace(strings.Join(cleaned, "\n"))
}

func determineITR(req taxBuddyRequest) (string, string) {
	if req.HasBusiness {
		return "ITR-3", "Since you have business/freelancing income, you need a return meant for business/professional income."
	}

	if req.IsDirector {
		return "ITR-2", "Since you are a company director, you need the more detailed ITR form that captures director disclosures."
	}

	if req.HasCapGains {
		return "ITR-2", "Since you reported capital gains from stocks/mutual funds/property, ITR-1 is not applicable."
	}

	if strings.EqualFold(req.ResStatus, "NRI") || strings.EqualFold(req.ResStatus, "RNOR") {
		return "ITR-2", "Since your residential status is not resident, you need ITR-2 for the required disclosures."
	}

	if req.EstIncome > 5000000 {
		return "ITR-2", "Since estimated annual income is above ₹50L, the law requires a more detailed return."
	}

	return "ITR-1", "Based on your current profile, basic resident individual filing conditions fit ITR-1."
}

func buildAlerts(req taxBuddyRequest) string {
	alerts := []string{}
	if req.EstIncome > 5000000 {
		alerts = append(alerts, "Schedule AL is typically required because income exceeds ₹50L")
	}
	if req.Age >= 60 {
		alerts = append(alerts, "Senior citizen: check Section 80TTB benefit up to ₹50,000 on eligible interest")
	}
	if req.HasAgri {
		alerts = append(alerts, "Agricultural income may trigger partial integration for rate calculation")
	}
	if len(alerts) == 0 {
		return "No high-risk filing alert detected from current answers"
	}
	return strings.Join(alerts, "; ")
}

func buildContextSummary(req taxBuddyRequest) string {
	return fmt.Sprintf(`- Age: %d
- Residential status: %s
- Has business/freelancing income: %t
- Has capital gains: %t
- Estimated annual income: ₹%.0f
- Has agriculture income: %t
- Director in a company: %t`, req.Age, req.ResStatus, req.HasBusiness, req.HasCapGains, req.EstIncome, req.HasAgri, req.IsDirector)
}

func callGroq(apiKey, systemPrompt, userPrompt string) (string, error) {
	model := strings.TrimSpace(os.Getenv("GROQ_MODEL"))
	if model == "" {
		model = "llama-3.3-70b-versatile"
	}

	payload := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
		},
		"temperature": 0.5,
		"max_tokens":  1200,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}

	httpReq, err := http.NewRequest("POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	httpReq.Header.Set("Authorization", "Bearer "+apiKey)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode >= 400 {
		if resp.StatusCode == 429 {
			return "", fmt.Errorf("groq quota exceeded (model %s): add credits/billing and retry", model)
		}
		return "", fmt.Errorf("groq model %s error %d: %s", model, resp.StatusCode, string(respBody))
	}

	var parsed struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", err
	}

	if len(parsed.Choices) == 0 || strings.TrimSpace(parsed.Choices[0].Message.Content) == "" {
		return "", fmt.Errorf("empty groq response for model %s", model)
	}

	return parsed.Choices[0].Message.Content, nil
}
