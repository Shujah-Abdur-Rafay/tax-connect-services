import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Search, Filter, Edit, Mail, History, Loader2, Users } from 'lucide-react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { MembershipLevel, ALL_MEMBERSHIP_LEVELS } from '@/constants/membershipLevels';
import { toast } from 'sonner';

interface User {
  id: string;
  email: string;
  displayName: string;
  membershipLevel: string;
  createdAt: string;
}


export function UserMembershipManager() {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [newLevel, setNewLevel] = useState('');
  const [reason, setReason] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);
      const userData = snapshot.docs.map(doc => ({
        id: doc.id,
        email: doc.data().email || '',
        displayName: doc.data().displayName || 'Unknown',
        membershipLevel: doc.data().membershipLevel || MembershipLevel.DIRECTORY_LISTING,

        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
      }));
      setUsers(userData);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const updateMembership = async () => {
    if (!editUser || !newLevel) return;
    try {
      const userRef = doc(db, 'users', editUser.id);
      await updateDoc(userRef, { membershipLevel: newLevel });
      
      await supabase.functions.invoke('update-user-membership', {
        body: { userId: editUser.id, newLevel, previousLevel: editUser.membershipLevel, adminId: user?.uid, reason }
      });

      toast.success('Membership updated');
      setEditUser(null);
      fetchUsers();
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const sendNotification = async (userId: string, userEmail: string, userName: string) => {
    try {
      await supabase.functions.invoke('send-membership-notification', {
        body: { userEmail, userName, subject: 'Membership Update', message: 'Your membership has been updated.' }
      });
      toast.success('Notification sent');
    } catch (error) {
      toast.error('Failed to send notification');
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTier = tierFilter === 'all' || u.membershipLevel === tierFilter;
    return matchesSearch && matchesTier;
  });

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
          <Input placeholder="Search users..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <Select value={tierFilter} onValueChange={setTierFilter}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            {ALL_MEMBERSHIP_LEVELS.map(level => (
              <SelectItem key={level} value={level}>{level}</SelectItem>
            ))}
          </SelectContent>

        </Select>
      </div>

      <div className="grid gap-4">
        {filteredUsers.map((u) => (
          <Card key={u.id}>
            <CardContent className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Checkbox checked={selectedUsers.includes(u.id)} onCheckedChange={(checked) => {
                  setSelectedUsers(checked ? [...selectedUsers, u.id] : selectedUsers.filter(id => id !== u.id));
                }} />
                <div>
                  <h3 className="font-semibold">{u.displayName}</h3>
                  <p className="text-sm text-gray-600">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge>{u.membershipLevel}</Badge>
                <Button size="sm" variant="outline" onClick={() => { setEditUser(u); setNewLevel(u.membershipLevel); }}>
                  <Edit className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => sendNotification(u.id, u.email, u.displayName)}>
                  <Mail className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Membership</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={newLevel} onValueChange={setNewLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_MEMBERSHIP_LEVELS.map(level => (
                  <SelectItem key={level} value={level}>{level}</SelectItem>
                ))}
              </SelectContent>

            </Select>
            <Textarea placeholder="Reason for change..." value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button onClick={updateMembership}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
