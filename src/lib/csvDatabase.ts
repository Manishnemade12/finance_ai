
export interface Document {
  _id: string;
  [key: string]: any;
}

export interface QueryOptions {
  limit?: number;
  skip?: number;
  sort?: { [key: string]: 1 | -1 };
}

export interface UpdateOptions {
  upsert?: boolean;
  multi?: boolean;
}

export class CSVDatabase {
  private collections: Map<string, Document[]> = new Map();
  private indexes: Map<string, Map<string, Set<string>>> = new Map();

  constructor() {
    this.loadFromStorage();
  }

  // Generate unique ID
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Save to localStorage as CSV
  private saveToStorage(): void {
    const data: { [collection: string]: string } = {};
    
    this.collections.forEach((docs, collectionName) => {
      if (docs.length === 0) {
        data[collectionName] = '';
        return;
      }

      // Get all unique keys
      const allKeys = new Set<string>();
      docs.forEach(doc => Object.keys(doc).forEach(key => allKeys.add(key)));
      const headers = Array.from(allKeys);

      // Create CSV content
      const csvRows = [headers.join(',')];
      docs.forEach(doc => {
        const row = headers.map(header => {
          const value = doc[header];
          if (value === undefined || value === null) return '';
          if (typeof value === 'object') return JSON.stringify(value);
          return String(value).replace(/,/g, '\\,');
        });
        csvRows.push(row.join(','));
      });

      data[collectionName] = csvRows.join('\n');
    });

    localStorage.setItem('csvDatabase', JSON.stringify(data));
  }

  // Load from localStorage
  private loadFromStorage(): void {
    const stored = localStorage.getItem('csvDatabase');
    if (!stored) return;

    try {
      const data = JSON.parse(stored);
      Object.entries(data).forEach(([collectionName, csvContent]) => {
        if (typeof csvContent !== 'string' || !csvContent.trim()) return;

        const lines = csvContent.split('\n');
        if (lines.length < 2) return;

        const headers = lines[0].split(',');
        const docs: Document[] = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.replace(/\\,/g, ','));
          const doc: Document = { _id: '' };

          headers.forEach((header, index) => {
            const value = values[index] || '';
            if (value === '') {
              doc[header] = null;
            } else if (value.startsWith('{') || value.startsWith('[')) {
              try {
                doc[header] = JSON.parse(value);
              } catch {
                doc[header] = value;
              }
            } else if (!isNaN(Number(value)) && value !== '') {
              doc[header] = Number(value);
            } else if (value === 'true' || value === 'false') {
              doc[header] = value === 'true';
            } else {
              doc[header] = value;
            }
          });

          if (doc._id) docs.push(doc);
        }

        this.collections.set(collectionName, docs);
        this.rebuildIndexes(collectionName);
      });
    } catch (error) {
      console.error('Error loading database:', error);
    }
  }

  // Create collection
  createCollection(name: string): void {
    if (!this.collections.has(name)) {
      this.collections.set(name, []);
      this.indexes.set(name, new Map());
      this.saveToStorage();
    }
  }

  // Drop collection
  dropCollection(name: string): boolean {
    const deleted = this.collections.delete(name);
    this.indexes.delete(name);
    if (deleted) this.saveToStorage();
    return deleted;
  }

  // List collections
  listCollections(): string[] {
    return Array.from(this.collections.keys());
  }

  // Insert document
  insertOne(collection: string, document: Omit<Document, '_id'>): Document {
    this.createCollection(collection);
    const doc: Document = { ...document, _id: this.generateId() };
    this.collections.get(collection)!.push(doc);
    this.updateIndexes(collection, doc);
    this.saveToStorage();
    return doc;
  }

  // Insert multiple documents
  insertMany(collection: string, documents: Omit<Document, '_id'>[]): Document[] {
    this.createCollection(collection);
    const docs = documents.map(doc => ({ ...doc, _id: this.generateId() }));
    this.collections.get(collection)!.push(...docs);
    docs.forEach(doc => this.updateIndexes(collection, doc));
    this.saveToStorage();
    return docs;
  }

  // Find documents
  find(collection: string, query: any = {}, options: QueryOptions = {}): Document[] {
    const docs = this.collections.get(collection) || [];
    let result = docs.filter(doc => this.matchesQuery(doc, query));

    // Sort
    if (options.sort) {
      result.sort((a, b) => {
        for (const [field, direction] of Object.entries(options.sort!)) {
          const aVal = a[field];
          const bVal = b[field];
          const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          if (comparison !== 0) return comparison * direction;
        }
        return 0;
      });
    }

    // Skip and limit
    if (options.skip) result = result.slice(options.skip);
    if (options.limit) result = result.slice(0, options.limit);

    return result;
  }

  // Find one document
  findOne(collection: string, query: any = {}): Document | null {
    const result = this.find(collection, query, { limit: 1 });
    return result.length > 0 ? result[0] : null;
  }

  // Update documents
  updateMany(collection: string, query: any, update: any, options: UpdateOptions = {}): number {
    const docs = this.collections.get(collection) || [];
    let matchCount = 0;

    for (const doc of docs) {
      if (this.matchesQuery(doc, query)) {
        this.applyUpdate(doc, update);
        this.updateIndexes(collection, doc);
        matchCount++;
        if (!options.multi) break;
      }
    }

    if (matchCount === 0 && options.upsert) {
      const newDoc = this.insertOne(collection, { ...query, ...this.getUpdateFields(update) });
      matchCount = 1;
    }

    if (matchCount > 0) this.saveToStorage();
    return matchCount;
  }

  // Update one document
  updateOne(collection: string, query: any, update: any, options: UpdateOptions = {}): number {
    return this.updateMany(collection, query, update, { ...options, multi: false });
  }

  // Delete documents
  deleteMany(collection: string, query: any): number {
    const docs = this.collections.get(collection) || [];
    const initialLength = docs.length;
    const filtered = docs.filter(doc => !this.matchesQuery(doc, query));
    
    this.collections.set(collection, filtered);
    this.rebuildIndexes(collection);
    
    const deletedCount = initialLength - filtered.length;
    if (deletedCount > 0) this.saveToStorage();
    return deletedCount;
  }

  // Delete one document
  deleteOne(collection: string, query: any): number {
    const docs = this.collections.get(collection) || [];
    const index = docs.findIndex(doc => this.matchesQuery(doc, query));
    
    if (index !== -1) {
      docs.splice(index, 1);
      this.rebuildIndexes(collection);
      this.saveToStorage();
      return 1;
    }
    return 0;
  }

  // Count documents
  countDocuments(collection: string, query: any = {}): number {
    const docs = this.collections.get(collection) || [];
    return docs.filter(doc => this.matchesQuery(doc, query)).length;
  }

  // Create index
  createIndex(collection: string, field: string): void {
    this.createCollection(collection);
    const collectionIndexes = this.indexes.get(collection)!;
    if (!collectionIndexes.has(field)) {
      collectionIndexes.set(field, new Set());
      this.rebuildIndexes(collection);
    }
  }

  // Query matching logic
  private matchesQuery(doc: Document, query: any): boolean {
    for (const [key, value] of Object.entries(query)) {
      if (key.startsWith('$')) {
        // Handle operators
        if (key === '$and') {
          return (value as any[]).every(subQuery => this.matchesQuery(doc, subQuery));
        }
        if (key === '$or') {
          return (value as any[]).some(subQuery => this.matchesQuery(doc, subQuery));
        }
        continue;
      }

      const docValue = doc[key];
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Handle field operators
        for (const [operator, operatorValue] of Object.entries(value)) {
          switch (operator) {
            case '$eq':
              if (docValue !== operatorValue) return false;
              break;
            case '$ne':
              if (docValue === operatorValue) return false;
              break;
            case '$gt':
              if (docValue <= operatorValue) return false;
              break;
            case '$gte':
              if (docValue < operatorValue) return false;
              break;
            case '$lt':
              if (docValue >= operatorValue) return false;
              break;
            case '$lte':
              if (docValue > operatorValue) return false;
              break;
            case '$in':
              if (!Array.isArray(operatorValue) || !operatorValue.includes(docValue)) return false;
              break;
            case '$nin':
              if (Array.isArray(operatorValue) && operatorValue.includes(docValue)) return false;
              break;
            case '$regex':
              const regex = new RegExp(operatorValue);
              if (!regex.test(String(docValue))) return false;
              break;
          }
        }
      } else {
        // Direct equality
        if (docValue !== value) return false;
      }
    }
    return true;
  }

  // Apply update operations
  private applyUpdate(doc: Document, update: any): void {
    for (const [operator, fields] of Object.entries(update)) {
      switch (operator) {
        case '$set':
          Object.assign(doc, fields);
          break;
        case '$unset':
          for (const field of Object.keys(fields as object)) {
            delete doc[field];
          }
          break;
        case '$inc':
          for (const [field, value] of Object.entries(fields as object)) {
            doc[field] = (doc[field] || 0) + (value as number);
          }
          break;
        case '$push':
          for (const [field, value] of Object.entries(fields as object)) {
            if (!Array.isArray(doc[field])) doc[field] = [];
            doc[field].push(value);
          }
          break;
        case '$pull':
          for (const [field, value] of Object.entries(fields as object)) {
            if (Array.isArray(doc[field])) {
              doc[field] = doc[field].filter((item: any) => item !== value);
            }
          }
          break;
      }
    }
  }

  // Get fields from update object
  private getUpdateFields(update: any): any {
    const fields: any = {};
    for (const [operator, operatorFields] of Object.entries(update)) {
      if (operator === '$set') {
        Object.assign(fields, operatorFields);
      }
    }
    return fields;
  }

  // Index management
  private updateIndexes(collection: string, doc: Document): void {
    const collectionIndexes = this.indexes.get(collection);
    if (!collectionIndexes) return;

    for (const [field, index] of collectionIndexes) {
      const value = doc[field];
      if (value !== undefined && value !== null) {
        index.add(String(value));
      }
    }
  }

  private rebuildIndexes(collection: string): void {
    const collectionIndexes = this.indexes.get(collection);
    if (!collectionIndexes) return;

    // Clear existing indexes
    for (const index of collectionIndexes.values()) {
      index.clear();
    }

    // Rebuild indexes
    const docs = this.collections.get(collection) || [];
    docs.forEach(doc => this.updateIndexes(collection, doc));
  }

  // Export collection as CSV
  exportCollection(collection: string): string {
    const docs = this.collections.get(collection) || [];
    if (docs.length === 0) return '';

    const allKeys = new Set<string>();
    docs.forEach(doc => Object.keys(doc).forEach(key => allKeys.add(key)));
    const headers = Array.from(allKeys);

    const csvRows = [headers.join(',')];
    docs.forEach(doc => {
      const row = headers.map(header => {
        const value = doc[header];
        if (value === undefined || value === null) return '';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value).replace(/,/g, '\\,');
      });
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  // Import CSV data
  importCSV(collection: string, csvContent: string, replace: boolean = false): number {
    if (replace) {
      this.collections.set(collection, []);
    }
    
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return 0;

    const headers = lines[0].split(',');
    const docs: Omit<Document, '_id'>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.replace(/\\,/g, ','));
      const doc: any = {};

      headers.forEach((header, index) => {
        const value = values[index] || '';
        if (value === '') {
          doc[header] = null;
        } else if (value.startsWith('{') || value.startsWith('[')) {
          try {
            doc[header] = JSON.parse(value);
          } catch {
            doc[header] = value;
          }
        } else if (!isNaN(Number(value)) && value !== '') {
          doc[header] = Number(value);
        } else if (value === 'true' || value === 'false') {
          doc[header] = value === 'true';
        } else {
          doc[header] = value;
        }
      });

      docs.push(doc);
    }

    this.insertMany(collection, docs);
    return docs.length;
  }
}

// Global database instance
export const csvDB = new CSVDatabase();
