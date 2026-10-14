import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  imports: [NgClass],
  selector: 'app-button',
  styleUrl: './button.scss',
  templateUrl: './button.html',
})
export class ButtonComponent {
  @Input() label: string = ""
  @Input() color: string = ""
}
