import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import LoginDialog from './LoginDialog';
import SignUpDialog from './SignUpDialog';
import { MessageIndicator } from './MessageNotifications';
import ContinueApplicationBanner from './ContinueApplicationBanner';
import {
  Gift,
  User,
  UserCircle,
  ShoppingBag,
  LayoutDashboard,
  Inbox,
  FolderOpen,
  Banknote,
  Briefcase,
  Library,
  Settings,
  LogOut,
} from 'lucide-react';






interface HeaderProps {
  onToggleNotifications: () => void;
  openLoginDialog?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onToggleNotifications, openLoginDialog = false }) => {
  const { user, logout, isAdmin, isProfessional } = useAuth();
  const [loginOpen, setLoginOpen] = useState(openLoginDialog);
  const [signUpOpen, setSignUpOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Update login dialog state when prop changes
  React.useEffect(() => {
    if (openLoginDialog) {
      setLoginOpen(true);
    }
  }, [openLoginDialog]);

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
      navigate('/');
    } catch (error) {
      toast({
        title: "Logout Failed",
        description: "An error occurred while logging out.",
        variant: "destructive",
      });
    }
  };

  return (
    <header className="bg-white shadow-sm border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center">
            <img 
              src="https://d64gsuwffb70l.cloudfront.net/68a37e37fed4ba77da23cd1a_1778600426410_de6f5b9a.png" 
              alt="Refund Connect" 
              className="h-14 w-auto"
            />
          </Link>


          
          <nav className="hidden md:flex space-x-7">
            <Link to="/tax-gigs" className="text-gray-700 hover:text-blue-600 transition-colors font-medium relative">
              Browse Pros
              <span className="absolute -top-2 -right-6 rounded-full bg-gradient-to-r from-orange-500 to-pink-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">New</span>
            </Link>
            <Link to="/find-professionals" className="text-gray-700 hover:text-blue-600 transition-colors">
              Find Pros
            </Link>
            <Link to="/member-portal" className="text-gray-700 hover:text-blue-600 transition-colors">
              Member Portal
            </Link>
            <Link to="/how-it-works" className="text-gray-700 hover:text-blue-600 transition-colors">
              How It Works
            </Link>


            <Link to="/refer" className="text-gray-700 hover:text-blue-600 transition-colors flex items-center">
              <Gift className="w-4 h-4 mr-1 text-orange-500" />
              Refer & Earn
            </Link>

          </nav>




          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <MessageIndicator onClick={onToggleNotifications} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={user.photoURL} alt={user.name} />
                        <AvatarFallback className="bg-blue-600 text-white">
                          {user.name.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-56 max-h-[80vh] overflow-y-auto"
                    align="end"
                    forceMount
                  >
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.name}</p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate('/profile')}>
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/member-portal')}>

                      <UserCircle className="mr-2 h-4 w-4" />
                      <span>Member Portal</span>
                    </DropdownMenuItem>
                    {!isProfessional && !isAdmin && (
                      <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        <span>My Dashboard</span>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => navigate('/my-orders')}>
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      <span>My Orders</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/refer')}>
                      <Gift className="mr-2 h-4 w-4 text-orange-500" />
                      <span>Refer & Earn</span>
                    </DropdownMenuItem>

                    {isProfessional && (
                      <>
                        <DropdownMenuItem onClick={() => navigate('/pro/dashboard')}>
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          <span>Pro Dashboard</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/pro/gigs')}>
                          <Briefcase className="mr-2 h-4 w-4" />
                          <span>My Gigs</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/pro/orders')}>
                          <Inbox className="mr-2 h-4 w-4" />
                          <span>Orders Inbox</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/pro/documents')}>
                          <FolderOpen className="mr-2 h-4 w-4" />
                          <span>Documents Inbox</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/pro-payouts')}>
                          <Banknote className="mr-2 h-4 w-4" />
                          <span>Payouts</span>
                        </DropdownMenuItem>
                      </>
                    )}


                    {isAdmin && (
                      <>
                        <DropdownMenuItem onClick={() => navigate('/admin')}>
                          <Settings className="mr-2 h-4 w-4" />
                          <span>Admin Panel</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/admin/resources')}>
                          <Library className="mr-2 h-4 w-4" />
                          <span>Resource Center</span>
                        </DropdownMenuItem>
                      </>
                    )}


                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setLoginOpen(true)}>Login</Button>
                <Button onClick={() => setSignUpOpen(true)}>Sign Up</Button>
              </>
            )}
          </div>
        </div>
      </div>
      <ContinueApplicationBanner />

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      <SignUpDialog open={signUpOpen} onOpenChange={setSignUpOpen} />
    </header>
  );
};

export default Header;
