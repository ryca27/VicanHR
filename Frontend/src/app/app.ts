import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, RouterLink,Router, NavigationEnd } from '@angular/router';
import {HeaderLink} from './Components/header-link/header-link'
import {VicanHeader} from './Components/vican-header/vican-header'

@Component({
  selector: 'app-root',
  imports: [RouterOutlet,RouterLink, HeaderLink, VicanHeader],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  private router = inject(Router);
  constructor() {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.showHeader = !this.isLoginPage(
          event.urlAfterRedirects
        );
      }
    });
  }

  showHeader = !this.isLoginPage(this.router.url);
  protected readonly title = signal('HR_Home');

  private isLoginPage(url: string): boolean {
    return url.split(/[?#]/)[0] === '/login';
  }
}
