// UserContext.js -> rename to UserContext.tsx
import { createContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

// Define interface for user type
interface User {
  id: string;
  // Add other user properties as needed
}

// Define interface for context value
interface UserContextType {
  user: User | null;
  loading: boolean;
}

// Define interface for provider props
interface UserProviderProps {
  children: ReactNode;
}

// Define the shape of the context value
const defaultContextValue: UserContextType = {
  user: null,
  loading: true,
};

export const UserContext = createContext<UserContextType>(defaultContextValue);

export function UserProvider({ children }: UserProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Rest of your code remains the same
    const fetchUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          const { data, error } = await supabase
            .from('Users')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          if (error) {
            console.error('Error fetching user data:', error);
          } else {
            setUser(data);
          }
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUser();
    
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          const { data, error } = await supabase
            .from('Users')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
          if (!error) {
            setUser(data);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      }
    );
    
    return () => {
      if (authListener && authListener.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  );
}