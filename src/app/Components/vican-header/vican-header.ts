import { Component, inject, OnInit, Input } from '@angular/core';
import { Router, NavigationEnd, ActivatedRoute  } from '@angular/router';
import { filter } from 'rxjs/operators';
import {subHeaderList} from './vican-header-constants'

@Component({
  selector: 'app-vican-header',
  imports: [],
  templateUrl: './vican-header.html',
  styleUrl: './vican-header.scss',
})
export class VicanHeader implements OnInit {
  private router = inject(Router);
  currentUrl = '';
  subHeader = '';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(){
    this.route.url.subscribe(() => {
      const fullUrl = this.route.snapshot.root.firstChild?.routeConfig?.path || '';
      this.subHeader = this.onNavigatePage(fullUrl);
    });
  }
  onNavigatePage(url: string): string{
    return subHeaderList.filter(s => s.url == url)[0].value
  }
}
