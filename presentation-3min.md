# TaxSathi 3-Minute Description Script

Hello everyone,

Today I’m presenting **TaxSathi**, an AI-powered tax assistant built for the Indian tax system (FY 2025–26). The goal of this project is simple: make tax filing easier, faster, and less confusing for regular users.

In this platform, users can sign in securely, complete a basic onboarding, upload tax-related documents, and receive a full tax analysis with regime comparison and deduction suggestions.

From a technical architecture point of view, we built this as a full-stack system.
The **frontend** is built using React, TypeScript, Vite, and Tailwind.
The **backend** is written in Go using the Chi router.
For data and authentication, we use **Supabase**.
For AI capabilities, we use two flows:
- Supabase edge-function AI flow for document extraction and tax analysis,
- and a separate autonomous **TaxBuddy** flow powered by **Groq API**.

Now, the workflow:
First, user authentication happens through Supabase.
After login, the frontend sends JWT-authenticated requests to the Go backend.
The backend validates the user token, then reads or updates user data from Supabase tables like profiles, financial_data, documents, and tax_analyses.

For document processing, users upload files to Supabase Storage.
Then the analyze endpoint processes those files and extracts structured values like salary, deductions, and key financial indicators.
Those extracted values are then used in tax computation.

In Tax Analysis, users enter income and deduction values, and the system compares old vs new regime tax, shows estimated liability, and provides deduction opportunities and government scheme recommendations.

We also added **TaxBuddy**, a conversational strategy module.
It asks step-by-step questions like age, residential status, capital gains, business income, and director status.
Then it generates a clear personalized tax strategy, including likely ITR form, smart alerts, and one guided follow-up question.

Recent improvements in this project include:
- fixing financial field mapping issues so values save correctly,
- making TaxBuddy response cleaner and readable,
- switching TaxBuddy from Gemini to Groq for a stable autonomous flow,
- and removing leftover Lovable branding metadata from the app shell.

So in summary, TaxSathi is not just a calculator — it is a complete guided tax workflow combining secure backend logic, structured data handling, and AI-driven personalized assistance.

Thank you.
