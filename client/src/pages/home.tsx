import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="py-12 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Allen Data Hub</h1>
          <p className="text-xl text-gray-600 mb-8">Welcome to your data management platform</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Dashboard</CardTitle>
              <CardDescription>View your statistics and data</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Access Dashboard</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Products</CardTitle>
              <CardDescription>Browse our product catalog</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">View Products</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
              <CardDescription>Manage your orders</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">View Orders</Button>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white">
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p>Start by logging in to access all features.</p>
            <p>Need help? Check the documentation or contact support.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
