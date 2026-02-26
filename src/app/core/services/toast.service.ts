import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon } from 'sweetalert2';

export interface ToastOptions {
  title: string;
  text?: string;
  icon?: SweetAlertIcon;
  duration?: number;
  position?: 'top' | 'top-start' | 'top-end' | 'center' | 'center-start' | 'center-end' | 'bottom' | 'bottom-start' | 'bottom-end';
}

/**
 * ToastService - Centralized toast/snackbar notifications
 * 
 * Uses SweetAlert2 for consistent, beautiful toast notifications.
 * Can be easily swapped for another library if needed.
 */
@Injectable({
  providedIn: 'root'
})
export class ToastService {
  
  private readonly defaultOptions = {
    toast: true,
    position: 'top-end' as const,
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast: HTMLElement) => {
      toast.addEventListener('mouseenter', Swal.stopTimer);
      toast.addEventListener('mouseleave', Swal.resumeTimer);
    }
  };

  /**
   * Show a toast notification
   */
  show(options: ToastOptions): void {
    const Toast = Swal.mixin(this.defaultOptions);
    
    Toast.fire({
      icon: options.icon || 'info',
      title: options.title,
      text: options.text,
      timer: options.duration || 3000,
      position: options.position || 'top-end'
    });
  }

  /**
   * Show a success toast
   */
  success(title: string, text?: string): void {
    this.show({ title, text, icon: 'success' });
  }

  /**
   * Show an error toast
   */
  error(title: string, text?: string): void {
    this.show({ title, text, icon: 'error', duration: 5000 });
  }

  /**
   * Show a warning toast
   */
  warning(title: string, text?: string): void {
    this.show({ title, text, icon: 'warning' });
  }

  /**
   * Show an info toast
   */
  info(title: string, text?: string): void {
    this.show({ title, text, icon: 'info' });
  }

  /**
   * Show a favorite added toast (with heart icon styling)
   */
  favoriteAdded(productName?: string): void {
    const Toast = Swal.mixin({
      ...this.defaultOptions,
      customClass: {
        popup: 'sw-toast-favorite'
      }
    });

    Toast.fire({
      icon: 'success',
      title: 'Ajouté aux favoris',
      text: productName || undefined,
      iconColor: '#B5190C'
    });
  }

  /**
   * Show a favorite removed toast
   */
  favoriteRemoved(productName?: string): void {
    const Toast = Swal.mixin({
      ...this.defaultOptions,
      timer: 2000
    });

    Toast.fire({
      icon: 'info',
      title: 'Retiré des favoris',
      text: productName || undefined
    });
  }
}

