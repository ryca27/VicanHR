import { Component, inject } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter, map, startWith, Observable } from 'rxjs'; // Added startWith
import { CommonModule } from '@angular/common'; // Import CommonModule for async pipe
import { subHeaderList } from './vican-header-constants';

@Component({
  selector: 'app-vican-header',
  imports: [CommonModule], // Add CommonModule here
  templateUrl: './vican-header.html',
  styleUrl: './vican-header.scss',
})
export class VicanHeader {
  private router = inject(Router);

  // Use startWith(this.router.url) to catch the active URL immediately on refresh
  public subHeader$: Observable<string> = this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    map((event: NavigationEnd) => event.urlAfterRedirects),
    startWith(this.router.url), 
    map(url => this.onNavigatePage(url.slice(1)))
  );

  onNavigatePage(url: string): string {
    const found = subHeaderList.find(s => s.url === url);
    return found ? found.value : ''; // Safeguard against undefined
  }
}