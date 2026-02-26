import { Injectable } from '@angular/core';
import { Observable, from, BehaviorSubject } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { SupabaseService } from './supabase.service';
import { Router } from '@angular/router';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthResult {
  success: boolean;
  admin?: AdminUser;
  error?: string;
}

export interface AdminUser {
  id: number; // bigint from database
  username: string;
  password?: string; // Optional for security
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private tableName = 'admin';
  private currentAdminSubject = new BehaviorSubject<AdminUser | null>(null);
  public currentAdmin$ = this.currentAdminSubject.asObservable();

  constructor(
    private supabaseService: SupabaseService,
    private router: Router
  ) {
    this.initializeAuth();
  }

  /**
   * Initialize authentication by checking for existing session
   */
  private initializeAuth(): void {
    const storedAdmin = this.getStoredAdmin();
    if (storedAdmin) {
      this.currentAdminSubject.next(storedAdmin);
    }
  }

  /**
   * Authenticate admin with username and password
   */
  login(credentials: LoginCredentials): Observable<AuthResult> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .select('*')
        .eq('username', credentials.username)
        .maybeSingle() // Use maybeSingle() instead of single() to handle 0 results
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Login error:', error);
          return {
            success: false,
            error: 'Database error occurred. Please try again.'
          };
        }

        if (!data) {
          console.warn('Admin user not found:', credentials.username);
          return {
            success: false,
            error: 'Invalid username. Admin user not found.'
          };
        }

        const admin = data as AdminUser;
        
        // Simple password verification (plain text comparison)
        // In production, you should use proper password hashing
        if (credentials.password === admin.password) {
          // Store admin in session (without password)
          this.setCurrentAdmin(admin);
          
          return {
            success: true,
            admin: this.sanitizeAdmin(admin)
          };
        } else {
          return {
            success: false,
            error: 'Invalid password'
          };
        }
      }),
      catchError((error) => {
        console.error('Authentication error:', error);
        return [{
          success: false,
          error: 'Authentication failed. Please try again.'
        }];
      })
    );
  }

  /**
   * Remove sensitive data from admin object
   */
  private sanitizeAdmin(admin: AdminUser): AdminUser {
    const { password, ...sanitized } = admin;
    return sanitized as AdminUser;
  }

  /**
   * Set current admin and store in session
   */
  private setCurrentAdmin(admin: AdminUser): void {
    const sanitizedAdmin = this.sanitizeAdmin(admin);
    
    this.currentAdminSubject.next(sanitizedAdmin);
    sessionStorage.setItem('currentAdmin', JSON.stringify(sanitizedAdmin));
    sessionStorage.setItem('adminToken', this.generateToken(admin));
  }

  /**
   * Get stored admin from session storage
   */
  private getStoredAdmin(): AdminUser | null {
    try {
      const stored = sessionStorage.getItem('currentAdmin');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  /**
   * Generate a simple token (replace with JWT in production)
   */
  private generateToken(admin: AdminUser): string {
    return btoa(JSON.stringify({
      id: admin.id,
      username: admin.username,
      timestamp: new Date().getTime()
    }));
  }

  /**
   * Get current admin
   */
  getCurrentAdmin(): AdminUser | null {
    return this.currentAdminSubject.value;
  }

  /**
   * Check if admin is authenticated with session validation
   */
  isAuthenticated(): boolean {
    try {
      const admin = this.getCurrentAdmin();
      const token = sessionStorage.getItem('adminToken');
      
      if (!admin || !token) {
        return false;
      }
      
      // Validate token expiry (if token contains timestamp)
      if (this.isTokenExpired(token)) {
        console.warn('Admin session expired');
        this.logout();
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking admin authentication:', error);
      return false;
    }
  }

  /**
   * Check if token is expired (simple timestamp-based validation)
   */
  private isTokenExpired(token: string): boolean {
    try {
      const tokenData = JSON.parse(atob(token));
      const tokenTimestamp = tokenData.timestamp;
      const currentTime = new Date().getTime();
      
      // Token expires after 8 hours (28800000 ms)
      const expirationTime = 8 * 60 * 60 * 1000;
      
      return (currentTime - tokenTimestamp) > expirationTime;
    } catch (error) {
      console.warn('Invalid token format, considering expired');
      return true;
    }
  }

  /**
   * Logout admin
   */
  logout(): Observable<void> {
    return new Observable(observer => {
      try {
        // Clear session storage
        sessionStorage.removeItem('currentAdmin');
        sessionStorage.removeItem('adminToken');
        
        // Clear current admin
        this.currentAdminSubject.next(null);
        
        // Navigate to login
        this.router.navigate(['/account/login']);
        
        observer.next();
        observer.complete();
      } catch (error) {
        observer.error(error);
      }
    });
  }

  /**
   * Get admin by ID
   */
  getAdminById(id: number): Observable<AdminUser | null> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .select('id, username')
        .eq('id', id)
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error fetching admin:', error);
          return null;
        }
        return data as AdminUser;
      }),
      catchError(() => [null])
    );
  }

  /**
   * Get all admins (for admin management)
   */
  getAllAdmins(): Observable<AdminUser[]> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .select('id, username')
        .order('id')
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error fetching admins:', error);
          return [];
        }
        return data as AdminUser[];
      }),
      catchError(() => [[]])
    );
  }

  /**
   * Create new admin (for admin management)
   */
  createAdmin(adminData: { username: string; password: string }): Observable<AdminUser | null> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .insert([adminData])
        .select('id, username')
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error creating admin:', error);
          return null;
        }
        return data as AdminUser;
      }),
      catchError(() => [null])
    );
  }

  /**
   * Update admin
   */
  updateAdmin(id: number, updates: { username?: string; password?: string }): Observable<AdminUser | null> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .update(updates)
        .eq('id', id)
        .select('id, username')
        .single()
    ).pipe(
      map(({ data, error }) => {
        if (error) {
          console.error('Error updating admin:', error);
          return null;
        }
        return data as AdminUser;
      }),
      catchError(() => [null])
    );
  }

  /**
   * Delete admin
   */
  deleteAdmin(id: number): Observable<boolean> {
    return from(
      this.supabaseService.getClient()
        .from(this.tableName)
        .delete()
        .eq('id', id)
    ).pipe(
      map(({ error }) => {
        if (error) {
          console.error('Error deleting admin:', error);
          return false;
        }
        return true;
      }),
      catchError(() => [false])
    );
  }
}
