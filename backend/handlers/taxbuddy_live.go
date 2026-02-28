package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"

	"github.com/csv-mongo-dreams/backend/middleware"
)

type taxBuddyLiveMode string

const (
	modeGeneral    taxBuddyLiveMode = "general"
	modeSalary     taxBuddyLiveMode = "salary"
	modeCapital    taxBuddyLiveMode = "capital_gains"
	modeBusiness   taxBuddyLiveMode = "business"
	modeHouse      taxBuddyLiveMode = "house_property"
	modeDeductions taxBuddyLiveMode = "deductions"
	modeTaxPaid    taxBuddyLiveMode = "tax_paid"
	modeReview     taxBuddyLiveMode = "review"
)

type liveSessionState struct {
	Mode           taxBuddyLiveMode  `json:"mode"`
	Step           int               `json:"step"`
	Answers        map[string]string `json:"answers"`
	LastField      string            `json:"last_field"`
	Completed      bool              `json:"completed"`
	ITRForm        string            `json:"itr_form"`
	ExpectedFields []string          `json:"expected_fields"`
}

type liveStartRequest struct {
	Name string `json:"name"`
}

type liveMessageRequest struct {
	Message string            `json:"message"`
	State   *liveSessionState `json:"state"`
}

type liveResponse struct {
	Success        bool              `json:"success"`
	AssistantText  string            `json:"assistant_text"`
	FieldName      string            `json:"field_name"`
	FieldHint      string            `json:"field_hint"`
	ExampleValue   string            `json:"example_value"`
	State          *liveSessionState `json:"state"`
	Completed      bool              `json:"completed"`
	QuickChecklist []string          `json:"quick_checklist,omitempty"`
}

type liveStepDef struct {
	FieldName    string
	Question     string
	PortalField  string
	Hint         string
	ExampleValue string
	Mode         taxBuddyLiveMode
}

func (h *TaxBuddyHandler) StartLiveCoach(w http.ResponseWriter, r *http.Request) {
	var req liveStartRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	defs := liveStepDefs()
	first := defs[0]
	state := &liveSessionState{
		Mode:           modeGeneral,
		Step:           0,
		Answers:        map[string]string{},
		LastField:      first.FieldName,
		Completed:      false,
		ExpectedFields: collectExpectedFields(),
	}
	prefilledCount := h.prefillFromExistingData(r, state)
	state.Mode = detectPrimaryMode(state.Answers)
	state.ITRForm = deriveITRForm(state.Answers)

	nextStep := nextRelevantStep(0, state)
	if nextStep >= len(defs) {
		state.Completed = true
		state.Step = len(defs)
		assistantText := buildLiveCompletionText(state)
		jsonResponse(w, liveResponse{
			Success:        true,
			AssistantText:  assistantText,
			FieldName:      "Final Review",
			FieldHint:      "Most fields are auto-filled from your existing data. Review and e-verify.",
			ExampleValue:   "Aadhaar OTP",
			State:          state,
			Completed:      true,
			QuickChecklist: completionChecklist(state),
		})
		return
	}
	state.Step = nextStep
	first = defs[nextStep]
	state.LastField = first.FieldName

	intro := "I will guide you field-by-field while filing ITR in real time. I will ask one thing at a time and tell you exactly what to fill in the portal."
	if strings.TrimSpace(req.Name) != "" {
		intro = fmt.Sprintf("%s %s", strings.TrimSpace(req.Name)+",", intro)
	}
	if prefilledCount > 0 {
		intro = fmt.Sprintf("%s I prefilled %d fields from your saved Tax Analysis/Profile data and will only ask missing details.", intro, prefilledCount)
	}
	assistantText := buildLiveQuestionText(state, first, intro)

	jsonResponse(w, liveResponse{
		Success:       true,
		AssistantText: assistantText,
		FieldName:     first.PortalField,
		FieldHint:     first.Hint,
		ExampleValue:  first.ExampleValue,
		State:         state,
		Completed:     false,
	})
}

func (h *TaxBuddyHandler) LiveCoachMessage(w http.ResponseWriter, r *http.Request) {
	var req liveMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.State == nil {
		jsonError(w, "state is required", http.StatusBadRequest)
		return
	}
	state := req.State
	if state.Answers == nil {
		state.Answers = map[string]string{}
	}

	if state.Completed {
		jsonResponse(w, liveResponse{
			Success:        true,
			AssistantText:  "Live ITR coach session is completed. Start again to file a fresh return.",
			State:          state,
			Completed:      true,
			QuickChecklist: completionChecklist(state),
		})
		return
	}

	defs := liveStepDefs()
	if state.Step >= 0 && state.Step < len(defs) {
		current := defs[state.Step]
		if strings.TrimSpace(req.Message) != "" {
			state.Answers[current.FieldName] = strings.TrimSpace(req.Message)
		}
	}

	if state.Step == 2 {
		state.Mode = detectPrimaryMode(state.Answers)
		state.ITRForm = deriveITRForm(state.Answers)
	}

	nextStep := nextRelevantStep(state.Step+1, state)
	if nextStep >= len(defs) {
		state.Completed = true
		state.Step = len(defs)
		if state.ITRForm == "" {
			state.ITRForm = deriveITRForm(state.Answers)
		}
		assistantText := buildLiveCompletionText(state)
		jsonResponse(w, liveResponse{
			Success:        true,
			AssistantText:  assistantText,
			FieldName:      "Final Review",
			FieldHint:      "Preview return, validate schedules, submit, then e-verify.",
			ExampleValue:   "Aadhaar OTP",
			State:          state,
			Completed:      true,
			QuickChecklist: completionChecklist(state),
		})
		return
	}

	state.Step = nextStep
	next := defs[nextStep]
	state.LastField = next.FieldName
	assistantText := buildLiveQuestionText(state, next, "")

	jsonResponse(w, liveResponse{
		Success:       true,
		AssistantText: assistantText,
		FieldName:     next.PortalField,
		FieldHint:     next.Hint,
		ExampleValue:  next.ExampleValue,
		State:         state,
		Completed:     false,
	})
}

func liveStepDefs() []liveStepDef {
	return []liveStepDef{
		{FieldName: "resident_status", Question: "Are you Resident or Non-Resident?", PortalField: "Filing Status > Residential Status", Hint: "Choose as per days stayed in India for the year.", ExampleValue: "Resident", Mode: modeGeneral},
		{FieldName: "income_sources", Question: "Select your income types: Salary / Business / Capital Gains / House Property / Other Sources.", PortalField: "Income Details > Income Sources", Hint: "Share all applicable types in one line.", ExampleValue: "Salary, Other Sources", Mode: modeGeneral},
		{FieldName: "annual_income", Question: "What is your total annual income?", PortalField: "Part B-TI > Gross Total Income", Hint: "Use full-year amount before deductions.", ExampleValue: "1250000", Mode: modeGeneral},
		{FieldName: "salary_gross", Question: "What is your gross salary from Form 16 Part B?", PortalField: "Salary Schedule > Gross Salary", Hint: "Enter exact gross salary from Form 16.", ExampleValue: "980000", Mode: modeSalary},
		{FieldName: "salary_tds", Question: "What is TDS deducted by employer?", PortalField: "Schedule TDS1 > TDS from Salary", Hint: "Use Form 16 tax deducted value.", ExampleValue: "65000", Mode: modeSalary},
		{FieldName: "capital_gain_type", Question: "Are your capital gains LTCG or STCG?", PortalField: "Schedule CG > Type of Capital Gain", Hint: "Mention both if both exist.", ExampleValue: "LTCG on equity", Mode: modeCapital},
		{FieldName: "capital_gain_amount", Question: "What is taxable capital gain amount?", PortalField: "Schedule CG > Capital Gains Amount", Hint: "Use net taxable gain after set-off.", ExampleValue: "120000", Mode: modeCapital},
		{FieldName: "business_turnover", Question: "What is your turnover and are you opting presumptive 44AD/44ADA?", PortalField: "Business Schedule > Turnover / Presumptive Option", Hint: "Mention turnover + yes/no for presumptive.", ExampleValue: "42L, presumptive yes", Mode: modeBusiness},
		{FieldName: "business_profit", Question: "What is your taxable business/professional income?", PortalField: "Business Schedule > Net Profit", Hint: "Enter income after admissible expenses or presumptive rate.", ExampleValue: "720000", Mode: modeBusiness},
		{FieldName: "house_property_type", Question: "Is your house property self-occupied or let-out?", PortalField: "Schedule HP > Property Type", Hint: "Select one per property.", ExampleValue: "Self-occupied", Mode: modeHouse},
		{FieldName: "house_interest", Question: "How much housing-loan interest are you claiming?", PortalField: "Schedule HP > Interest on Borrowed Capital", Hint: "Enter eligible interest as per rules.", ExampleValue: "200000", Mode: modeHouse},
		{FieldName: "deduction_summary", Question: "Share deductions: 80C, 80D, 80E, 80G, NPS in one line.", PortalField: "Deductions > Chapter VI-A", Hint: "Use 0 for not applicable sections.", ExampleValue: "80C 150000, 80D 25000, 80G 5000", Mode: modeDeductions},
		{FieldName: "other_income", Question: "Enter interest/dividend/other-source income total.", PortalField: "Schedule OS > Other Sources", Hint: "Include FD interest, savings interest, dividends.", ExampleValue: "38000", Mode: modeDeductions},
		{FieldName: "tax_paid", Question: "Enter total tax already paid (TDS/TCS/Advance Tax/Self Assessment).", PortalField: "Tax Paid > Taxes Paid Summary", Hint: "Sum all taxes already paid.", ExampleValue: "82000", Mode: modeTaxPaid},
		{FieldName: "bank_account", Question: "Confirm refund bank account and IFSC for e-verification.", PortalField: "Bank Details > Refund Bank Account", Hint: "Use pre-validated account in portal.", ExampleValue: "HDFC.... / XXXX1234", Mode: modeReview},
	}
}

func collectExpectedFields() []string {
	defs := liveStepDefs()
	fields := make([]string, 0, len(defs))
	for _, def := range defs {
		fields = append(fields, def.PortalField)
	}
	return fields
}

func nextRelevantStep(start int, state *liveSessionState) int {
	defs := liveStepDefs()
	for i := start; i < len(defs); i++ {
		if stepApplicable(defs[i], state) {
			return i
		}
	}
	return len(defs)
}

func stepApplicable(step liveStepDef, state *liveSessionState) bool {
	if isAnswered(state.Answers[step.FieldName]) {
		return false
	}
	if step.Mode == modeGeneral || step.Mode == modeDeductions || step.Mode == modeTaxPaid || step.Mode == modeReview {
		return true
	}
	mode := detectPrimaryMode(state.Answers)
	if mode == modeGeneral {
		return step.Mode == modeSalary
	}
	return step.Mode == mode
}

func detectPrimaryMode(answers map[string]string) taxBuddyLiveMode {
	sources := strings.ToLower(answers["income_sources"])
	if strings.Contains(sources, "business") || strings.Contains(sources, "freelancer") || strings.Contains(sources, "profession") {
		return modeBusiness
	}
	if strings.Contains(sources, "capital") || strings.Contains(sources, "cg") {
		return modeCapital
	}
	if strings.Contains(sources, "house") || strings.Contains(sources, "rental") {
		return modeHouse
	}
	return modeSalary
}

func deriveITRForm(answers map[string]string) string {
	sources := strings.ToLower(answers["income_sources"])
	if sources == "" {
		sources = strings.ToLower(answers["employment_type"])
	}
	if strings.Contains(sources, "business") || strings.Contains(sources, "freelancer") || strings.Contains(sources, "profession") {
		if strings.Contains(strings.ToLower(answers["business_turnover"]), "presumptive yes") || strings.Contains(strings.ToLower(answers["business_turnover"]), "44ad") || strings.Contains(strings.ToLower(answers["business_turnover"]), "44ada") {
			return "ITR-4"
		}
		return "ITR-3"
	}
	if strings.Contains(sources, "capital") {
		return "ITR-2"
	}
	return "ITR-1"
}

func isAnswered(v string) bool {
	v = strings.TrimSpace(strings.ToLower(v))
	return v != "" && v != "0" && v != "na" && v != "n/a" && v != "none"
}

func asFloat(v interface{}) float64 {
	switch value := v.(type) {
	case float64:
		return value
	case string:
		f, _ := strconv.ParseFloat(strings.TrimSpace(value), 64)
		return f
	default:
		return 0
	}
}

func format0(v float64) string {
	if v <= 0 {
		return ""
	}
	return fmt.Sprintf("%.0f", v)
}

func joinNonEmpty(parts ...string) string {
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		if strings.TrimSpace(part) != "" {
			out = append(out, strings.TrimSpace(part))
		}
	}
	return strings.Join(out, ", ")
}

func (h *TaxBuddyHandler) prefillFromExistingData(r *http.Request, state *liveSessionState) int {
	if h == nil || h.SB == nil {
		return 0
	}
	jwt := middleware.GetUserJWT(r)
	userID := middleware.GetUserID(r)
	if strings.TrimSpace(jwt) == "" || strings.TrimSpace(userID) == "" {
		return 0
	}

	prefilled := 0

	if profileRaw, err := h.SB.QuerySingle("profiles", "select=*&user_id=eq."+userID, jwt); err == nil && profileRaw != nil {
		var profile map[string]interface{}
		if json.Unmarshal(profileRaw, &profile) == nil {
			if v, ok := profile["employment_type"].(string); ok && strings.TrimSpace(v) != "" {
				state.Answers["employment_type"] = v
				prefilled++
			}
			if v, ok := profile["tax_regime"].(string); ok && strings.TrimSpace(v) != "" {
				state.Answers["tax_regime"] = v
				prefilled++
			}
			if v, ok := profile["full_name"].(string); ok && strings.TrimSpace(v) != "" {
				state.Answers["full_name"] = v
				prefilled++
			}
			if arr, ok := profile["income_sources"].([]interface{}); ok && len(arr) > 0 {
				parts := make([]string, 0, len(arr))
				for _, item := range arr {
					if s, ok := item.(string); ok && strings.TrimSpace(s) != "" {
						parts = append(parts, s)
					}
				}
				if len(parts) > 0 {
					state.Answers["income_sources"] = strings.Join(parts, ", ")
					prefilled++
				}
			}
		}
	}

	if finRaw, err := h.SB.QuerySingle("financial_data", "select=*&user_id=eq."+userID+"&financial_year=eq.2025-26", jwt); err == nil && finRaw != nil {
		var fin map[string]interface{}
		if json.Unmarshal(finRaw, &fin) == nil {
			grossSalary := asFloat(fin["gross_salary"])
			otherIncome := asFloat(fin["other_income"]) + asFloat(fin["interest_income"])
			houseIncome := asFloat(fin["rental_income"])
			businessIncome := asFloat(fin["business_income"])

			totalAnnual := grossSalary + otherIncome + houseIncome + businessIncome
			if totalAnnual > 0 {
				state.Answers["annual_income"] = format0(totalAnnual)
				prefilled++
			}
			if grossSalary > 0 {
				state.Answers["salary_gross"] = format0(grossSalary)
				prefilled++
			}
			if houseIncome > 0 {
				state.Answers["house_property_type"] = "Let-out"
				prefilled++
			}

			houseInterest := asFloat(fin["deductions_home_loan_interest"])
			if houseInterest <= 0 {
				houseInterest = asFloat(fin["home_loan_interest"])
			}
			if houseInterest > 0 {
				state.Answers["house_interest"] = format0(houseInterest)
				prefilled++
			}

			ded := joinNonEmpty(
				fmt.Sprintf("80C %s", format0(asFloat(fin["deductions_80c"]))),
				fmt.Sprintf("80D %s", format0(asFloat(fin["deductions_80d"]))),
				fmt.Sprintf("80E %s", format0(asFloat(fin["deductions_80e"]))),
				fmt.Sprintf("80G %s", format0(asFloat(fin["deductions_80g"]))),
				fmt.Sprintf("NPS %s", format0(asFloat(fin["deductions_nps"]))),
			)
			if strings.TrimSpace(strings.ReplaceAll(ded, " 0", "")) != "" {
				state.Answers["deduction_summary"] = strings.ReplaceAll(ded, " 0", "")
				prefilled++
			}

			if otherIncome > 0 {
				state.Answers["other_income"] = format0(otherIncome)
				prefilled++
			}
		}
	}

	if state.Answers["income_sources"] == "" {
		sources := make([]string, 0, 4)
		if isAnswered(state.Answers["salary_gross"]) {
			sources = append(sources, "Salary")
		}
		if isAnswered(state.Answers["house_interest"]) || strings.EqualFold(state.Answers["house_property_type"], "let-out") {
			sources = append(sources, "House Property")
		}
		if strings.Contains(strings.ToLower(state.Answers["employment_type"]), "business") || strings.Contains(strings.ToLower(state.Answers["employment_type"]), "freelance") {
			sources = append(sources, "Business")
		}
		if len(sources) > 0 {
			state.Answers["income_sources"] = strings.Join(sources, ", ")
			prefilled++
		}
	}

	return prefilled
}

func buildLiveQuestionText(state *liveSessionState, next liveStepDef, intro string) string {
	apiKey := os.Getenv("GROQ_API_KEY")
	if strings.TrimSpace(apiKey) == "" {
		base := fmt.Sprintf("Fill portal field '%s'. %s", next.PortalField, next.Question)
		if intro == "" {
			return base
		}
		return intro + " " + base
	}

	systemPrompt := `You are a professional Indian Tax Consultant AI helping users file ITR in real time.
Rules:
- Ask one question at a time.
- Give exact field-level guidance for the current portal field.
- Keep response short (max 4 lines).
- End response with exactly one question.
- Do not ask user to submit all details at once.`

	answersPreview := sortedAnswerPreview(state.Answers)
	prefix := ""
	if strings.TrimSpace(intro) != "" {
		prefix = "Session intro: " + intro + "\n"
	}
	userPrompt := fmt.Sprintf(`%sKnown answers: %s
Current portal field: %s
Field hint: %s
Example: %s
Ask this next question: %s`, prefix, answersPreview, next.PortalField, next.Hint, next.ExampleValue, next.Question)

	text, err := callGroq(apiKey, systemPrompt, userPrompt)
	if err != nil || strings.TrimSpace(text) == "" {
		return fmt.Sprintf("Current field: %s. %s Example: %s", next.PortalField, next.Question, next.ExampleValue)
	}
	return strings.TrimSpace(text)
}

func sortedAnswerPreview(answers map[string]string) string {
	if len(answers) == 0 {
		return "none"
	}
	keys := make([]string, 0, len(answers))
	for k := range answers {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		parts = append(parts, fmt.Sprintf("%s=%s", key, answers[key]))
	}
	return strings.Join(parts, "; ")
}

func buildLiveCompletionText(state *liveSessionState) string {
	itr := state.ITRForm
	if itr == "" {
		itr = deriveITRForm(state.Answers)
	}
	apiKey := os.Getenv("GROQ_API_KEY")
	if strings.TrimSpace(apiKey) == "" {
		return fmt.Sprintf("Recommended form: %s. Review all schedules, verify tax paid, submit return, and complete e-verification.", itr)
	}

	systemPrompt := `You are a professional Indian Tax Consultant AI.
Create final compact handoff after real-time filing guidance.
Output: 1) Recommended ITR with reason 2) 6-step filing closure checklist 3) e-verify reminder.`

	userPrompt := fmt.Sprintf(`Answers: %s
ITR form: %s
Give concise completion message for first-time filer.`, sortedAnswerPreview(state.Answers), itr)
	text, err := callGroq(apiKey, systemPrompt, userPrompt)
	if err != nil || strings.TrimSpace(text) == "" {
		return fmt.Sprintf("Based on your entries, file using %s and complete preview, submit, and e-verify.", itr)
	}
	return strings.TrimSpace(text)
}

func completionChecklist(state *liveSessionState) []string {
	itr := state.ITRForm
	if itr == "" {
		itr = deriveITRForm(state.Answers)
	}
	return []string{
		"Form: " + itr,
		"Validate Personal Info + Bank Account",
		"Validate income schedules (Salary/CG/Business/HP/OS)",
		"Validate deductions under Chapter VI-A",
		"Match Tax Paid with Form 16/26AS/AIS",
		"Preview, Submit, and e-Verify return",
	}
}
