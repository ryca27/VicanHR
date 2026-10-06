import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import {HeaderLink} from './Components/header-link/header-link'
import {VicanHeader} from './Components/vican-header/vican-header'

@Component({
  selector: 'app-root',
  imports: [RouterOutlet,RouterLink, HeaderLink, VicanHeader],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('HR_Home');
}
