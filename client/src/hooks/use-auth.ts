import { useState, useEffect } from 'react';
import { authService, type User } from '@/lib/auth-service';
import { useToast } from '@/hooks/use-toast';

export interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isAuthChecking: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  checkAuth: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const { toast } = useToast();

  const checkAuth = async () => {
    setIsAuthChecking(true);
    try {
      const currentUser = await authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsAuthChecking(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login(email, password);
      setUser(response.user);
      setIsAuthenticated(true);
      toast({
        title: "Успешный вход",
        description: `Добро пожаловать, ${response.user.name}!`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка входа",
        description: error.message || "Неверный email или пароль",
      });
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    try {
      const response = await authService.register(email, password, name);
      setUser(response.user);
      setIsAuthenticated(true);
      toast({
        title: "Регистрация успешна",
        description: `Добро пожаловать, ${response.user.name}!`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка регистрации",
        description: error.message || "Не удалось создать аккаунт",
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      setUser(null);
      setIsAuthenticated(false);
      toast({
        title: "Выход выполнен",
        description: "До скорой встречи!",
      });
    } catch (error: any) {
      // Even if logout fails, clear local state
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await authService.resetPassword(email);
      toast({
        title: "Письмо отправлено",
        description: "Проверьте вашу почту для сброса пароля",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Ошибка сброса",
        description: error.message || "Не удалось отправить письмо",
      });
      throw error;
    }
  };

  // Check auth status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  return {
    user,
    isAuthenticated,
    isAuthChecking,
    login,
    register,
    logout,
    resetPassword,
    checkAuth
  };
}