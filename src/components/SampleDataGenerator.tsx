
import React from 'react';
import { csvDB } from '@/lib/csvDatabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';

const SampleDataGenerator = () => {
  const generateSampleData = () => {
    // Users collection
    const users = [
      { name: 'John Doe', age: 28, email: 'john@example.com', role: 'admin', active: true, tags: ['developer', 'team-lead'] },
      { name: 'Jane Smith', age: 34, email: 'jane@example.com', role: 'user', active: true, tags: ['designer', 'creative'] },
      { name: 'Bob Johnson', age: 45, email: 'bob@example.com', role: 'user', active: false, tags: ['analyst'] },
      { name: 'Alice Brown', age: 29, email: 'alice@example.com', role: 'moderator', active: true, tags: ['support', 'community'] },
      { name: 'Charlie Wilson', age: 52, email: 'charlie@example.com', role: 'user', active: true, tags: ['business', 'strategy'] }
    ];

    // Products collection
    const products = [
      { name: 'Laptop Pro', category: 'Electronics', price: 1299.99, stock: 25, rating: 4.5, featured: true },
      { name: 'Wireless Mouse', category: 'Electronics', price: 29.99, stock: 100, rating: 4.2, featured: false },
      { name: 'Coffee Mug', category: 'Home', price: 12.99, stock: 50, rating: 4.0, featured: false },
      { name: 'Desk Chair', category: 'Furniture', price: 199.99, stock: 15, rating: 4.7, featured: true },
      { name: 'Phone Case', category: 'Electronics', price: 19.99, stock: 200, rating: 3.8, featured: false }
    ];

    // Orders collection
    const orders = [
      { userId: 'user1', productId: 'prod1', quantity: 1, total: 1299.99, status: 'completed', orderDate: '2024-01-15' },
      { userId: 'user2', productId: 'prod2', quantity: 2, total: 59.98, status: 'pending', orderDate: '2024-01-16' },
      { userId: 'user1', productId: 'prod4', quantity: 1, total: 199.99, status: 'shipped', orderDate: '2024-01-17' },
      { userId: 'user3', productId: 'prod3', quantity: 3, total: 38.97, status: 'completed', orderDate: '2024-01-18' },
      { userId: 'user4', productId: 'prod1', quantity: 1, total: 1299.99, status: 'pending', orderDate: '2024-01-19' }
    ];

    try {
      csvDB.insertMany('users', users);
      csvDB.insertMany('products', products);
      csvDB.insertMany('orders', orders);
      
      toast.success('Sample data generated successfully! Check the users, products, and orders collections.');
    } catch (error) {
      toast.error('Error generating sample data');
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Sample Data Generator
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600 mb-4">
          Generate sample collections with users, products, and orders to explore the database features.
        </p>
        <Button onClick={generateSampleData} className="w-full">
          <Sparkles className="h-4 w-4 mr-2" />
          Generate Sample Data
        </Button>
      </CardContent>
    </Card>
  );
};

export default SampleDataGenerator;
