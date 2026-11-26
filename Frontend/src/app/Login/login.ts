import { Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { postToBackend } from '../backend';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';
import {  Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from './authentication/authentication.service';

export interface VicanLoginCredentials {
  username: string;
  password: string;
  rememberMe: boolean;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent {

  @Input() loading = false;
  @Input() errorMessage = '';

  @Output() loginRequested =
    new EventEmitter<VicanLoginCredentials>();

  @Output() forgotPasswordRequested =
    new EventEmitter<void>();
  showPassword = false;
  submitted = false;

  private readonly fb = inject(FormBuilder);
  private readonly authenticationService = inject(AuthService);

  readonly loginForm = this.fb.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
    rememberMe: [false]
  });

  get usernameInvalid(): boolean {
    const control = this.loginForm.controls.username;

    return control.invalid &&
      (control.touched || this.submitted);
  }

  get passwordInvalid(): boolean {
    const control = this.loginForm.controls.password;

    return control.invalid &&
      (control.touched || this.submitted);
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  private router = inject(Router);
  private changes = inject(ChangeDetectorRef);

  async onSubmit(): Promise<void> {
    this.submitted = true;
  
    if (this.loginForm.invalid || this.loading) {
      this.loginForm.markAllAsTouched();
      return;
    }
  
    this.loading = true;
    this.errorMessage = '';
  
    try {
      const credentials = this.loginForm.getRawValue();
  
      console.log('Attempting login');
  
      const response = await firstValueFrom(
        this.authenticationService.login(credentials)
      );
  
      console.log('Login successful:', response);
  
      // Keep only if the parent needs this event.
      this.loginRequested.emit(credentials);
  
      await this.router.navigateByUrl('/payroll');
  
    } catch (error: unknown) {
      console.error('LOGIN ERROR:', error);
  
      if (error instanceof HttpErrorResponse) {
        console.error('HTTP Status:', error.status);
        console.error('Backend Response:', error.error);
  
        if (error.status === 401) {
          this.errorMessage = 'Invalid username or password.';
        } else if (error.status === 403) {
          this.errorMessage = 'Login forbidden. Check CSRF or permissions.';
        } else if (error.status === 0) {
          this.errorMessage = 'Cannot connect to the Django backend.';
        } else {
          this.errorMessage =
            error.error?.detail ||
            error.error?.error ||
            `Login failed (${error.status}).`;
        }
      } else {
        this.errorMessage =
          error instanceof Error
            ? error.message
            : 'Sign-in failed.';
      }
  
    } finally {
      this.loading = false;
      this.changes.markForCheck();
    }
  }

  onForgotPassword(): void {
    this.forgotPasswordRequested.emit();
  }
}
