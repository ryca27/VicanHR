import { Component, inject, signal, afterNextRender } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from './../../Login/authentication/authentication.service';

@Component({
  selector: 'app-header-link',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header-link.html',
  styleUrl: './header-link.scss',
})
export class HeaderLink {
  readonly browserReady = signal(false);
  readonly authService = inject(AuthService);

  constructor() {
    afterNextRender(() => {
      this.browserReady.set(true);
    });
  }
}
