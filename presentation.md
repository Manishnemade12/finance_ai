# TaxSathi Project Presentation (Short)

## 1) What this project does
TaxSathi is an AI-powered tax assistant for FY 2025-26.
It helps users:
- onboard and create profile
- upload tax documents
- extract financial data
- run tax regime comparison (Old vs New)
- get deduction and scheme suggestions

## 2) Tech stack used
- Frontend: React + TypeScript + Vite + Tailwind + shadcn/ui
- Backend: Go (Chi router)
- Database/Auth/Storage: Supabase
- AI providers:
  - Tax Analysis + Document Analysis: Supabase Edge Functions via Lovable AI Gateway
  - TaxBuddy assistant: Groq API (`llama-3.3-70b-versatile`)

## 3) Core workflow
1. User signs in with Supabase Auth.
2. Frontend gets JWT and calls Go backend with `Authorization: Bearer <token>`.
3. Go middleware validates JWT using Supabase and allows protected routes.
4. Data is read/written in Supabase tables (`profiles`, `financial_data`, `documents`, `tax_analyses`).
5. AI endpoints are used for document extraction and tax strategy generation.

## 4) Document/OCR processing details
- Upload endpoint stores files in Supabase Storage bucket `tax-documents`.
- Analysis endpoint calls edge function `analyze-document`.
- Current extraction API: Lovable AI Gateway (`google/gemini-3-flash-preview`) using function-calling JSON extraction.
- Important note: There is no separate dedicated OCR engine in current code. For non-text files, processing is AI-driven from file content metadata/context.

## 5) Tax analysis flow
- User fills income + deductions in Tax Analysis form.
- Backend saves normalized fields into `financial_data`.
- Backend triggers edge function `tax-analysis`.
- AI returns:
  - old regime tax
  - new regime tax
  - recommended regime
  - deduction suggestions
  - scheme recommendations
  - summary text

## 6) TaxBuddy (autonomous flow)
- Separate route: `POST /api/taxbuddy/strategy`
- Input asks step-by-step:
  - age
  - residential status
  - business income yes/no
  - capital gains yes/no
  - estimated income
  - agriculture income yes/no
  - director yes/no
- Backend computes initial ITR logic + alerts, then asks Groq model for final user-friendly strategy.

## 7) Main backend routes
- `GET /health`
- `GET/PUT /api/profile`
- `POST /api/onboarding/complete`
- `GET /api/documents`
- `POST /api/documents/upload`
- `POST /api/documents/{id}/analyze`
- `DELETE /api/documents/{id}`
- `GET/PUT /api/financial-data`
- `GET /api/tax-analysis`
- `POST /api/tax-analysis/run`
- `GET /api/dashboard/stats`
- `GET /api/schemes`
- `POST /api/schemes/personalized`
- `POST /api/taxbuddy/strategy`

## 8) What is already fixed recently
- Financial field mismatch fixed (`deduction_*` vs `deductions_*`).
- Tax summary now reads correct deduction columns.
- TaxBuddy moved from Gemini to Groq clean flow.
- TaxBuddy response formatting cleaned (plain readable text).
- Lovable metadata/favicon branding removed from app shell.

## 9) Current value proposition
TaxSathi combines secure auth + structured tax data + AI guidance into one practical workflow for Indian taxpayers.
