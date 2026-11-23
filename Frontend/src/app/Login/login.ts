import { Router } from '@angular/router';
import { ChangeDetectorRef } from '@angular/core';
import { postToBackend } from '../backend';

import { CommonModule } from '@angular/common';
import {  Component, EventEmitter, Input, Output, inject } from '@angular/core';

import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

export interface VicanLoginCredentials {
  username: string;
  password: string;
  rememberMe: boolean;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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

  async onSubmit() {
    this.submitted = true;

    if (this.loginForm.invalid || this.loading) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    try {
      const credentials = this.loginForm.getRawValue();
      await postToBackend('/api/auth/login/', credentials);
      this.loginRequested.emit(credentials);
      await this.router.navigateByUrl('/payroll');
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Sign-in failed.';
    } finally {
      this.loading = false;
      this.changes.markForCheck();
    }
  }

  onForgotPassword(): void {
    this.forgotPasswordRequested.emit();
  }
}
