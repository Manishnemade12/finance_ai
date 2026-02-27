package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/csv-mongo-dreams/backend/middleware"
	"github.com/csv-mongo-dreams/backend/services"
	"github.com/go-chi/chi/v5"
)

type DocumentsHandler struct {
	SB *services.SupabaseClient
}

func (h *DocumentsHandler) List(w http.ResponseWriter, r *http.Request) {
	jwt := middleware.GetUserJWT(r)

	data, err := h.SB.Query("documents", "select=*&order=created_at.desc", jwt)
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(data)
}

func (h *DocumentsHandler) Upload(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	jwt := middleware.GetUserJWT(r)

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		jsonError(w, "failed to parse form", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		jsonError(w, "no file provided", http.StatusBadRequest)
		return
	}
	defer file.Close()

	filePath := fmt.Sprintf("%s/%d_%s", userID, time.Now().UnixMilli(), header.Filename)
	if err := h.SB.StorageUpload("tax-documents", filePath, file, header.Header.Get("Content-Type"), jwt); err != nil {
		jsonError(w, "upload failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	doc := map[string]interface{}{
		"user_id":   userID,
		"file_name": header.Filename,
		"file_type": header.Header.Get("Content-Type"),
		"file_path": filePath,
		"file_size": header.Size,
		"status":    "uploaded",
	}
	result, err := h.SB.Insert("documents", doc, jwt)
	if err != nil {
		jsonError(w, "record insert failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(result)
}

func (h *DocumentsHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	jwt := middleware.GetUserJWT(r)
	docID := chi.URLParam(r, "id")

	doc, err := h.SB.QuerySingle("documents", "select=file_path&id=eq."+docID+"&user_id=eq."+userID, jwt)
	if err != nil || doc == nil {
		jsonError(w, "document not found", http.StatusNotFound)
		return
	}

	var docData struct {
		FilePath string `json:"file_path"`
	}
	json.Unmarshal(doc, &docData)

	h.SB.StorageDelete("tax-documents", []string{docData.FilePath}, jwt)

	if err := h.SB.Delete("documents", "id=eq."+docID+"&user_id=eq."+userID, jwt); err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	jsonResponse(w, map[string]interface{}{"success": true})
}

func (h *DocumentsHandler) Analyze(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r)
	jwt := middleware.GetUserJWT(r)
	docID := chi.URLParam(r, "id")

	doc, err := h.SB.QuerySingle("documents", "select=*&id=eq."+docID+"&user_id=eq."+userID, jwt)
	if err != nil || doc == nil {
		jsonError(w, "document not found", http.StatusNotFound)
		return
	}

	var docData struct {
		ID       string `json:"id"`
		FileName string `json:"file_name"`
		FileType string `json:"file_type"`
		FilePath string `json:"file_path"`
		FileSize int64  `json:"file_size"`
	}
	json.Unmarshal(doc, &docData)

	// Download file to get content for the edge function
	fileBytes, _, err := h.SB.StorageDownload("tax-documents", docData.FilePath, jwt)
	if err != nil {
		jsonError(w, "file download failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	var content string
	if strings.Contains(docData.FileType, "text") || strings.Contains(docData.FileType, "csv") {
		content = string(fileBytes)
	} else {
		content = fmt.Sprintf("[Binary file: %s, type: %s, size: %d bytes]",
			docData.FileName, docData.FileType, docData.FileSize)
	}

	// Call the analyze-document edge function (which has the Lovable API key)
	edgeFnBody := map[string]interface{}{
		"documentId":  docData.ID,
		"fileContent": content,
		"fileName":    docData.FileName,
	}
	result, err := h.SB.InvokeEdgeFunction("analyze-document", edgeFnBody, jwt)
	if err != nil {
		jsonError(w, "analysis failed: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(result)
}
