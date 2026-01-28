import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

export interface User {
  id: string;
  email: string;
  name: string;
  username?: string;
  avatar_url?: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
}

interface AuthResponse {
  user: User;
  token: string;
}

class AuthService {
  private token: string | null = null;

  constructor() {
    // Load token from localStorage on initialization
    this.token = localStorage.getItem('auth_token');
  }

  private getAuthHeaders() {
    return this.token ? { Authorization: `Bearer ${this.token}` } : {};
  }

  private async request<T>(method: string, url: string, data?: any): Promise<T> {
    try {
      const response = await axios({
        method,
        url: `${API_BASE_URL}${url}`,
        data,
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        // Token expired or invalid
        this.logout();
      }
      throw error.response?.data?.error || error.message;
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('post', '/auth/login', {
      email,
      password
    });
    
    this.token = response.token;
    localStorage.setItem('auth_token', this.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    
    return response;
  }

  async register(email: string, password: string, name: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('post', '/auth/register', {
      email,
      password,
      name
    });
    
    this.token = response.token;
    localStorage.setItem('auth_token', this.token);
    localStorage.setItem('user', JSON.stringify(response.user));
    
    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.request('post', '/auth/logout');
    } catch (error) {
      // Ignore logout errors
    } finally {
      this.token = null;
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.token) return null;
    
    try {
      const user = await this.request<User>('get', '/auth/me');
      localStorage.setItem('user', JSON.stringify(user));
      return user;
    } catch (error) {
      this.logout();
      return null;
    }
  }

  async resetPassword(email: string): Promise<void> {
    await this.request('post', '/auth/reset-password', { email });
  }

  async updatePassword(oldPassword: string, newPassword: string): Promise<void> {
    await this.request('put', '/auth/password', {
      old_password: oldPassword,
      new_password: newPassword
    });
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }

  getCurrentUserData(): User | null {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  }
}

export const authService = new AuthService();