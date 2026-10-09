import { Component, inject, OnInit } from '@angular/core';
import { Router, NavigationEnd   } from '@angular/router';
import { filter, map, Observable   } from 'rxjs';
import {subHeaderList} from './vican-header-constants'

@Component({
  selector: 'app-vican-header',
  imports: [],
  templateUrl: './vican-header.html',
  styleUrl: './vican-header.scss',
})
export class VicanHeader implements OnInit {
  private router = inject(Router);
  subHeader: string = ''
  public currentUrl$: Observable<string> = this.router.events.pipe(
    filter((event): event is NavigationEnd => event instanceof NavigationEnd),
    map((event: NavigationEnd) => event.urlAfterRedirects) // or event.url
  );
  ngOnInit() {
    this.currentUrl$.subscribe(value => {
      this.subHeader = this.onNavigatePage((value).slice(1));
    })
  }
  onNavigatePage(url: string): string{
    return subHeaderList.filter(s => s.url == url)[0].value
  }
}
