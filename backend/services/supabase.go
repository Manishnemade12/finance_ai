package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
)

// SupabaseClient wraps HTTP calls to Supabase REST, Storage, and Edge Function APIs.
// Uses the anon key + user JWT (to respect RLS policies).
type SupabaseClient struct {
	URL        string
	AnonKey    string
	HTTPClient *http.Client
}

func NewSupabaseClient() *SupabaseClient {
	return &SupabaseClient{
		URL:        os.Getenv("SUPABASE_URL"),
		AnonKey:    os.Getenv("SUPABASE_ANON_KEY"),
		HTTPClient: &http.Client{},
	}
}

// ---------- Auth helpers ----------

// ValidateToken calls Supabase auth.getUser with the given JWT to validate it.
func (s *SupabaseClient) ValidateToken(token string) (string, string, error) {
	req, err := http.NewRequest("GET", s.URL+"/auth/v1/user", nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("apikey", s.AnonKey)

	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return "", "", fmt.Errorf("auth validation failed: %s", string(body))
	}

	var result struct {
		ID    string `json:"id"`
		Email string `json:"email"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", "", err
	}
	return result.ID, result.Email, nil
}

// ---------- PostgREST helpers ----------

func (s *SupabaseClient) restURL(table string) string {
	return s.URL + "/rest/v1/" + table
}

// newRequest creates an authenticated request using the anon key and user JWT.
func (s *SupabaseClient) newRequest(method, url string, body io.Reader, userJWT string) (*http.Request, error) {
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", s.AnonKey)
	req.Header.Set("Authorization", "Bearer "+userJWT)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "return=representation")
	return req, nil
}

// Query performs a GET on the PostgREST API.
func (s *SupabaseClient) Query(table, queryParams, userJWT string) (json.RawMessage, error) {
	url := s.restURL(table) + "?" + queryParams
	req, err := s.newRequest("GET", url, nil, userJWT)
	if err != nil {
		return nil, err
	}
	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase query error %d: %s", resp.StatusCode, string(body))
	}
	return json.RawMessage(body), nil
}

// QuerySingle is like Query but expects a single result.
func (s *SupabaseClient) QuerySingle(table, queryParams, userJWT string) (json.RawMessage, error) {
	url := s.restURL(table) + "?" + queryParams
	req, err := s.newRequest("GET", url, nil, userJWT)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.pgrst.object+json")
	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode == 406 {
		return nil, nil
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase query error %d: %s", resp.StatusCode, string(body))
	}
	return json.RawMessage(body), nil
}

// Count returns the count of rows matching the query.
func (s *SupabaseClient) Count(table, queryParams, userJWT string) (int, error) {
	url := s.restURL(table) + "?" + queryParams + "&select=id"
	req, err := s.newRequest("HEAD", url, nil, userJWT)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Prefer", "count=exact")
	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	contentRange := resp.Header.Get("Content-Range")
	if contentRange == "" {
		return 0, nil
	}
	parts := strings.Split(contentRange, "/")
	if len(parts) == 2 {
		var count int
		fmt.Sscanf(parts[1], "%d", &count)
		return count, nil
	}
	return 0, nil
}

// Insert inserts a record and returns the result.
func (s *SupabaseClient) Insert(table string, data interface{}, userJWT string) (json.RawMessage, error) {
	body, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	req, err := s.newRequest("POST", s.restURL(table), bytes.NewReader(body), userJWT)
	if err != nil {
		return nil, err
	}
	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase insert error %d: %s", resp.StatusCode, string(respBody))
	}
	return json.RawMessage(respBody), nil
}

// Update updates records matching the filter.
func (s *SupabaseClient) Update(table, filter string, data interface{}, userJWT string) (json.RawMessage, error) {
	body, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}
	url := s.restURL(table) + "?" + filter
	req, err := s.newRequest("PATCH", url, bytes.NewReader(body), userJWT)
	if err != nil {
		return nil, err
	}
	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("supabase update error %d: %s", resp.StatusCode, string(respBody))
	}
	return json.RawMessage(respBody), nil
}

// Delete removes records matching the filter.
func (s *SupabaseClient) Delete(table, filter, userJWT string) error {
	url := s.restURL(table) + "?" + filter
	req, err := s.newRequest("DELETE", url, nil, userJWT)
	if err != nil {
		return err
	}
	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase delete error %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

// ---------- Storage helpers ----------

func (s *SupabaseClient) storageURL(bucket, path string) string {
	return s.URL + "/storage/v1/object/" + bucket + "/" + path
}

// StorageUpload uploads a file to Supabase Storage.
func (s *SupabaseClient) StorageUpload(bucket, path string, file multipart.File, contentType, userJWT string) error {
	data, err := io.ReadAll(file)
	if err != nil {
		return err
	}
	req, err := http.NewRequest("POST", s.storageURL(bucket, path), bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("apikey", s.AnonKey)
	req.Header.Set("Authorization", "Bearer "+userJWT)
	req.Header.Set("Content-Type", contentType)

	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("storage upload error %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

// StorageDownload downloads a file from Supabase Storage.
func (s *SupabaseClient) StorageDownload(bucket, path, userJWT string) ([]byte, string, error) {
	req, err := http.NewRequest("GET", s.storageURL(bucket, path), nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("apikey", s.AnonKey)
	req.Header.Set("Authorization", "Bearer "+userJWT)

	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return nil, "", fmt.Errorf("storage download error %d: %s", resp.StatusCode, string(body))
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", err
	}
	return data, resp.Header.Get("Content-Type"), nil
}

// StorageDelete deletes a file from Supabase Storage.
func (s *SupabaseClient) StorageDelete(bucket string, paths []string, userJWT string) error {
	body, _ := json.Marshal(map[string]interface{}{"prefixes": paths})
	req, err := http.NewRequest("DELETE", s.URL+"/storage/v1/object/"+bucket, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("apikey", s.AnonKey)
	req.Header.Set("Authorization", "Bearer "+userJWT)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("storage delete error %d: %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// ---------- Edge Function helpers ----------

// InvokeEdgeFunction calls a Supabase Edge Function.
func (s *SupabaseClient) InvokeEdgeFunction(functionName string, body interface{}, userJWT string) (json.RawMessage, error) {
	url := s.URL + "/functions/v1/" + functionName

	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(jsonBody))
	if err != nil {
		return nil, err
	}
	req.Header.Set("apikey", s.AnonKey)
	req.Header.Set("Authorization", "Bearer "+userJWT)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("edge function error %d: %s", resp.StatusCode, string(respBody))
	}

	return json.RawMessage(respBody), nil
}
