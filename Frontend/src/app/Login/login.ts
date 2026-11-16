
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

  onSubmit(): void {
    this.submitted = true;

    if (this.loginForm.invalid || this.loading) {
      this.loginForm.markAllAsTouched();
      return;
    }

    // Emit credentials to your authentication handler.
    // Connect this to Django when implementing login.
    this.loginRequested.emit(
      this.loginForm.getRawValue()
    );
  }

  onForgotPassword(): void {
    this.forgotPasswordRequested.emit();
  }
}
