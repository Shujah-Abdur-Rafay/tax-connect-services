import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Bookmark, Search, Trash2, Edit, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SavedSearch {
  id: string;
  name: string;
  searchQuery: string;
  category: string;
  location: string;
  priceRange: [number, number];
  minRating: number;
  availability: string[];
  certifications: string[];
  distanceRadius: number;
  createdAt: Date;
}

interface SavedSearchesProps {
  currentFilters: {
    searchQuery: string;
    category: string;
    location: string;
    priceRange: [number, number];
    minRating: number;
    availability: string[];
    certifications: string[];
    distanceRadius: number;
  };
  onLoadSearch: (search: SavedSearch) => void;
}

const SavedSearches: React.FC<SavedSearchesProps> = ({ currentFilters, onLoadSearch }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState('');

  // Load saved searches from localStorage
  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(`savedSearches_${user.id}`);
      if (saved) {
        setSavedSearches(JSON.parse(saved));
      }
    }
  }, [user]);

  const saveCurrentSearch = () => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to save searches",
        variant: "destructive"
      });
      return;
    }

    if (!searchName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a name for your search",
        variant: "destructive"
      });
      return;
    }

    const newSearch: SavedSearch = {
      id: Date.now().toString(),
      name: searchName.trim(),
      ...currentFilters,
      createdAt: new Date()
    };

    const updatedSearches = [...savedSearches, newSearch];
    setSavedSearches(updatedSearches);
    localStorage.setItem(`savedSearches_${user.id}`, JSON.stringify(updatedSearches));
    
    setSearchName('');
    setIsDialogOpen(false);
    
    toast({
      title: "Search Saved",
      description: `"${newSearch.name}" has been saved to your searches`
    });
  };

  const deleteSearch = (searchId: string) => {
    const updatedSearches = savedSearches.filter(s => s.id !== searchId);
    setSavedSearches(updatedSearches);
    if (user) {
      localStorage.setItem(`savedSearches_${user.id}`, JSON.stringify(updatedSearches));
    }
    
    toast({
      title: "Search Deleted",
      description: "Saved search has been removed"
    });
  };

  const loadSearch = (search: SavedSearch) => {
    onLoadSearch(search);
    toast({
      title: "Search Loaded",
      description: `Applied filters from "${search.name}"`
    });
  };

  const getSearchSummary = (search: SavedSearch) => {
    const filters = [];
    if (search.searchQuery) filters.push(`"${search.searchQuery}"`);
    if (search.category !== 'all') filters.push(search.category);
    if (search.location) filters.push(search.location);
    if (search.minRating > 0) filters.push(`${search.minRating}+ stars`);
    return filters.slice(0, 3).join(', ') + (filters.length > 3 ? '...' : '');
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Bookmark className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Save Your Searches</h3>
          <p className="text-gray-600 mb-4">
            Log in to save your search preferences and quickly access them later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5" />
            Saved Searches
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Save Current
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Search</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="searchName">Search Name</Label>
                  <Input
                    id="searchName"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    placeholder="e.g., CPAs in NYC under $200"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveCurrentSearch}>
                    Save Search
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {savedSearches.length === 0 ? (
          <div className="text-center py-6">
            <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">No saved searches yet</p>
            <p className="text-sm text-gray-400">Save your current search to access it later</p>
          </div>
        ) : (
          <div className="space-y-3">
            {savedSearches.map((search) => (
              <div key={search.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{search.name}</h4>
                  <p className="text-xs text-gray-500 mt-1">{getSearchSummary(search)}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Saved {new Date(search.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadSearch(search)}
                  >
                    <Search className="h-3 w-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteSearch(search.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SavedSearches;