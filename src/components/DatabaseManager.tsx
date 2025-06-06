
import React, { useState, useEffect } from 'react';
import { csvDB, Document } from '@/lib/csvDatabase';
import SampleDataGenerator from './SampleDataGenerator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Database, Table, Search, Download, Upload, Plus, Trash2, Edit, Play } from 'lucide-react';

const DatabaseManager = () => {
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string>('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [queryText, setQueryText] = useState('{}');
  const [updateText, setUpdateText] = useState('{}');
  const [insertText, setInsertText] = useState('{}');
  const [newCollectionName, setNewCollectionName] = useState('');

  useEffect(() => {
    refreshCollections();
  }, []);

  useEffect(() => {
    if (selectedCollection) {
      loadDocuments();
    }
  }, [selectedCollection]);

  const refreshCollections = () => {
    setCollections(csvDB.listCollections());
  };

  const loadDocuments = () => {
    if (selectedCollection) {
      const docs = csvDB.find(selectedCollection);
      setDocuments(docs);
    }
  };

  const createCollection = () => {
    if (newCollectionName.trim()) {
      csvDB.createCollection(newCollectionName.trim());
      refreshCollections();
      setSelectedCollection(newCollectionName.trim());
      setNewCollectionName('');
      toast.success(`Collection "${newCollectionName}" created successfully!`);
    }
  };

  const dropCollection = () => {
    if (selectedCollection && confirm(`Are you sure you want to drop collection "${selectedCollection}"?`)) {
      csvDB.dropCollection(selectedCollection);
      refreshCollections();
      setSelectedCollection('');
      setDocuments([]);
      toast.success(`Collection "${selectedCollection}" dropped successfully!`);
    }
  };

  const executeQuery = () => {
    try {
      const query = JSON.parse(queryText);
      const results = csvDB.find(selectedCollection, query);
      setDocuments(results);
      toast.success(`Found ${results.length} document(s)`);
    } catch (error) {
      toast.error('Invalid query JSON');
    }
  };

  const executeUpdate = () => {
    try {
      const query = JSON.parse(queryText);
      const update = JSON.parse(updateText);
      const count = csvDB.updateMany(selectedCollection, query, update, { multi: true });
      loadDocuments();
      toast.success(`Updated ${count} document(s)`);
    } catch (error) {
      toast.error('Invalid JSON in query or update');
    }
  };

  const executeInsert = () => {
    try {
      const document = JSON.parse(insertText);
      if (Array.isArray(document)) {
        csvDB.insertMany(selectedCollection, document);
        toast.success(`Inserted ${document.length} document(s)`);
      } else {
        csvDB.insertOne(selectedCollection, document);
        toast.success('Document inserted successfully!');
      }
      loadDocuments();
      setInsertText('{}');
    } catch (error) {
      toast.error('Invalid JSON');
    }
  };

  const deleteDocument = (id: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      csvDB.deleteOne(selectedCollection, { _id: id });
      loadDocuments();
      toast.success('Document deleted successfully!');
    }
  };

  const exportCollection = () => {
    if (!selectedCollection) return;
    
    const csv = csvDB.exportCollection(selectedCollection);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedCollection}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Collection exported successfully!');
  };

  const importCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedCollection) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const csv = e.target?.result as string;
      const count = csvDB.importCSV(selectedCollection, csv);
      loadDocuments();
      toast.success(`Imported ${count} document(s)`);
    };
    reader.readAsText(file);
  };

  const formatJSON = (obj: any) => {
    return JSON.stringify(obj, null, 2);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Database className="h-10 w-10 text-blue-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              CSV MongoDB
            </h1>
          </div>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            A complete MongoDB-like database system powered by CSV files. 
            Perform all CRUD operations, complex queries, and data management in your browser.
          </p>
        </div>

        {/* Sample Data Generator */}
        <SampleDataGenerator />

        {/* Collection Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Table className="h-5 w-5" />
              Collection Management
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="New collection name"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && createCollection()}
              />
              <Button onClick={createCollection} className="whitespace-nowrap">
                <Plus className="h-4 w-4 mr-2" />
                Create
              </Button>
            </div>
            
            <div className="flex gap-2 items-center">
              <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a collection" />
                </SelectTrigger>
                <SelectContent>
                  {collections.map((collection) => (
                    <SelectItem key={collection} value={collection}>
                      {collection}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {selectedCollection && (
                <>
                  <Button variant="outline" onClick={exportCollection}>
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                  <label className="cursor-pointer">
                    <Button variant="outline" asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        Import CSV
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={importCSV}
                      className="hidden"
                    />
                  </label>
                  <Button variant="destructive" onClick={dropCollection}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Drop
                  </Button>
                </>
              )}
            </div>

            <div className="flex gap-4 text-sm text-slate-600">
              <span>Collections: {collections.length}</span>
              {selectedCollection && (
                <span>Documents: {csvDB.countDocuments(selectedCollection)}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedCollection && (
          <Tabs defaultValue="query" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="query">Query</TabsTrigger>
              <TabsTrigger value="insert">Insert</TabsTrigger>
              <TabsTrigger value="update">Update</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="query" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="h-5 w-5" />
                    Query Documents
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">MongoDB Query (JSON)</label>
                    <Textarea
                      placeholder='{"field": "value", "age": {"$gte": 18}}'
                      value={queryText}
                      onChange={(e) => setQueryText(e.target.value)}
                      className="font-mono"
                      rows={4}
                    />
                  </div>
                  <Button onClick={executeQuery} className="w-full">
                    <Play className="h-4 w-4 mr-2" />
                    Execute Query
                  </Button>
                  
                  <div className="text-sm text-slate-600 space-y-1">
                    <p><strong>Examples:</strong></p>
                    <p>• Find all: <code>{"{}"}</code></p>
                    <p>• By field: <code>{'{"name": "John Doe"}'}</code></p>
                    <p>• Range: <code>{'{"age": {"$gte": 18, "$lt": 65}}'}</code></p>
                    <p>• Array contains: <code>{'{"tags": {"$in": ["developer", "admin"]}}'}</code></p>
                    <p>• Complex: <code>{'{"$or": [{"age": {"$lt": 30}}, {"role": "admin"}]}'}</code></p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="insert" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Insert Documents
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Document(s) JSON</label>
                    <Textarea
                      placeholder='{"name": "John", "age": 30} or [{"name": "John"}, {"name": "Jane"}]'
                      value={insertText}
                      onChange={(e) => setInsertText(e.target.value)}
                      className="font-mono"
                      rows={6}
                    />
                  </div>
                  <Button onClick={executeInsert} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Insert Document(s)
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="update" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Edit className="h-5 w-5" />
                    Update Documents
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Query (which documents to update)</label>
                    <Textarea
                      placeholder='{"age": {"$gte": 18}}'
                      value={queryText}
                      onChange={(e) => setQueryText(e.target.value)}
                      className="font-mono"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Update Operations</label>
                    <Textarea
                      placeholder='{"$set": {"status": "active"}, "$inc": {"views": 1}}'
                      value={updateText}
                      onChange={(e) => setUpdateText(e.target.value)}
                      className="font-mono"
                      rows={4}
                    />
                  </div>
                  <Button onClick={executeUpdate} className="w-full">
                    <Edit className="h-4 w-4 mr-2" />
                    Update Documents
                  </Button>
                  
                  <div className="text-sm text-slate-600 space-y-1">
                    <p><strong>Update Operators:</strong></p>
                    <p>• <code>$set</code>: Set field values</p>
                    <p>• <code>$inc</code>: Increment numeric fields</p>
                    <p>• <code>$push</code>: Add to arrays</p>
                    <p>• <code>$pull</code>: Remove from arrays</p>
                    <p>• <code>$unset</code>: Remove fields</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Documents ({documents.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {documents.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      No documents found. Insert some data to get started!
                    </div>
                  ) : (
                    <div className="space-y-4 max-h-96 overflow-y-auto">
                      {documents.map((doc) => (
                        <div key={doc._id} className="border rounded-lg p-4 bg-slate-50">
                          <div className="flex justify-between items-start mb-2">
                            <Badge variant="secondary" className="font-mono text-xs">
                              ID: {doc._id}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteDocument(doc._id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                          <pre className="text-xs bg-white p-2 rounded border overflow-x-auto">
                            {formatJSON(doc)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Features Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Features & Capabilities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h4 className="font-semibold text-green-600">✅ Implemented Features</h4>
                <ul className="text-sm space-y-1 text-slate-600">
                  <li>• CRUD Operations (Create, Read, Update, Delete)</li>
                  <li>• MongoDB-style query syntax</li>
                  <li>• Complex queries with operators ($gt, $lt, $in, $or, etc.)</li>
                  <li>• Update operators ($set, $inc, $push, $pull, $unset)</li>
                  <li>• CSV import/export functionality</li>
                  <li>• Persistent storage (localStorage)</li>
                  <li>• Collection management</li>
                  <li>• Document counting and indexing</li>
                  <li>• Sorting, limiting, and skipping</li>
                  <li>• JSON data type support</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-blue-600">🚀 Advanced Capabilities</h4>
                <ul className="text-sm space-y-1 text-slate-600">
                  <li>• Automatic data type detection</li>
                  <li>• Nested object and array support</li>
                  <li>• Regular expression queries</li>
                  <li>• Upsert operations</li>
                  <li>• Multi-document updates</li>
                  <li>• Index management for performance</li>
                  <li>• CSV format preservation</li>
                  <li>• Real-time data validation</li>
                  <li>• Error handling and recovery</li>
                  <li>• Browser-based operation (no server needed)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DatabaseManager;
