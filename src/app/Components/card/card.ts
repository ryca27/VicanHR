import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  imports: [NgClass],
  selector: 'app-card',
  styleUrl: './card.scss',
  templateUrl: './card.html',
})
export class CardComponent {
  @Input() header: string = '';
  @Input() display: string = '';
  @Input() color: string = '';
}
